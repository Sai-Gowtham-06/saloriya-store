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

app.get("/api/products", (req, res) => {
  const products = readProductsFromFile();
  res.json({ success: true, products });
});

app.put("/api/products/:id/stock", (req, res) => {
  const { id } = req.params;
  const { stock } = req.body;
  const products = readProductsFromFile();
  const idx = products.findIndex((p) => p.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  products[idx].stock = Math.max(0, parseInt(stock, 10) || 0);
  products[idx].updated_at = new Date().toISOString();
  writeProductsToFile(products);

  res.json({ success: true, product: products[idx] });
});

app.put("/api/products/:id/publish", (req, res) => {
  const { id } = req.params;
  const { is_published } = req.body;
  const products = readProductsFromFile();
  const idx = products.findIndex((p) => p.id === id);

  if (idx === -1) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  products[idx].is_published = Boolean(is_published);
  products[idx].updated_at = new Date().toISOString();
  writeProductsToFile(products);

  res.json({ success: true, product: products[idx] });
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  let products = readProductsFromFile();
  const initialLength = products.length;
  products = products.filter((p) => p.id !== id);

  if (products.length === initialLength) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }

  writeProductsToFile(products);
  res.json({ success: true, message: "Product deleted" });
});

app.post("/api/products", (req, res) => {
  const productData = req.body;
  let products = readProductsFromFile();

  if (productData.id) {
    const idx = products.findIndex((p) => p.id === productData.id);
    if (idx !== -1) {
      products[idx] = { ...products[idx], ...productData, updated_at: new Date().toISOString() };
    } else {
      products.unshift({ ...productData, created_at: new Date().toISOString() });
    }
  } else {
    const newId = `prod_${Date.now()}`;
    products.unshift({ id: newId, ...productData, created_at: new Date().toISOString() });
  }

  writeProductsToFile(products);
  res.json({ success: true, products });
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
  console.log(`✨ SALORIYA Express Backend running on http://localhost:${PORT}`);
});

export default app;
