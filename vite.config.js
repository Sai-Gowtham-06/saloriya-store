import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import sendOtpHandler from "./api/otp/send.js";
import verifyOtpHandler from "./api/otp/verify.js";
import sendEmailOtpHandler from "./api/email-otp/send.js";
import verifyEmailOtpHandler from "./api/email-otp/verify.js";
import promosHandler from "./api/promos.js";
import fs from "fs";

function vercelApiDevPlugin() {
  const seedPath = resolve(process.cwd(), "src", "productsSeed.json");
  const ordersSeedPath = resolve(process.cwd(), "src", "ordersSeed.json");

  const readProducts = () => {
    try {
      if (fs.existsSync(seedPath)) {
        return JSON.parse(fs.readFileSync(seedPath, "utf8"));
      }
    } catch (e) {
      console.error("Vite API read error:", e);
    }
    return [];
  };
  const writeProducts = (prods) => {
    try {
      fs.writeFileSync(seedPath, JSON.stringify(prods, null, 2), "utf8");
      return true;
    } catch (e) {
      console.error("Vite API write error:", e);
      return false;
    }
  };

  const readOrders = () => {
    try {
      if (fs.existsSync(ordersSeedPath)) {
        return JSON.parse(fs.readFileSync(ordersSeedPath, "utf8"));
      }
    } catch (e) {
      console.error("Vite API read orders error:", e);
    }
    return [];
  };
  const writeOrders = (orders) => {
    try {
      fs.writeFileSync(ordersSeedPath, JSON.stringify(orders, null, 2), "utf8");
      return true;
    } catch (e) {
      console.error("Vite API write orders error:", e);
      return false;
    }
  };

  return {
    name: "vercel-api-dev-server",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split("?")[0];

        // Express/Vercel helper polyfill for local dev server
        res.status = function (code) {
          this.statusCode = code;
          return this;
        };
        res.json = function (obj) {
          this.setHeader("Content-Type", "application/json");
          this.end(JSON.stringify(obj));
          return this;
        };

        if (url.startsWith("/api/products")) {
          let body = {};
          if (req.method === "POST" || req.method === "PUT") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            try {
              body = JSON.parse(Buffer.concat(buffers).toString());
            } catch (e) {
              body = {};
            }
          }

          const sortProductsByColours = (list) => {
            if (!Array.isArray(list)) return [];
            const withColours = list.filter((p) => Array.isArray(p.colours) && p.colours.length > 0 && p.colours.some((c) => c && c.trim().toLowerCase() !== "standard"));
            const withoutColours = list.filter((p) => !Array.isArray(p.colours) || p.colours.length === 0 || !p.colours.some((c) => c && c.trim().toLowerCase() !== "standard"));
            return [...withColours, ...withoutColours];
          };

          // GET /api/products
          if (req.method === "GET" && url === "/api/products") {
            const products = sortProductsByColours(readProducts());
            return res.json({ success: true, products });
          }

          // PUT /api/products/:id/stock
          if (req.method === "PUT" && url.endsWith("/stock")) {
            const parts = url.split("/");
            const id = parts[parts.length - 2];
            const products = readProducts();
            const idx = products.findIndex((p) => p.id === id || p.slug === id);
            if (idx !== -1) {
              products[idx].stock = Math.max(0, parseInt(body.stock, 10) || 0);
              products[idx].updated_at = new Date().toISOString();
              writeProducts(products);
              return res.json({ success: true, product: products[idx] });
            }
            return res.json({ success: true, message: "Stock updated" });
          }

          // PUT /api/products/:id/publish
          if (req.method === "PUT" && url.endsWith("/publish")) {
            const parts = url.split("/");
            const id = parts[parts.length - 2];
            const products = readProducts();
            const idx = products.findIndex((p) => p.id === id || p.slug === id);
            if (idx !== -1) {
              products[idx].is_published = Boolean(body.is_published);
              products[idx].updated_at = new Date().toISOString();
              writeProducts(products);
              return res.json({ success: true, product: products[idx] });
            }
            return res.json({ success: true, message: "Publish status updated" });
          }

          // DELETE /api/products/:id
          if (req.method === "DELETE") {
            const parts = url.split("/");
            const id = parts[parts.length - 1];
            let products = readProducts();
            products = products.filter((p) => p.id !== id && p.slug !== id);
            writeProducts(products);
            return res.json({ success: true, message: "Product deleted" });
          }

          // POST /api/products
          if (req.method === "POST" && url === "/api/products") {
            let products = readProducts();
            const targetId = body.id;
            const targetSlug = body.slug;
            const idx = products.findIndex((p) => (targetId && p.id === targetId) || (targetSlug && p.slug === targetSlug));
            if (idx !== -1) {
              products[idx] = { ...products[idx], ...body, updated_at: new Date().toISOString() };
            } else {
              const newId = targetId || `prod_${Date.now()}`;
              products.unshift({ ...body, id: newId, created_at: new Date().toISOString() });
            }
            const sortedProds = sortProductsByColours(products);
            writeProducts(sortedProds);
            return res.json({ success: true, products: sortedProds });
          }
        }

        if (url.startsWith("/api/orders")) {
          let body = {};
          if (req.method === "POST" || req.method === "PUT") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            try {
              body = JSON.parse(Buffer.concat(buffers).toString());
            } catch (e) {
              body = {};
            }
          }

          // GET /api/orders
          if (req.method === "GET" && url === "/api/orders") {
            const orders = readOrders();
            return res.json({ success: true, orders });
          }

          // POST /api/orders
          if (req.method === "POST" && url === "/api/orders") {
            if (!body || !body.order_id) {
              return res.status(400).json({ success: false, error: "Invalid order payload" });
            }
            const orders = readOrders();
            const existingIdx = orders.findIndex(
              (o) => (o.order_id && o.order_id === body.order_id) || (o.id && o.id === body.id)
            );
            if (existingIdx !== -1) {
              orders[existingIdx] = { ...orders[existingIdx], ...body };
            } else {
              orders.unshift(body);
            }
            writeOrders(orders);
            return res.json({ success: true, order: body, ordersCount: orders.length });
          }

          // PUT /api/orders/:id/status
          if (req.method === "PUT" && url.endsWith("/status")) {
            const parts = url.split("/");
            const id = parts[parts.length - 2];
            const orders = readOrders();
            const idx = orders.findIndex((o) => o.order_id === id || o.id === id);
            if (idx !== -1) {
              orders[idx].status = body.status;
              orders[idx].updated_at = new Date().toISOString();
              writeOrders(orders);
              return res.json({ success: true, order: orders[idx] });
            }
            return res.status(404).json({ success: false, message: "Order not found" });
          }

          // DELETE /api/orders/:id
          if (req.method === "DELETE") {
            const parts = url.split("/");
            const id = parts[parts.length - 1];
            let orders = readOrders();
            orders = orders.filter((o) => o.order_id !== id && o.id !== id);
            writeOrders(orders);
            return res.json({ success: true, message: "Order deleted" });
          }
        }

        if (url === "/api/otp/send" || url === "/api/otp/verify") {
          let body = {};
          if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const raw = Buffer.concat(buffers).toString();
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }
          }
          req.body = body;

          if (url === "/api/otp/send") {
            return sendOtpHandler(req, res);
          } else {
            return verifyOtpHandler(req, res);
          }
        }

        if (url === "/api/email-otp/send" || url === "/api/email-otp/verify") {
          let body = {};
          if (req.method === "POST") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const raw = Buffer.concat(buffers).toString();
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }
          }
          req.body = body;

          if (url === "/api/email-otp/send") {
            return sendEmailOtpHandler(req, res);
          } else {
            return verifyEmailOtpHandler(req, res);
          }
        }

        if (url.startsWith("/api/promos")) {
          let body = {};
          if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
            const buffers = [];
            for await (const chunk of req) {
              buffers.push(chunk);
            }
            const raw = Buffer.concat(buffers).toString();
            try {
              body = JSON.parse(raw);
            } catch (e) {
              body = {};
            }
          }
          req.body = body;
          const query = {};
          const queryString = req.url.includes("?") ? req.url.split("?")[1] : "";
          if (queryString) {
            new URLSearchParams(queryString).forEach((val, key) => {
              query[key] = val;
            });
          }
          req.query = query;
          return promosHandler(req, res);
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, env);

  return {
    plugins: [react(), vercelApiDevPlugin()],
    server: {
      port: 5173,
      watch: {
        ignored: [
          "**/src/productsSeed.json",
          "**/productsSeed.json",
          resolve(__dirname, "src/productsSeed.json"),
          "**/src/ordersSeed.json",
          "**/ordersSeed.json",
          resolve(__dirname, "src/ordersSeed.json"),
          "**/src/promosSeed.json",
          "**/promosSeed.json",
          resolve(__dirname, "src/promosSeed.json")
        ]
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          admin: resolve(__dirname, "admin.html"),
        },
      },
    },
  };
});
