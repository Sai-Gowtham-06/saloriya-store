import crypto from "crypto";
import nodemailer from "nodemailer";

// Persistent in-memory map attached to Node globalThis to survive module reloads & dev server calls
globalThis.__saloriya_email_otp_store = globalThis.__saloriya_email_otp_store || new Map();

export const OTP_SECRET = process.env.OTP_SECRET_KEY || "saloriya_production_secure_otp_secret_key_2026";

export function cleanEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function hashOtp(email, otp) {
  const normEmail = cleanEmail(email);
  const cleanOtp = String(otp || "").trim();
  return crypto.createHmac("sha256", OTP_SECRET).update(`${normEmail}:${cleanOtp}`).digest("hex");
}

export function generateVerificationToken(email) {
  const normEmail = cleanEmail(email);
  const timestamp = Date.now();
  const signature = crypto.createHmac("sha256", OTP_SECRET).update(`${normEmail}:${timestamp}:email_verified`).digest("hex");
  return `emv_${timestamp}_${signature.slice(0, 32)}`;
}

export async function saveOtp({ email, otp, otpHash, expiresAt, requestTimestamps }) {
  const normEmail = cleanEmail(email);
  const now = Date.now();

  const record = {
    email: normEmail,
    otp, // held temporarily in memory for dev fallback / test auto-fill
    otpHash,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
    requestTimestamps: requestTimestamps || [now]
  };

  globalThis.__saloriya_email_otp_store.set(normEmail, record);

  // Optional non-blocking Supabase sync if credentials exist
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    fetch(`${supabaseUrl}/rest/v1/email_otps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseServiceKey,
        "Authorization": `Bearer ${supabaseServiceKey}`,
        "Prefer": "resolution=merge-duplicates"
      },
      signal: AbortSignal.timeout(2000),
      body: JSON.stringify({
        email: normEmail,
        otp_hash: otpHash,
        expires_at: new Date(expiresAt).toISOString(),
        attempts: 0,
        last_sent_at: new Date(now).toISOString()
      })
    }).catch(() => {});
  }

  return record;
}

export async function getOtp(email) {
  const normEmail = cleanEmail(email);

  // 1. Check in-memory store
  const mem = globalThis.__saloriya_email_otp_store.get(normEmail);
  if (mem) {
    return mem;
  }

  // 2. Check Supabase table with fast timeout fallback
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/email_otps?email=eq.${encodeURIComponent(normEmail)}&select=*`, {
        signal: AbortSignal.timeout(1500),
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        }
      });
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        return {
          email: row.email,
          otpHash: row.otp_hash,
          expiresAt: new Date(row.expires_at).getTime(),
          attempts: Number(row.attempts || 0),
          lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).getTime() : Date.now()
        };
      }
    } catch {}
  }

  return null;
}

