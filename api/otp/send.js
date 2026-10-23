import crypto from "crypto";

// In-memory rate-limiting & fallback cache for serverless execution
// In production with Supabase, this also persists to public.phone_otps table
const otpMemoryCache = new Map();

export default async function handler(req, res) {
  // CORS & method validation
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  try {
    const { phone, honeypot } = req.body || {};

    // 1. Anti-Abuse: Hidden honeypot check (silently drop bot submissions)
    if (honeypot && String(honeypot).trim() !== "") {
      // Simulate success to fool bot without doing any work or sending SMS
      return res.status(200).json({ success: true, message: "OTP sent" });
    }

    // 2. Validate Indian mobile phone format (exactly 10 digits starting with 6, 7, 8, or 9)
    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const phoneRegex = /^[6-9]\d{9}$/;

    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number. Must be a valid 10-digit Indian mobile number."
      });
    }

    const now = Date.now();
    const existing = otpMemoryCache.get(cleanPhone);

    // 3. Anti-Abuse Rate Limiting:
    // a. 60-second cooldown per phone number
    if (existing && existing.lastSentAt && now - existing.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds} seconds before requesting a new OTP.`,
        retryAfter: waitSeconds
      });
    }

    // b. Hard limit: Max 3 OTP requests per phone number within a rolling 15-minute window
    const windowStart = now - 15 * 60 * 1000;
    let requestTimestamps = existing ? (existing.requestTimestamps || []).filter(t => t > windowStart) : [];

    if (requestTimestamps.length >= 3) {
      const oldestInWindow = Math.min(...requestTimestamps);
      const waitMins = Math.ceil((oldestInWindow + 15 * 60 * 1000 - now) / (60 * 1000));
      return res.status(429).json({
        success: false,
        error: `Too many OTP requests. Maximum 3 attempts allowed per 15 minutes. Please try again in ${waitMins} minute(s).`
      });
    }

    // 4. Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();

    // 5. Hash OTP using HMAC SHA-256 with server secret before storing
    const OTP_SECRET = process.env.OTP_SECRET_KEY || "saloriya_production_secure_otp_secret_key_2026";
    const otpHash = crypto.createHmac("sha256", OTP_SECRET).update(`${cleanPhone}:${otp}`).digest("hex");

    // Expiry: 5 minutes validity
    const expiresAt = now + 5 * 60 * 1000;

    requestTimestamps.push(now);
    otpMemoryCache.set(cleanPhone, {
      otpHash,
      expiresAt,
      attempts: 0,
      lastSentAt: now,
      requestTimestamps
    });

    // 6. Optional: Persist to Supabase if credentials are provided in env
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/phone_otps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            phone: cleanPhone,
            otp_hash: otpHash,
            expires_at: new Date(expiresAt).toISOString(),
            attempts: 0,
            last_sent_at: new Date(now).toISOString()
          })
        });
      } catch (dbErr) {
        console.warn("Supabase OTP storage fallback to memory:", dbErr.message);
      }
    }

    // 7. Dispatch SMS via SMS Gateway (Fast2SMS / 2Factor / Twilio / MSG91)
    let smsSent = false;
    let gatewayError = null;

    if (process.env.FAST2SMS_API_KEY) {
      try {
        // Fast2SMS Quick OTP Route (India)
        const f2sRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": process.env.FAST2SMS_API_KEY.trim(),
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            variables_values: otp,
            route: "otp",
            numbers: cleanPhone
          })
        });
        const f2sData = await f2sRes.json();
        if (f2sData.return === true) {
          smsSent = true;
        } else {
          gatewayError = Array.isArray(f2sData.message) ? f2sData.message.join(", ") : (f2sData.message || "Fast2SMS delivery failed");
          console.error("Fast2SMS error:", f2sData);
        }
      } catch (smsErr) {
        gatewayError = smsErr.message;
        console.error("Fast2SMS dispatch error:", smsErr);
      }
    } else if (process.env.TWO_FACTOR_API_KEY) {
      try {
        // 2Factor.in SMS Gateway (India)
        const apiKey = process.env.TWO_FACTOR_API_KEY.trim();
        const tfRes = await fetch(`https://2factor.in/v3/API/V1/${apiKey}/SMS/+91${cleanPhone}/${otp}/SALORIYA+OTP`);
        const tfData = await tfRes.json();
        if (tfData.Status === "Success") {
          smsSent = true;
        } else {
          gatewayError = tfData.Details || "2Factor.in SMS delivery failed";
        }
      } catch (tfErr) {
        gatewayError = tfErr.message;
        console.error("2Factor dispatch error:", tfErr);
      }
    } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
        const twRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            To: `+91${cleanPhone}`,
            From: process.env.TWILIO_PHONE_NUMBER,
            Body: `Your SALORIYA order verification OTP is ${otp}. Valid for 5 minutes. Please do not share this code.`
          })
        });
        const twData = await twRes.json();
        if (twRes.ok) {
          smsSent = true;
        } else {
          gatewayError = twData.message || "Twilio SMS dispatch failed";
        }
      } catch (twErr) {
        gatewayError = twErr.message;
        console.error("Twilio delivery error:", twErr);
      }
    }

    // Always log OTP securely to serverless logs for store admin visibility
    console.log(`[SALORIYA REAL SMS] Mobile: +91 ${cleanPhone} | OTP: ${otp} | Sent: ${smsSent}`);

    // If an SMS provider was configured but returned an error (e.g. invalid key or out of credits)
    if (gatewayError && !smsSent) {
      return res.status(502).json({
        success: false,
        error: `SMS Gateway Error: ${gatewayError}. Please check your SMS provider balance/configuration.`
      });
    }

    // If no live SMS provider is configured yet in Vercel
    const hasSmsConfig = Boolean(process.env.FAST2SMS_API_KEY || process.env.TWO_FACTOR_API_KEY || process.env.TWILIO_ACCOUNT_SID);

    if (!hasSmsConfig) {
      // In development / demo when credentials haven't been entered in Vercel yet
      return res.status(200).json({
        success: true,
        message: "SMS gateway key not yet configured in Vercel. OTP generated in server logs.",
        expiresIn: 300,
        cooldown: 60,
        unconfiguredGateway: true
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number via SMS.",
      expiresIn: 300,
      cooldown: 60
    });
  } catch (err) {
    console.error("OTP Send Handler Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to send OTP. Please check your network and try again."
    });
  }
}
