import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import productsSeed from "../src/productsSeed.json" with { type: "json" };

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// Attach persistent cache to Node globalThis to survive serverless cold starts & reloads
globalThis.__saloriya_products_store = globalThis.__saloriya_products_store || null;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ybyboplrrovrhnnunkaa.supabase.co").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_UYmUTnaCjZ3AGFn2k4BR3A_rYGAI3am").trim();

export function hasProductColours(product) {
  if (!product) return false;
  const colours = Array.isArray(product.colours) ? product.colours : [];
  return colours.some((c) => c && c.trim() && c.trim().toLowerCase() !== "standard");
}

export function sortProductsByColours(list) {
  if (!Array.isArray(list)) return [];
  const withColours = [];
  const withoutColours = [];

  list.forEach((p) => {
    if (hasProductColours(p)) {
      withColours.push(p);
    } else {
      withoutColours.push(p);
    }
  });

  return [...withColours, ...withoutColours];
}

function getProductsFilePath() {
  return path.resolve(process.cwd(), "src", "productsSeed.json");
}

function readProducts() {
  if (Array.isArray(globalThis.__saloriya_products_store) && globalThis.__saloriya_products_store.length > 0) {
    return sortProductsByColours(globalThis.__saloriya_products_store);
  }

  try {
    const filePath = getProductsFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        globalThis.__saloriya_products_store = data;
        return sortProductsByColours(data);
      }
    }
  } catch (e) {
    // Ephemeral / readonly serverless fallback
  }

  const fallback = Array.isArray(productsSeed) ? productsSeed : [];
  globalThis.__saloriya_products_store = fallback;
  return sortProductsByColours(fallback);
}

function writeProducts(products) {
  const sorted = sortProductsByColours(products);
  globalThis.__saloriya_products_store = sorted;
  try {
    const filePath = getProductsFilePath();
    fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2), "utf8");
    return true;
  } catch (e) {
    // Readonly / serverless environment
    return false;
  }
}

