import crypto from "crypto";
import { cleanEmail, hashOtp, getOtp, deleteOtp, incrementAttempts, generateVerificationToken } from "./_store.js";

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
    const { email, otp } = req.body || {};

    const normEmail = cleanEmail(email);
    const cleanOtp = String(otp || "").trim();

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return res.status(400).json({ success: false, error: "Invalid email address format." });
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit verification code." });
    }

    const now = Date.now();
    const record = await getOtp(normEmail);

    if (!record) {
      return res.status(400).json({
        success: false,
        error: "No active verification code found for this email or it has expired. Please request a new code."
      });
    }

    // 1. Expiration check (5 minutes validity)
    if (now > record.expiresAt) {
      await deleteOtp(normEmail);
      return res.status(400).json({
        success: false,
        error: "Verification code has expired. Please request a new code."
      });
    }

    // 2. Maximum attempts check (Invalidate after 3 failed attempts)
    const currentAttempts = Number(record.attempts || 0);
    if (currentAttempts >= 3) {
      await deleteOtp(normEmail);
      return res.status(400).json({
        success: false,
        error: "Too many failed attempts. This code has been permanently invalidated. Please request a new code."
      });
    }

    // 3. Cryptographic hash comparison with timing-safe comparison
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

    // 4. Invalidate OTP record immediately to prevent replay attacks
    await deleteOtp(normEmail);

    // 5. Generate secure, cryptographically signed verification token
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
