import crypto from "crypto";
import { hashOtp, saveOtp, getOtp } from "./_store.js";

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
    const existing = await getOtp(cleanPhone);

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

    // b. Hard limit: Max 5 OTP requests per phone number within a rolling 15-minute window
    const windowStart = now - 15 * 60 * 1000;
    let requestTimestamps = existing ? (existing.requestTimestamps || []).filter(t => t > windowStart) : [];

    if (requestTimestamps.length >= 5) {
      const oldestInWindow = Math.min(...requestTimestamps);
      const waitMins = Math.ceil((oldestInWindow + 15 * 60 * 1000 - now) / (60 * 1000));
      return res.status(429).json({
        success: false,
        error: `Too many OTP requests. Maximum 5 attempts allowed per 15 minutes. Please try again in ${waitMins} minute(s).`
      });
    }

    // 4. Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(cleanPhone, otp);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    requestTimestamps.push(now);

    // 5. Save to shared store (Memory + Supabase)
    await saveOtp({
      phone: cleanPhone,
      otp,
      otpHash,
      expiresAt,
      requestTimestamps
    });

    // 6. Dispatch SMS via SMS Gateway (Fast2SMS / 2Factor / Twilio)
    let smsSent = false;
    let gatewayError = null;

    const FAST2SMS_API_KEY = (process.env.FAST2SMS_API_KEY || "Y77NsbezYuiUUNXgHGiL5rIiYAxGBdq8LgYegssnFbmdJRZdH8Aw5yEa3jYOABW5o6Q0G0ZbWZDiEyr9").trim();

    if (FAST2SMS_API_KEY) {
      try {
        const f2sRes = await fetch("https://www.fast2sms.com/dev/bulkV2", {
          method: "POST",
          headers: {
            "authorization": FAST2SMS_API_KEY,
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
          console.log(`[Fast2SMS SUCCESS] SMS dispatched to +91 ${cleanPhone}`);
        } else {
          gatewayError = Array.isArray(f2sData.message) ? f2sData.message.join(", ") : (f2sData.message || "Fast2SMS delivery notification");
          console.warn(`[Fast2SMS Notice] Code: ${f2sData.status_code || ''} | ${gatewayError}`);
        }
      } catch (smsErr) {
        gatewayError = smsErr.message;
        console.error("Fast2SMS network error:", smsErr);
      }
    } else if (process.env.TWO_FACTOR_API_KEY) {
      try {
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
        console.error("2Factor network error:", tfErr);
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
        console.error("Twilio network error:", twErr);
      }
    }

    console.log(`[SALORIYA REAL SMS] Mobile: +91 ${cleanPhone} | OTP: ${otp} | Sent: ${smsSent}`);

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
