import crypto from "crypto";
import { hashOtp, getOtp, deleteOtp, incrementAttempts, OTP_SECRET, verifyPhoneOtpSessionToken } from "./_store.js";

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default async function handler(req, res) {
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
    const { phone, otp, sessionToken: bodyToken } = req.body || {};

    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanOtp = String(otp || "").trim();

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: "Invalid phone number format." });
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit numeric OTP code." });
    }

    const sessionToken = bodyToken || parseCookie(req.headers.cookie, "__saloriya_phone_otp");

    // 1. Primary: Stateless Session Token verification (Serverless-safe & 100% reliable)
    if (sessionToken) {
      const tokenResult = verifyPhoneOtpSessionToken(sessionToken, cleanPhone, cleanOtp);

      if (tokenResult.valid) {
        res.setHeader("Set-Cookie", "__saloriya_phone_otp=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        deleteOtp(cleanPhone).catch(() => {});

        const now = Date.now();
        const tokenPayload = {
          phone: cleanPhone,
          verified: true,
          timestamp: now,
          exp: now + 15 * 60 * 1000
        };
        const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
        const signature = crypto.createHmac("sha256", OTP_SECRET).update(payloadB64).digest("base64url");
        const signedVerificationToken = `${payloadB64}.${signature}`;

        return res.status(200).json({
          success: true,
          verified: true,
          message: "Phone number verified successfully ✓",
          phone: cleanPhone,
          token: signedVerificationToken
        });
      }

      if (tokenResult.error && tokenResult.error.includes("Incorrect OTP")) {
        return res.status(400).json({
          success: false,
          error: "Incorrect OTP. Please try again."
        });
      } else if (tokenResult.error && tokenResult.error.includes("expired")) {
        return res.status(400).json({
          success: false,
          error: "OTP has expired. Please tap 'Resend OTP' to receive a new code."
        });
      }
    }

    // 2. Secondary: Check In-Memory Map / Supabase database
    const now = Date.now();
    const record = await getOtp(cleanPhone);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "No active OTP found for this number or OTP has expired. Please request a new OTP."
      });
    }

    // Check expiration (5 minutes validity)
    if (now > record.expiresAt) {
      await deleteOtp(cleanPhone);
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Please tap 'Resend OTP' to receive a new code."
      });
    }

    // Check attempts limit (Max 4 failed tries)
    const currentAttempts = Number(record.attempts || 0);
    if (currentAttempts >= 4) {
      await deleteOtp(cleanPhone);
      return res.status(400).json({
        success: false,
        error: "Maximum verification attempts exceeded. This OTP has been invalidated. Please request a new OTP."
      });
    }

    // Compare hash with stored hash
    const submittedHash = hashOtp(cleanPhone, cleanOtp);
    const storedHash = record.otpHash;
    const isMatch = (submittedHash === storedHash) || (record.otp && record.otp === cleanOtp);

    if (!isMatch) {
      await incrementAttempts(cleanPhone);
      const remaining = 3 - currentAttempts;

      if (remaining <= 0) {
        await deleteOtp(cleanPhone);
        return res.status(400).json({
          success: false,
          error: "Incorrect OTP. Maximum attempts exceeded. Please request a new OTP."
        });
      }

      return res.status(400).json({
        success: false,
        error: `Incorrect OTP code. You have ${remaining} attempt(s) remaining.`,
        remainingAttempts: remaining
      });
    }

    // Success! Delete OTP record to prevent replay
    await deleteOtp(cleanPhone);

    // Generate short-lived signed verification token (15 minutes validity)
    const tokenPayload = {
      phone: cleanPhone,
      verified: true,
      timestamp: now,
      exp: now + 15 * 60 * 1000
    };
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
    const signature = crypto.createHmac("sha256", OTP_SECRET).update(payloadB64).digest("base64url");
    const signedVerificationToken = `${payloadB64}.${signature}`;

    return res.status(200).json({
      success: true,
      verified: true,
      message: "Phone number verified successfully ✓",
      phone: cleanPhone,
      token: signedVerificationToken
    });
  } catch (err) {
    console.error("OTP Verification Error:", err);
    return res.status(500).json({
      success: false,
      error: "Verification service encountered an error. Please try again."
    });
  }
}