async function querySupabaseProducts() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.desc`, {
      signal: AbortSignal.timeout(3000),
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return sortProductsByColours(data);
      }
    }
  } catch (e) {
    console.warn("Supabase products fetch failed in api/products:", e);
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const url = req.url || "";
  const pathParts = url.split("?")[0].split("/").filter(Boolean);
  // URL may be /api/products or /api/products/:id/stock or /api/products/:id
  const isStockUpdate = url.includes("/stock");
  const isPublishUpdate = url.includes("/publish");

  let idFromPath = null;
  if (pathParts.length >= 3 && pathParts[1] === "products") {
    idFromPath = pathParts[2];
  }

  try {
    // 1. GET /api/products
    if (req.method === "GET") {
      const sbProducts = await querySupabaseProducts();
      if (sbProducts && sbProducts.length > 0) {
        writeProducts(sbProducts);
        return res.status(200).json({ success: true, products: sbProducts });
      }
      const products = readProducts();
      return res.status(200).json({ success: true, products });
    }

    // 2. PUT /api/products/:id/stock
    if (req.method === "PUT" && isStockUpdate) {
      const id = idFromPath || req.query?.id || req.body?.id;
      const stock = Math.max(0, parseInt(req.body?.stock, 10) || 0);

      let products = readProducts();
      const idx = products.findIndex((p) => p.id === id || p.slug === id);
      if (idx !== -1) {
        products[idx].stock = stock;
        products[idx].updated_at = new Date().toISOString();
        writeProducts(products);
      }

      // Sync with Supabase
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ stock })
          });
        } catch (e) {}
      }

      return res.status(200).json({ success: true, message: "Stock updated" });
    }

    // 3. PUT /api/products/:id/publish
    if (req.method === "PUT" && isPublishUpdate) {
      const id = idFromPath || req.query?.id || req.body?.id;
      const is_published = Boolean(req.body?.is_published);

      let products = readProducts();
      const idx = products.findIndex((p) => p.id === id || p.slug === id);
      if (idx !== -1) {
        products[idx].is_published = is_published;
        products[idx].updated_at = new Date().toISOString();
        writeProducts(products);
      }

      // Sync with Supabase
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ is_published })
          });
        } catch (e) {}
      }

      return res.status(200).json({ success: true, message: "Publish status updated" });
    }

    // 4. DELETE /api/products/:id
    if (req.method === "DELETE") {
      const id = idFromPath || req.query?.id;
      if (!id) {
        return res.status(400).json({ success: false, error: "Product ID required" });
      }

      let products = readProducts();
      products = products.filter((p) => p.id !== id && p.slug !== id);
      writeProducts(products);

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          });
        } catch (e) {}
      }

      return res.status(200).json({ success: true, message: "Product deleted" });
    }

    // 5. POST /api/products (Create or Update Product)
    if (req.method === "POST") {
      const body = req.body || {};
      const targetSlug = body.slug;
      const targetId = body.id;

      const isValidUuid = (val) =>
        typeof val === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

      const cleanRecord = {
        name: String(body.name || "").trim(),
        slug: String(body.slug || "").trim(),
        description: String(body.description || "").trim(),
        category: String(body.category || "Combos").trim(),
        price_paise: Number(body.price_paise) || 0,
        stock: Math.max(0, parseInt(body.stock, 10) || 0),
        colours: Array.isArray(body.colours) ? body.colours : [],
        image_urls: Array.isArray(body.image_urls) ? body.image_urls : (Array.isArray(body.images) ? body.images : []),
        is_published: body.is_published !== false,
        updated_at: new Date().toISOString()
      };

      if (isValidUuid(targetId)) {
        cleanRecord.id = targetId;
      }

      // Sync with Supabase
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          if (isValidUuid(targetId)) {
            await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(targetId)}`, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(cleanRecord)
            });
          } else if (targetSlug) {
            const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/products?slug=eq.${encodeURIComponent(targetSlug)}&select=id`, {
              headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
            });
            const existingRows = checkRes.ok ? await checkRes.json() : [];
            if (Array.isArray(existingRows) && existingRows.length > 0 && existingRows[0]?.id) {
              await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(existingRows[0].id)}`, {
                method: "PATCH",
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(cleanRecord)
              });
              cleanRecord.id = existingRows[0].id;
            } else {
              const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
                method: "POST",
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  "Content-Type": "application/json",
                  Prefer: "return=representation"
                },
                body: JSON.stringify(cleanRecord)
              });
              if (insertRes.ok) {
                const inserted = await insertRes.json();
                if (Array.isArray(inserted) && inserted[0]?.id) {
                  cleanRecord.id = inserted[0].id;
                }
              }
            }
          } else {
            const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "return=representation"
              },
              body: JSON.stringify(cleanRecord)
            });
            if (insertRes.ok) {
              const inserted = await insertRes.json();
              if (Array.isArray(inserted) && inserted[0]?.id) {
                cleanRecord.id = inserted[0].id;
              }
            }
          }
        } catch (sbApiErr) {
          console.warn("Supabase products sync warning in api/products:", sbApiErr);
        }
      }

      let products = readProducts();
      const effectiveId = cleanRecord.id || targetId || `prod_${Date.now()}`;
      const fullRecord = {
        ...cleanRecord,
        id: effectiveId,
        images: cleanRecord.image_urls
      };

      const idx = products.findIndex((p) => (effectiveId && p.id === effectiveId) || (targetSlug && p.slug === targetSlug));

      if (idx !== -1) {
        products[idx] = { ...products[idx], ...fullRecord };
      } else {
        products.unshift(fullRecord);
      }

      const sorted = sortProductsByColours(products);
      writeProducts(sorted);

      return res.status(200).json({ success: true, products: sorted, product: fullRecord });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Products API error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