export async function incrementAttempts(email) {
  const normEmail = cleanEmail(email);
  const mem = globalThis.__saloriya_email_otp_store.get(normEmail);
  if (mem) {
    mem.attempts = (mem.attempts || 0) + 1;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/email_otps?email=eq.${encodeURIComponent(normEmail)}`, {
        method: "PATCH",
        signal: AbortSignal.timeout(1500),
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ attempts: (mem?.attempts || 1) })
      });
    } catch {}
  }
}

export async function deleteOtp(email) {
  const normEmail = cleanEmail(email);
  globalThis.__saloriya_email_otp_store.delete(normEmail);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/email_otps?email=eq.${encodeURIComponent(normEmail)}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(1500),
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        }
      });
    } catch {}
  }
}

/**
 * Send branded HTML OTP email using Nodemailer (or Resend API fallback)
 */
export async function sendOtpEmail({ email, otp }) {
  const normEmail = cleanEmail(email);

  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
  const resendApiKey = process.env.RESEND_API_KEY;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SALORIYA Order Verification Code</title>
  <style>
    body { font-family: 'Playfair Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #fdf6f2; margin: 0; padding: 24px; color: #2d141b; }
    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 18px; border: 1.5px solid #edd5bc; overflow: hidden; box-shadow: 0 16px 40px -10px rgba(100, 19, 39, 0.09); }
    .header { background: linear-gradient(135deg, #641327 0%, #861e38 100%); padding: 34px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 2px; }
    .header p { margin: 6px 0 0; font-size: 11.5px; color: #faedf0; letter-spacing: 1.5px; text-transform: uppercase; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    .content { padding: 36px 30px; text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .title { font-size: 20px; font-weight: 700; color: #2d141b; margin-top: 0; font-family: 'Playfair Display', Georgia, serif; }
    .lead { font-size: 14.5px; color: #4d2632; line-height: 1.6; margin: 8px 0 20px; }
    .code-box { background: #faf4f0; border: 2px dashed #cf9c4e; border-radius: 14px; padding: 18px 24px; margin: 20px 0; display: inline-block; }
    .code { font-size: 40px; font-weight: 800; letter-spacing: 8px; color: #861e38; font-family: monospace; }
    .expiry { font-size: 13px; color: #82636c; margin-top: 10px; font-weight: 500; }
    .notice { font-size: 12px; color: #a17f8b; margin-top: 24px; line-height: 1.5; border-top: 1px solid #f8ebe4; padding-top: 18px; }
    .footer { background: #faf6f4; border-top: 1px solid #eed6cc; padding: 20px; text-align: center; font-size: 11.5px; color: #82636c; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SALORIYA</h1>
      <p>Where Elegance Meets Women</p>
    </div>
    <div class="content">
      <div class="title">Verify Your Order</div>
      <p class="lead">
        Thank you for choosing SALORIYA. Use the 6-digit verification code below to confirm your checkout order:
      </p>
      <div class="code-box">
        <div class="code">${otp}</div>
      </div>
      <p class="expiry">⏱️ This verification code is valid for <strong>5 minutes</strong>.</p>
      <p class="notice">
        If you did not initiate this order, please disregard this email. Never share your verification code with anyone.
      </p>
    </div>
    <div class="footer">
      © 2026 SALORIYA Store · Chennai, Tamil Nadu · Dedicated Luxury Boutique
    </div>
  </div>
</body>
</html>
  `;

  // 1. Try Resend API if key is present
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
          from: "SALORIYA Store <orders@saloriya.com>",
          to: [normEmail],
          subject: `💎 Your SALORIYA Order Verification Code: ${otp}`,
          html: htmlContent
        })
      });
      if (res.ok) {
        return { success: true, method: "resend" };
      }
    } catch (err) {
      console.warn("Resend email delivery failed:", err);
    }
  }

  // 2. Try Nodemailer SMTP (Gmail App Password or custom SMTP)
  if (smtpUser && smtpPass && smtpPass !== "your_gmail_app_password_here") {
    try {
      const cleanPass = smtpPass.replace(/\s+/g, "");
      const transporter = nodemailer.createTransport({
        host: smtpHost || "smtp.gmail.com",
        port: smtpPort || 587,
        secure: smtpPort === 465, // false for 587 (uses STARTTLS)
        auth: {
          user: smtpUser,
          pass: cleanPass
        }
      });

      const senderFrom = process.env.SMTP_FROM || `"SALORIYA Store" <${smtpUser}>`;

      const info = await transporter.sendMail({
        from: senderFrom,
        to: normEmail,
        subject: `💎 Your SALORIYA Order Verification Code: ${otp}`,
        html: htmlContent
      });

      console.log(`[SALORIYA EMAIL OTP] Successfully sent code to ${normEmail} via Nodemailer (Message ID: ${info.messageId})`);
      return { success: true, method: "nodemailer", messageId: info.messageId };
    } catch (err) {
      console.error("[SALORIYA EMAIL OTP] Nodemailer SMTP delivery error:", err.message);
      // Fall through to logging
    }
  } else {
    console.warn(`[SALORIYA EMAIL OTP NOTICE] Real email could not be sent to ${normEmail} because SMTP_USER and SMTP_PASS are not configured in .env.local.`);
  }

  // 3. Fallback / Dev Mode Logging
  console.log(`\n======================================================`);
  console.log(`[SALORIYA EMAIL OTP] Verification code for ${normEmail}: ${otp}`);
  console.log(`======================================================\n`);

  return { success: true, method: "console-fallback" };
}
