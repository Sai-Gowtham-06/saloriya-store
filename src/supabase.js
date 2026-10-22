import { createClient } from "@supabase/supabase-js";

let rawUrl = import.meta.env.VITE_SUPABASE_URL || "";
const url = rawUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

export const isSupabaseConfigured = Boolean(url && key && !url.includes("YOUR_PROJECT"));
export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null;
