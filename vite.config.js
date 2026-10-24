import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import sendOtpHandler from "./api/otp/send.js";
import verifyOtpHandler from "./api/otp/verify.js";

import fs from "fs";

function vercelApiDevPlugin() {
  const seedPath = resolve(process.cwd(), "src", "productsSeed.json");
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

          // GET /api/products
          if (req.method === "GET" && url === "/api/products") {
            const products = readProducts();
            return res.json({ success: true, products });
          }

          // PUT /api/products/:id/stock
          if (req.method === "PUT" && url.endsWith("/stock")) {
            const parts = url.split("/");
            const id = parts[parts.length - 2];
            const products = readProducts();
            const idx = products.findIndex((p) => p.id === id);
            if (idx === -1) return res.status(404).json({ success: false, error: "Product not found" });
            products[idx].stock = Math.max(0, parseInt(body.stock, 10) || 0);
            products[idx].updated_at = new Date().toISOString();
            writeProducts(products);
            return res.json({ success: true, product: products[idx] });
          }

          // PUT /api/products/:id/publish
          if (req.method === "PUT" && url.endsWith("/publish")) {
            const parts = url.split("/");
            const id = parts[parts.length - 2];
            const products = readProducts();
            const idx = products.findIndex((p) => p.id === id);
            if (idx === -1) return res.status(404).json({ success: false, error: "Product not found" });
            products[idx].is_published = Boolean(body.is_published);
            products[idx].updated_at = new Date().toISOString();
            writeProducts(products);
            return res.json({ success: true, product: products[idx] });
          }

          // DELETE /api/products/:id
          if (req.method === "DELETE") {
            const parts = url.split("/");
            const id = parts[parts.length - 1];
            let products = readProducts();
            const initLen = products.length;
            products = products.filter((p) => p.id !== id);
            if (products.length === initLen) return res.status(404).json({ success: false, error: "Product not found" });
            writeProducts(products);
            return res.json({ success: true, message: "Product deleted" });
          }

          // POST /api/products
          if (req.method === "POST" && url === "/api/products") {
            let products = readProducts();
            if (body.id) {
              const idx = products.findIndex((p) => p.id === body.id);
              if (idx !== -1) {
                products[idx] = { ...products[idx], ...body, updated_at: new Date().toISOString() };
              } else {
                products.unshift({ ...body, created_at: new Date().toISOString() });
              }
            } else {
              const newId = `prod_${Date.now()}`;
              products.unshift({ id: newId, ...body, created_at: new Date().toISOString() });
            }
            writeProducts(products);
            return res.json({ success: true, products });
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
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
        },
      },
    },
  };
});
