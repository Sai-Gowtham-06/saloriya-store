import crypto from "crypto";

// Fallback in-memory cache shared with send.js
// Note: In serverless environments, Supabase public.phone_otps table is the persistent store
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
    const { phone, otp } = req.body || {};

    const cleanPhone = String(phone || "").replace(/\D/g, "");
    const cleanOtp = String(otp || "").trim();

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({ success: false, error: "Invalid phone number format." });
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({ success: false, error: "Please enter a valid 6-digit numeric OTP code." });
    }

    const now = Date.now();
    const OTP_SECRET = process.env.OTP_SECRET_KEY || "saloriya_production_secure_otp_secret_key_2026";
    const submittedHash = crypto.createHmac("sha256", OTP_SECRET).update(`${cleanPhone}:${cleanOtp}`).digest("hex");

    // Fetch from Supabase or memory
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    let record = null;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        const dbRes = await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${cleanPhone}&select=*`, {
          headers: {
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`
          }
        });
        const rows = await dbRes.json();
        if (Array.isArray(rows) && rows.length > 0) {
          record = rows[0];
        }
      } catch (dbErr) {
        console.warn("Supabase fetch failed, checking fallback:", dbErr.message);
      }
    }

    // If no record found
    if (!record) {
      // In local test environments without Supabase phone_otps table created yet,
      // verify hash directly or check standard memory
      return res.status(400).json({
        success: false,
        error: "No active OTP found for this number or OTP expired. Please request a new OTP."
      });
    }

    // Check expiration (5 minutes validity)
    const expiresAtMs = new Date(record.expires_at).getTime();
    if (now > expiresAtMs) {
      // Invalidate expired record
      await deleteOtpRecord(cleanPhone, supabaseUrl, supabaseServiceKey);
      return res.status(400).json({
        success: false,
        error: "OTP has expired. Please tap 'Resend OTP' to receive a new code."
      });
    }

    // Check attempts limit (Max 3 failed tries)
    const currentAttempts = Number(record.attempts || 0);
    if (currentAttempts >= 3) {
      // Permanently invalidate record due to abuse
      await deleteOtpRecord(cleanPhone, supabaseUrl, supabaseServiceKey);
      return res.status(400).json({
        success: false,
        error: "Maximum verification attempts exceeded (3/3). This OTP has been invalidated. Please request a new OTP."
      });
    }

    // Compare hash with stored hash (constant-time comparison against timing attacks)
    const storedHash = record.otp_hash;
    const isMatch = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(storedHash));

    if (!isMatch) {
      const newAttempts = currentAttempts + 1;
      const remaining = 3 - newAttempts;

      // Increment attempt counter in DB
      if (supabaseUrl && supabaseServiceKey) {
        await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${cleanPhone}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseServiceKey,
            "Authorization": `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ attempts: newAttempts })
        });
      }

      if (remaining <= 0) {
        await deleteOtpRecord(cleanPhone, supabaseUrl, supabaseServiceKey);
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

    // Success!
    // 1. Delete/invalidate the OTP record to prevent replay attacks
    await deleteOtpRecord(cleanPhone, supabaseUrl, supabaseServiceKey);

    // 2. Generate short-lived signed verification token (10 minutes validity)
    const tokenPayload = {
      phone: cleanPhone,
      verified: true,
      timestamp: now,
      exp: now + 10 * 60 * 1000 // 10 minutes
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

async function deleteOtpRecord(phone, supabaseUrl, supabaseKey) {
  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${phone}`, {
        method: "DELETE",
        headers: {
          "apikey": supabaseKey,
          "Authorization": `Bearer ${supabaseKey}`
        }
      });
    } catch (e) {
      console.warn("Could not delete OTP record:", e);
    }
  }
}
