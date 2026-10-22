import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const key = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ""
).trim();

const isPlaceholderUrl = !url || url.includes("YOUR_PROJECT") || url.includes("your-project-id") || !url.startsWith("http");
const isPlaceholderKey = !key || key.includes("your-publishable") || key.includes("YOUR_KEY") || key.length < 20;

export const isSupabaseConfigured = Boolean(!isPlaceholderUrl && !isPlaceholderKey);
export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null;

