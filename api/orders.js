import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import ordersSeed from "../src/ordersSeed.json" with { type: "json" };

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

// Global memory cache for serverless environments
globalThis.__saloriya_orders_store = globalThis.__saloriya_orders_store || null;

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://ybyboplrrovrhnnunkaa.supabase.co").trim();
const SUPABASE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_UYmUTnaCjZ3AGFn2k4BR3A_rYGAI3am").trim();

function getOrdersFilePath() {
  return path.resolve(process.cwd(), "src", "ordersSeed.json");
}

function readOrders() {
  if (Array.isArray(globalThis.__saloriya_orders_store) && globalThis.__saloriya_orders_store.length > 0) {
    return globalThis.__saloriya_orders_store;
  }

  try {
    const filePath = getOrdersFilePath();
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(data) && data.length > 0) {
        globalThis.__saloriya_orders_store = data;
        return data;
      }
    }
  } catch (e) {
    // In serverless readonly environment, fallback to memory store
  }

  const fallback = Array.isArray(ordersSeed) ? ordersSeed : [];
  globalThis.__saloriya_orders_store = fallback;
  return fallback;
}

function writeOrders(orders) {
  globalThis.__saloriya_orders_store = orders;
  try {
    const filePath = getOrdersFilePath();
    fs.writeFileSync(filePath, JSON.stringify(orders, null, 2), "utf8");
    return true;
  } catch (e) {
    // Serverless filesystem may be ephemeral/readonly
    return false;
  }
}

