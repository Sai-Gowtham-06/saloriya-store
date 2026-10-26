import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import promosSeed from "../src/promosSeed.json" with { type: "json" };

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// Persistent cache across serverless cold starts
globalThis.__saloriya_promos_store = globalThis.__saloriya_promos_store || null;

const SUPABASE_URL = (
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://ybyboplrrovrhnnunkaa.supabase.co"
).trim();

const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_UYmUTnaCjZ3AGFn2k4BR3A_rYGAI3am"
).trim();

function getPromosFilePath() {
  return path.resolve(process.cwd(), "src", "promosSeed.json");
}

function readPromos() {
  if (Array.isArray(globalThis.__saloriya_promos_store) && globalThis.__saloriya_promos_store.length > 0) {
    return globalThis.__saloriya_promos_store;
  }

  try {
    const filePath = getPromosFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        globalThis.__saloriya_promos_store = data;
        return data;
      }
    }
  } catch (e) {
    // Readonly/serverless fallback
  }

  const fallback = Array.isArray(promosSeed) ? promosSeed : [];
  globalThis.__saloriya_promos_store = fallback;
  return fallback;
}

function writePromos(promos) {
  globalThis.__saloriya_promos_store = promos;
  try {
    const filePath = getPromosFilePath();
    fs.writeFileSync(filePath, JSON.stringify(promos, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}

async function getSupabaseClient() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY || SUPABASE_URL.includes("your-project")) {
      return null;
    }
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    return null;
  }
}

// Ensure default promo codes exist in Supabase
async function ensureSupabaseDefaults(sb) {
  if (!sb) return;
  try {
    const defaults = Array.isArray(promosSeed) ? promosSeed : [];
    for (const p of defaults) {
      await sb.from("promo_codes").upsert([{
        code: p.code,
        discount_type: p.discount_type || "free_delivery",
        discount_value: Number(p.discount_value ?? p.amount ?? 50),
        description: p.description || "Active Voucher",
        is_active: true
      }], { onConflict: "code" });
    }
  } catch (e) {
    // Non-fatal
  }
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const sb = await getSupabaseClient();
  let promos = readPromos();

  // Sync with live Supabase database
  if (sb) {
    try {
      const { data, error } = await sb
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        // Merge Supabase promo records
        const mergedMap = new Map();
        promos.forEach((p) => mergedMap.set(p.code.trim().toUpperCase(), p));
        data.forEach((p) => {
          mergedMap.set(p.code.trim().toUpperCase(), {
            ...p,
            code: p.code.trim().toUpperCase(),
            amount: Number(p.discount_value ?? p.amount ?? 50)
          });
        });
        promos = Array.from(mergedMap.values());
        writePromos(promos);
      } else {
        // Seed initial default promo codes if Supabase table is empty
        await ensureSupabaseDefaults(sb);
      }
    } catch (e) {
      console.warn("Supabase promo sync warning:", e);
    }
  }

  // Normalize code lookup helper
  const findPromoMatch = (inputCode) => {
    if (!inputCode) return null;
    const clean = String(inputCode).trim().toUpperCase();
    const alphaNum = clean.replace(/[^A-Z0-9]/g, "");

    return promos.find((p) => {
      if (!p || !p.code) return false;
      const pClean = String(p.code).trim().toUpperCase();
      const pAlpha = pClean.replace(/[^A-Z0-9]/g, "");
      return pClean === clean || pAlpha === alphaNum;
    }) || null;
  };

  // GET: Retrieve all promo codes OR validate a specific promo code
  if (req.method === "GET") {
    const queryCode = req.query?.code;

    if (queryCode) {
      const matched = findPromoMatch(queryCode);
      if (!matched) {
        return res.status(200).json({
          success: false,
          valid: false,
          message: `Promo code "${queryCode.trim().toUpperCase()}" is invalid or expired.`
        });
      }

      if (matched.is_active === false) {
        return res.status(200).json({
          success: false,
          valid: false,
          message: `Promo code "${matched.code}" is currently inactive.`
        });
      }

      if (matched.expires_at) {
        const expTime = new Date(matched.expires_at).getTime();
        if (!isNaN(expTime) && expTime < Date.now()) {
          return res.status(200).json({
            success: false,
            valid: false,
            message: `Promo code "${matched.code}" has expired.`
          });
        }
      }

      return res.status(200).json({
        success: true,
        valid: true,
        promo: {
          code: matched.code.trim().toUpperCase(),
          discount_type: matched.discount_type || "free_delivery",
          discount_value: Number(matched.discount_value ?? matched.amount ?? 50),
          amount: Number(matched.discount_value ?? matched.amount ?? 50),
          description: matched.description || "Active Voucher",
          is_active: true
        }
      });
    }

    // Return all promos (active first)
    return res.status(200).json({
      success: true,
      promos
    });
  }

  // POST: Add new promo code OR validate promo code
  if (req.method === "POST") {
    const body = req.body || {};

    // Support validation action via POST
    if (body.action === "validate" || body.validateOnly) {
      const queryCode = body.code || "";
      const matched = findPromoMatch(queryCode);
      if (!matched || matched.is_active === false) {
        return res.status(200).json({
          success: false,
          valid: false,
          message: `Promo code "${String(queryCode).trim().toUpperCase()}" is invalid or expired.`
        });
      }

      return res.status(200).json({
        success: true,
        valid: true,
        promo: {
          code: matched.code.trim().toUpperCase(),
          discount_type: matched.discount_type || "free_delivery",
          discount_value: Number(matched.discount_value ?? matched.amount ?? 50),
          amount: Number(matched.discount_value ?? matched.amount ?? 50),
          description: matched.description || "Active Voucher",
          is_active: true
        }
      });
    }

    // Admin Creation of new promo code
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ success: false, message: "Promo code string is required." });
    }

    const discount_value = Number(body.discount_value ?? body.amount ?? 50);
    const newPromo = {
      id: body.id || `promo_${Date.now()}`,
      code,
      discount_type: body.discount_type || "free_delivery",
      discount_value,
      amount: discount_value,
      description: body.description || (body.discount_type === "free_delivery" ? "Free Delivery (Waives ₹50 fee)" : `₹${discount_value} OFF`),
      is_active: body.is_active !== false,
      created_at: new Date().toISOString(),
      expires_at: body.expires_at || null
    };

    // Save to Supabase
    if (sb) {
      try {
        await sb.from("promo_codes").upsert([{
          code: newPromo.code,
          discount_type: newPromo.discount_type,
          discount_value: newPromo.discount_value,
          description: newPromo.description,
          is_active: newPromo.is_active
        }], { onConflict: "code" });
      } catch (e) {
        console.warn("Supabase insert promo error:", e);
      }
    }

    const updated = [newPromo, ...promos.filter((p) => p.code.trim().toUpperCase() !== code)];
    writePromos(updated);

    return res.status(201).json({
      success: true,
      promo: newPromo,
      promos: updated
    });
  }

  // DELETE: Delete / Deactivate a promo code
  if (req.method === "DELETE") {
    const codeToDelete = String(req.query?.code || req.body?.code || "").trim().toUpperCase();
    if (!codeToDelete) {
      return res.status(400).json({ success: false, message: "Code parameter is required." });
    }

    if (sb) {
      try {
        await sb.from("promo_codes").delete().ilike("code", codeToDelete);
      } catch (e) {}
    }

    const filtered = promos.filter((p) => p.code.trim().toUpperCase() !== codeToDelete);
    writePromos(filtered);

    return res.status(200).json({
      success: true,
      message: `Promo code "${codeToDelete}" deleted successfully.`,
      promos: filtered
    });
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}
