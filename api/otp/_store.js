import crypto from "crypto";

// Persistent in-memory map attached to Node globalThis to survive module reloads & dev server calls
globalThis.__saloriya_otp_store = globalThis.__saloriya_otp_store || new Map();

export const OTP_SECRET = process.env.OTP_SECRET_KEY || "saloriya_production_secure_otp_secret_key_2026";

export function hashOtp(phone, otp) {
  const cleanPhone = String(phone || "").replace(/\D/g, "");
  const cleanOtp = String(otp || "").trim();
  return crypto.createHmac("sha256", OTP_SECRET).update(`${cleanPhone}:${cleanOtp}`).digest("hex");
}

export async function saveOtp({ phone, otp, otpHash, expiresAt, requestTimestamps }) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const now = Date.now();

  const record = {
    phone: cleanPhone,
    otp, // held temporarily in memory for local dev / unconfigured gateway fallback
    otpHash,
    expiresAt,
    attempts: 0,
    lastSentAt: now,
    requestTimestamps: requestTimestamps || [now]
  };

  globalThis.__saloriya_otp_store.set(cleanPhone, record);

  // Optional Supabase sync if credentials exist
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
    } catch (err) {
      // Supabase is optional; in-memory store remains primary fallback
      console.warn("Supabase OTP storage sync:", err.message);
    }
  }

  return record;
}

export async function getOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  
  // 1. Check in-memory store
  const mem = globalThis.__saloriya_otp_store.get(cleanPhone);
  if (mem) {
    return mem;
  }

  // 2. Check Supabase table
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${cleanPhone}&select=*`, {
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        }
      });
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        return {
          phone: row.phone,
          otpHash: row.otp_hash,
          expiresAt: new Date(row.expires_at).getTime(),
          attempts: Number(row.attempts || 0),
          lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).getTime() : Date.now()
        };
      }
    } catch (err) {
      console.warn("Supabase OTP fetch error:", err.message);
    }
  }

  return null;
}

export async function incrementAttempts(phone) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  const mem = globalThis.__saloriya_otp_store.get(cleanPhone);
  if (mem) {
    mem.attempts = (mem.attempts || 0) + 1;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${cleanPhone}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ attempts: (mem ? mem.attempts : 1) })
      });
    } catch (e) {
      // ignore
    }
  }
}

export async function deleteOtp(phone) {
  const cleanPhone = String(phone).replace(/\D/g, "");
  globalThis.__saloriya_otp_store.delete(cleanPhone);

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseServiceKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/phone_otps?phone=eq.${cleanPhone}`, {
        method: "DELETE",
        headers: {
          "apikey": supabaseServiceKey,
          "Authorization": `Bearer ${supabaseServiceKey}`
        }
      });
    } catch (err) {
      // ignore
    }
  }
}