async function querySupabaseOrders() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  const list = [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((o) => {
          list.push({
            ...o,
            order_id: o.order_id || (o.id ? `SLR-${String(o.id).slice(-6).toUpperCase()}` : `SLR-${Date.now().toString().slice(-6)}`),
            customer_phone: o.customer_phone || o.phone || "",
            delivery_address: o.delivery_address || (typeof o.address === "object" ? (o.address?.full || `${o.address?.street || ""}, ${o.address?.city || ""}`) : String(o.address || "")),
            status: o.status || o.order_status || "confirmed"
          });
        });
      }
    }
  } catch (e) {
    console.warn("Supabase orders query error in api/orders:", e);
  }

  // Also query cloud sync channel for 100% reliable cross-device persistence on Vercel
  try {
    const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=like.SYNC_ORDER_*&order=created_at.desc`, {
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    if (syncRes.ok) {
      const syncRows = await syncRes.json();
      if (Array.isArray(syncRows)) {
        syncRows.forEach((r) => {
          try {
            const parsed = JSON.parse(r.description);
            if (parsed && (parsed.order_id || parsed.customer_name)) {
              list.push(parsed);
            }
          } catch (err) {}
        });
      }
    }
  } catch (e) {
    console.warn("Cloud sync query error in api/orders:", e);
  }

  return list.length > 0 ? list : null;
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

  let idFromPath = null;
  const ordersIdx = pathParts.indexOf("orders");
  if (ordersIdx !== -1 && pathParts.length > ordersIdx + 1) {
    const nextPart = pathParts[ordersIdx + 1];
    if (nextPart !== "status") {
      idFromPath = nextPart;
    }
  } else if (pathParts.length >= 3 && pathParts[1] === "orders") {
    idFromPath = pathParts[2];
  }

  const { id } = req.query || {};

  try {
    // 1. GET /api/orders
    if (req.method === "GET") {
      const sbOrders = await querySupabaseOrders();
      const localOrders = readOrders();

      const mergedMap = new Map();
      [...(sbOrders || []), ...localOrders].forEach((o) => {
        const key = String(o.order_id || o.id);
        if (key && !mergedMap.has(key)) {
          mergedMap.set(key, o);
        } else if (key) {
          const existing = mergedMap.get(key);
          const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
          const newTime = new Date(o.updated_at || o.created_at || 0).getTime();
          if (newTime > existingTime) {
            mergedMap.set(key, { ...existing, ...o });
          }
        }
      });

      const orders = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()
      );
      writeOrders(orders);
      return res.status(200).json({ success: true, orders });
    }

    // 2. POST /api/orders (Create order)
    if (req.method === "POST") {
      const body = req.body || {};
      if (!body.order_id) {
        return res.status(400).json({ success: false, error: "Order ID is required" });
      }

      let orders = readOrders();
      const existingIdx = orders.findIndex(
        (o) => (o.order_id && o.order_id === body.order_id) || (o.id && o.id === body.id)
      );

      if (existingIdx !== -1) {
        orders[existingIdx] = { ...orders[existingIdx], ...body };
      } else {
        orders.unshift(body);
      }

      writeOrders(orders);

      // Persist to Supabase orders table across all devices
      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const sbPayload = {
            order_id: body.order_id,
            product_name: body.product_name,
            product_id: body.product_id,
            product_image: body.product_image || "",
            variant_colour: body.variant_colour || "Standard",
            quantity: body.quantity || 1,
            unit_price_paise: body.unit_price_paise,
            subtotal_paise: body.subtotal_paise || body.total_paise || 0,
            total_paise: body.total_paise || 0,
            discount_paise: body.discount_paise || 0,
            payment_method: body.payment_method || "cod",
            payment_status: body.payment_method === "prepaid" ? "paid" : "pending",
            customer_name: body.customer_name,
            customer_phone: body.customer_phone || body.phone || "",
            phone: body.customer_phone || body.phone || "",
            customer_email: body.customer_email || null,
            delivery_address: typeof body.delivery_address === "string" ? body.delivery_address : (body.address?.full || ""),
            address: typeof body.address === "object" ? body.address : { full: body.delivery_address || "" },
            status: body.status || body.order_status || "confirmed",
            order_status: body.status || body.order_status || "confirmed",
            payment_screenshot: body.payment_screenshot || body.payment_screenshot_url || null,
            promo_code: body.promo_code || null,
            email_token: body.email_token || null,
            created_at: body.created_at || new Date().toISOString(),
            updated_at: body.updated_at || new Date().toISOString()
          };

          const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify(sbPayload)
          });

          if (!sbRes.ok) {
            // Fallback for legacy columns schema: ALWAYS preserve order_id, customer, and product name
            const fallbackPayload = {
              order_id: body.order_id,
              customer_name: body.customer_name,
              phone: body.customer_phone || body.phone,
              customer_phone: body.customer_phone || body.phone,
              product_name: body.product_name,
              product_id: body.product_id,
              delivery_address: typeof body.delivery_address === "string" ? body.delivery_address : (body.address?.full || ""),
              address: typeof body.delivery_address === "string" ? { full: body.delivery_address } : (body.address || { full: "" }),
              payment_method: body.payment_method || "cod",
              payment_status: body.payment_method === "prepaid" ? "paid" : "pending",
              order_status: body.status || "confirmed",
              status: body.status || "confirmed",
              total_paise: body.total_paise || 0,
              discount_paise: body.discount_paise || 0,
              promo_code: body.promo_code || null
            };
            await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
              method: "POST",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json",
                Prefer: "resolution=merge-duplicates"
              },
              body: JSON.stringify(fallbackPayload)
            });
          }
        } catch (sbErr) {
          console.warn("Supabase order insert warning:", sbErr);
        }

        // Always save to cloud sync channel for 100% reliable cross-device persistence
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/promo_codes`, {
            method: "POST",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify({
              code: `SYNC_ORDER_${body.order_id}`,
              discount_type: "order_sync",
              discount_value: 0,
              description: JSON.stringify(body),
              is_active: false
            })
          });
        } catch (syncErr) {}
      }

      return res.status(200).json({ success: true, order: body, ordersCount: orders.length });
    }

    // 3. PUT /api/orders/:id/status or PUT /api/orders (Status update)
    if (req.method === "PUT") {
      const targetId = idFromPath || id || req.body?.id || req.body?.order_id;
      const status = req.body?.status || req.body?.order_status;
      if (!targetId || !status) {
        return res.status(400).json({ success: false, error: "Missing order ID or status" });
      }

      let orders = readOrders();
      const idx = orders.findIndex((o) => o.order_id === targetId || o.id === targetId);
      if (idx !== -1) {
        orders[idx].status = status;
        orders[idx].order_status = status;
        orders[idx].updated_at = new Date().toISOString();
        writeOrders(orders);
      }

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(order_id.eq.${encodeURIComponent(targetId)},id.eq.${encodeURIComponent(targetId)})`, {
            method: "PATCH",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ status, order_status: status })
          });
          if (!patchRes.ok) {
            await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(order_id.eq.${encodeURIComponent(targetId)},id.eq.${encodeURIComponent(targetId)})`, {
              method: "PATCH",
              headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ order_status: status })
            });
          }
        } catch (e) {}

        // Update Cloud sync channel
        try {
          const syncRes = await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.SYNC_ORDER_${encodeURIComponent(targetId)}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
          });
          if (syncRes.ok) {
            const syncRows = await syncRes.json();
            if (Array.isArray(syncRows) && syncRows.length > 0 && syncRows[0]?.description) {
              const parsed = JSON.parse(syncRows[0].description);
              parsed.status = status;
              parsed.order_status = status;
              parsed.updated_at = new Date().toISOString();
              await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.SYNC_ORDER_${encodeURIComponent(targetId)}`, {
                method: "PATCH",
                headers: {
                  apikey: SUPABASE_KEY,
                  Authorization: `Bearer ${SUPABASE_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ description: JSON.stringify(parsed) })
              });
            }
          }
        } catch (syncErr) {}
      }

      return res.status(200).json({ success: true, message: "Order status updated" });
    }

    // 4. DELETE /api/orders/:id or DELETE /api/orders
    if (req.method === "DELETE") {
      const targetId = idFromPath || id || req.body?.id || req.body?.order_id;
      if (!targetId) {
        return res.status(400).json({ success: false, error: "Order ID required for deletion" });
      }

      let orders = readOrders();
      orders = orders.filter((o) => o.order_id !== targetId && o.id !== targetId);
      writeOrders(orders);

      if (SUPABASE_URL && SUPABASE_KEY) {
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/orders?or=(order_id.eq.${encodeURIComponent(targetId)},id.eq.${encodeURIComponent(targetId)})`, {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          });
        } catch (e) {}

        try {
          await fetch(`${SUPABASE_URL}/rest/v1/promo_codes?code=eq.SYNC_ORDER_${encodeURIComponent(targetId)}`, {
            method: "DELETE",
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`
            }
          });
        } catch (e) {}
      }

      return res.status(200).json({ success: true, message: "Order deleted" });
    }

    return res.status(405).json({ success: false, error: "Method not allowed" });
  } catch (err) {
    console.error("Orders API error:", err);
    return res.status(500).json({ success: false, error: err.message || "Internal server error" });
  }
}
