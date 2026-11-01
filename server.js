import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sendOtpHandler from "./api/otp/send.js";
import verifyOtpHandler from "./api/otp/verify.js";
import sendEmailOtpHandler from "./api/email-otp/send.js";
import verifyEmailOtpHandler from "./api/email-otp/verify.js";
import promosHandler from "./api/promos.js";

// Load environment variables from .env and .env.local
dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Request logging
app.use((req, res, next) => {
  if (req.url.startsWith("/api")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SALORIYA Node.js Express Backend",
    timestamp: Date.now(),
    env: process.env.NODE_ENV || "development"
  });
});

// Product Management API Endpoints
const productsFilePath = path.resolve(__dirname, "src", "productsSeed.json");
const ordersFilePath = path.resolve(__dirname, "src", "ordersSeed.json");

function readProductsFromFile() {
  try {
    if (fs.existsSync(productsFilePath)) {
      const content = fs.readFileSync(productsFilePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to read products file:", err);
  }
  return [];
}

function writeProductsToFile(products) {
  try {
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write products file:", err);
    return false;
  }
}

function readOrdersFromFile() {
  try {
    if (fs.existsSync(ordersFilePath)) {
      const content = fs.readFileSync(ordersFilePath, "utf8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to read orders file:", err);
  }
  return [];
}

function writeOrdersToFile(orders) {
  try {
    fs.writeFileSync(ordersFilePath, JSON.stringify(orders, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write orders file:", err);
    return false;
  }
}

function sortProductsByColours(list) {
  if (!Array.isArray(list)) return [];
  const withColours = list.filter((p) => Array.isArray(p.colours) && p.colours.length > 0 && p.colours.some((c) => c && c.trim().toLowerCase() !== "standard"));
  const withoutColours = list.filter((p) => !Array.isArray(p.colours) || p.colours.length === 0 || !p.colours.some((c) => c && c.trim().toLowerCase() !== "standard"));
  return [...withColours, ...withoutColours];
}

app.get("/api/products", (req, res) => {
  const products = sortProductsByColours(readProductsFromFile());
  res.json({ success: true, products });
});

app.put("/api/products/:id/stock", (req, res) => {
  const { id } = req.params;
  const { stock, colour_stocks, colour, colourStock } = req.body;
  const products = readProductsFromFile();
  const idx = products.findIndex((p) => p.id === id || p.slug === id);

  if (idx !== -1) {
    if (colour_stocks && typeof colour_stocks === "object") {
      products[idx].colour_stocks = { ...(products[idx].colour_stocks || {}), ...colour_stocks };
      products[idx].stock = Object.values(products[idx].colour_stocks).reduce(
        (sum, v) => sum + (Math.max(0, parseInt(v, 10) || 0)),
        0
      );
    } else if (colour && colourStock !== undefined) {
      products[idx].colour_stocks = {
        ...(products[idx].colour_stocks || {}),
        [colour]: Math.max(0, parseInt(colourStock, 10) || 0)
      };
      products[idx].stock = Object.values(products[idx].colour_stocks).reduce(
        (sum, v) => sum + (Math.max(0, parseInt(v, 10) || 0)),
        0
      );
    } else if (stock !== undefined) {
      products[idx].stock = Math.max(0, parseInt(stock, 10) || 0);
    }
    products[idx].updated_at = new Date().toISOString();
    writeProductsToFile(products);
    return res.json({ success: true, product: products[idx] });
  }

  res.json({ success: true, message: "Stock updated" });
});

app.put("/api/products/:id/publish", (req, res) => {
  const { id } = req.params;
  const { is_published } = req.body;
  const products = readProductsFromFile();
  const idx = products.findIndex((p) => p.id === id || p.slug === id);

  if (idx !== -1) {
    products[idx].is_published = Boolean(is_published);
    products[idx].updated_at = new Date().toISOString();
    writeProductsToFile(products);
    return res.json({ success: true, product: products[idx] });
  }

  res.json({ success: true, message: "Publish status updated" });
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  let products = readProductsFromFile();
  products = products.filter((p) => p.id !== id && p.slug !== id);
  writeProductsToFile(products);
  res.json({ success: true, message: "Product deleted" });
});

app.post("/api/products", (req, res) => {
  const productData = req.body;
  let products = readProductsFromFile();
  const targetId = productData.id;
  const targetSlug = productData.slug;
  const idx = products.findIndex((p) => (targetId && p.id === targetId) || (targetSlug && p.slug === targetSlug));

  if (idx !== -1) {
    products[idx] = { ...products[idx], ...productData, updated_at: new Date().toISOString() };
  } else {
    const newId = targetId || `prod_${Date.now()}`;
    products.unshift({ ...productData, id: newId, created_at: new Date().toISOString() });
  }

  const sortedProducts = sortProductsByColours(products);
  writeProductsToFile(sortedProducts);
  res.json({ success: true, products: sortedProducts });
});

// Orders Management API Endpoints (Multi-device synchronization)
app.get("/api/orders", (req, res) => {
  const orders = readOrdersFromFile().sort(
    (a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()
  );
  res.json({ success: true, orders });
});

app.post("/api/orders", (req, res) => {
  const orderData = req.body;
  if (!orderData || !orderData.order_id) {
    return res.status(400).json({ success: false, error: "Invalid order payload" });
  }
  const orders = readOrdersFromFile();
  const existingIdx = orders.findIndex(
    (o) => (o.order_id && o.order_id === orderData.order_id) || (o.id && o.id === orderData.id)
  );

  if (existingIdx !== -1) {
    orders[existingIdx] = { ...orders[existingIdx], ...orderData };
  } else {
    orders.unshift(orderData);
  }

  writeOrdersToFile(orders);

  // Automatically deduct stock in products file when an order is created
  try {
    const products = readProductsFromFile();
    const itemsToDeduct = Array.isArray(orderData.items) && orderData.items.length > 0
      ? orderData.items
      : [{
          product_id: orderData.product_id,
          variant_colour: orderData.variant_colour || "Standard",
          quantity: orderData.quantity || 1
        }];

    let changed = false;
    itemsToDeduct.forEach((item) => {
      const pId = item.product_id;
      const cName = (item.variant_colour || "Standard").trim();
      const q = Math.max(1, parseInt(item.quantity, 10) || 1);
      const pIdx = products.findIndex((p) => p.id === pId || p.slug === pId);
      if (pIdx !== -1) {
        const prod = products[pIdx];
        if (prod.colour_stocks && typeof prod.colour_stocks === "object") {
          const matchedKey = Object.keys(prod.colour_stocks).find(
            (k) => k.toLowerCase() === cName.toLowerCase()
          );
          if (matchedKey) {
            prod.colour_stocks[matchedKey] = Math.max(0, (prod.colour_stocks[matchedKey] || 0) - q);
            prod.stock = Object.values(prod.colour_stocks).reduce((sum, v) => sum + (Math.max(0, parseInt(v, 10) || 0)), 0);
            changed = true;
          } else {
            prod.stock = Math.max(0, (prod.stock || 0) - q);
            changed = true;
          }
        } else {
          prod.stock = Math.max(0, (prod.stock || 0) - q);
          changed = true;
        }
      }
    });

    if (changed) {
      writeProductsToFile(products);
    }
  } catch (err) {
    console.error("Order stock deduction error in server.js:", err);
  }

  console.log(`[Order API] New order registered: #${orderData.order_id} by ${orderData.customer_name}`);
  res.json({ success: true, order: orderData, ordersCount: orders.length });
});

app.put(["/api/orders/:id/status", "/api/orders/:id"], (req, res) => {
  const { id } = req.params;
  const status = req.body?.status || req.body?.order_status;
  if (!status) {
    return res.status(400).json({ success: false, error: "Missing status in request body" });
  }
  const orders = readOrdersFromFile();
  const idx = orders.findIndex((o) => o.order_id === id || o.id === id);

  if (idx !== -1) {
    orders[idx].status = status;
    orders[idx].order_status = status;
    orders[idx].updated_at = new Date().toISOString();
    writeOrdersToFile(orders);
    return res.json({ success: true, order: orders[idx] });
  }

  res.status(404).json({ success: false, message: "Order not found" });
});

app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  let orders = readOrdersFromFile();
  orders = orders.filter((o) => o.order_id !== id && o.id !== id);
  writeOrdersToFile(orders);
  res.json({ success: true, message: "Order deleted" });
});

// OTP Endpoints
app.post("/api/otp/send", sendOtpHandler);
app.post("/api/otp/verify", verifyOtpHandler);
app.post("/api/email-otp/send", sendEmailOtpHandler);
app.post("/api/email-otp/verify", verifyEmailOtpHandler);

// Promos Endpoint
app.all("/api/promos*", (req, res) => {
  return promosHandler(req, res);
});

// Serve frontend in production build
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "dist");
  app.use(express.static(distPath));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(` SALORIYA Express Backend running on http://localhost:${PORT}`);
});

export default app;
