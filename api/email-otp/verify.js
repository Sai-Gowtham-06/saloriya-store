import crypto from "crypto";
import { cleanEmail, hashOtp, getOtp, deleteOtp, incrementAttempts, generateVerificationToken, verifyEmailOtpSessionToken } from "./_store.js";

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
    const { email, otp, sessionToken: bodyToken } = req.body || {};

    const normEmail = cleanEmail(email);
    const cleanOtp = String(otp || "").trim();

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return res.status(400).json({ success: false, error: "Invalid email address format." });
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit verification code." });
    }

    const sessionToken = bodyToken || parseCookie(req.headers.cookie, "__saloriya_email_otp");

    // 1. Primary: Stateless Session Token verification (Serverless-safe & 100% reliable)
    if (sessionToken) {
      const tokenResult = verifyEmailOtpSessionToken(sessionToken, normEmail, cleanOtp);

      if (tokenResult.valid) {
        // Clear cookie to prevent replay
        res.setHeader("Set-Cookie", "__saloriya_email_otp=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
        // Also cleanup memory/DB record asynchronously
        deleteOtp(normEmail).catch(() => {});

        const token = generateVerificationToken(normEmail);
        return res.status(200).json({
          success: true,
          message: "Email verified successfully.",
          email: normEmail,
          token
        });
      }

      // If token was present and had a specific validation error:
      if (tokenResult.error && tokenResult.error.includes("verification code")) {
        return res.status(400).json({
          success: false,
          error: "Incorrect verification code. Please check and try again."
        });
      } else if (tokenResult.error && tokenResult.error.includes("expired")) {
        return res.status(400).json({
          success: false,
          error: "Verification code has expired. Please request a new code."
        });
      }
      // If signature failed or mismatch, fall through to check memory/database
    }

    // 2. Secondary: Check In-Memory Map / Supabase database
    const now = Date.now();
    const record = await getOtp(normEmail);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found for this email or it has expired. Please request a new code."
      });
    }

    // Expiration check (5 minutes validity)
    if (now > record.expiresAt) {
      await deleteOtp(normEmail);
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }

    // Maximum attempts check (Invalidate after 3 failed attempts)
    const currentAttempts = Number(record.attempts || 0);
    if (currentAttempts >= 3) {
      await deleteOtp(normEmail);
      return res.status(400).json({
        success: false,
        error: "Too many failed attempts. This code has been permanently invalidated. Please request a new code."
      });
    }

    // Cryptographic hash comparison with timing-safe comparison
    const submittedHash = hashOtp(normEmail, cleanOtp);
    const expectedHash = record.otpHash;

    const submittedBuf = Buffer.from(submittedHash, "hex");
    const expectedBuf = Buffer.from(expectedHash, "hex");

    const isMatch =
      submittedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(submittedBuf, expectedBuf);

    if (!isMatch) {
      await incrementAttempts(normEmail);
      const remaining = 3 - (currentAttempts + 1);
      return res.status(400).json({
        success: false,
        error: remaining > 0
          ? `Invalid 6-digit code. ${remaining} attempt(s) remaining.`
          : "Invalid 6-digit code. Maximum attempts exceeded. Code has been invalidated."
      });
    }

    // Invalidate OTP record immediately to prevent replay attacks
    await deleteOtp(normEmail);
    res.setHeader("Set-Cookie", "__saloriya_email_otp=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");

    // Generate secure, cryptographically signed verification token
    const token = generateVerificationToken(normEmail);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully.",
      email: normEmail,
      token
    });
  } catch (err) {
    console.error("Email OTP verify error:", err);
    return res.status(500).json({
      success: false,
      error: "Verification failed. Please try again."
    });
  }
}
