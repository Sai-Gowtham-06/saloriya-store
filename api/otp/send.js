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

    // 7. Dispatch SMS via SMS Gateway (Fast2SMS / Twilio / MSG91)
    let smsSent = false;
    const smsProvider = process.env.SMS_PROVIDER || "FAST2SMS";

    if (process.env.FAST2SMS_API_KEY) {
      try {
        // Fast2SMS Quick OTP Route (India)
        const f2sRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": process.env.FAST2SMS_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            variables_values: otp,
            route: "otp",
            numbers: cleanPhone
          })
        });
        const f2sData = await f2sRes.json();
        if (f2sData.return) smsSent = true;
      } catch (smsErr) {
        console.error("Fast2SMS delivery error:", smsErr);
      }
    } else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
        const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
        await fetch(twilioUrl, {
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
        smsSent = true;
      } catch (twErr) {
        console.error("Twilio delivery error:", twErr);
      }
    }

    // For test / development without live SMS credits configured, include test note in server logs
    console.log(`[SALORIYA OTP] Phone: +91 ${cleanPhone} | OTP Code: ${otp} (Valid 5 mins)`);

    // In non-production or test environments where SMS key is not configured, pass simulated indicator
    const isMock = !smsSent && !process.env.FAST2SMS_API_KEY && !process.env.TWILIO_ACCOUNT_SID;

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your mobile number.",
      expiresIn: 300,
      cooldown: 60,
      ...(isMock ? { testOtp: otp, note: "SMS Gateway simulated: OTP printed to console or provided here for local testing." } : {})
    });
  } catch (err) {
    console.error("OTP Send Handler Error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to send OTP. Please check your network and try again."
    });
  }
}
