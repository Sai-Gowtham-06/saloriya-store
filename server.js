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
  const { stock } = req.body;
  const products = readProductsFromFile();
  const idx = products.findIndex((p) => p.id === id || p.slug === id);

  if (idx !== -1) {
    products[idx].stock = Math.max(0, parseInt(stock, 10) || 0);
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
  const orders = readOrdersFromFile();
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
  console.log(`[Order API] New order registered: #${orderData.order_id} by ${orderData.customer_name}`);
  res.json({ success: true, order: orderData, ordersCount: orders.length });
});

app.put("/api/orders/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const orders = readOrdersFromFile();
  const idx = orders.findIndex((o) => o.order_id === id || o.id === id);

  if (idx !== -1) {
    orders[idx].status = status;
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
