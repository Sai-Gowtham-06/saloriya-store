import crypto from "crypto";
import { cleanEmail, hashOtp, saveOtp, getOtp, deleteOtp, sendOtpEmail, createEmailOtpSessionToken } from "./_store.js";

export default async function handler(req, res) {
  // CORS & Header handling
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
    const { email, honeypot, hp_field } = req.body || {};

    // 1. Anti-Abuse: Hidden honeypot check (silently drop bot submissions)
    if ((honeypot && String(honeypot).trim() !== "") || (hp_field && String(hp_field).trim() !== "")) {
      return res.status(200).json({
        success: true,
        message: "Verification code sent to your email",
        cooldown: 60
      });
    }

    // 2. Validate email format
    const normEmail = cleanEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normEmail || !emailRegex.test(normEmail)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address (e.g. name@example.com)."
      });
    }

    const now = Date.now();
    const existing = await getOtp(normEmail);

    // 3. Anti-Abuse Rate Limiting:
    // a. 60-second cooldown per email
    if (existing && existing.lastSentAt && now - existing.lastSentAt < 60 * 1000) {
      const waitSeconds = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Please wait ${waitSeconds}s before requesting a new code.`,
        retryAfter: waitSeconds
      });
    }

    // b. Max 5 OTP requests per email in 15 minutes
    const windowStart = now - 15 * 60 * 1000;
    let requestTimestamps = existing ? (existing.requestTimestamps || []).filter((t) => t > windowStart) : [];

    if (requestTimestamps.length >= 5) {
      const oldestInWindow = Math.min(...requestTimestamps);
      const waitMins = Math.ceil((oldestInWindow + 15 * 60 * 1000 - now) / (60 * 1000));
      return res.status(429).json({
        success: false,
        error: `Too many OTP requests. Maximum 5 attempts allowed per 15 minutes. Please try again in ${waitMins} minute(s).`
      });
    }

    requestTimestamps.push(now);

    // 4. Generate cryptographically secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = hashOtp(normEmail, otp);
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes validity

    // 5. Generate tamper-proof session token for serverless resilience
    const sessionToken = createEmailOtpSessionToken(normEmail, otpHash, expiresAt);

    // Set HTTP cookie so serverless verify calls can validate without shared memory
    res.setHeader(
      "Set-Cookie",
      `__saloriya_email_otp=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=300`
    );

    // 6. Save in memory & Supabase
    await saveOtp({
      email: normEmail,
      otp,
      otpHash,
      expiresAt,
      requestTimestamps
    });

    // 7. Send branded HTML email via Nodemailer / Resend
    const sendResult = await sendOtpEmail({ email: normEmail, otp });

    if (!sendResult.success) {
      // Revert OTP record if email failed to deliver so customer can retry
      await deleteOtp(normEmail);
      return res.status(500).json({
        success: false,
        error: sendResult.error || "Could not deliver verification email. Please check your email address or try again."
      });
    }

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${normEmail}. Please check your inbox and spam folder.`,
      cooldown: 60,
      sessionToken
    });
  } catch (err) {
    console.error("Email OTP send error:", err);
    return res.status(500).json({
      success: false,
      error: "Could not send verification email. Please try again."
    });
  }
}
