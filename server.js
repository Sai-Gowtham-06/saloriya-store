import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import sendOtpHandler from "./api/otp/send.js";
import verifyOtpHandler from "./api/otp/verify.js";

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

// OTP API Endpoints
app.post("/api/otp/send", async (req, res) => {
  try {
    await sendOtpHandler(req, res);
  } catch (err) {
    console.error("Express /api/otp/send error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.post("/api/otp/verify", async (req, res) => {
  try {
    await verifyOtpHandler(req, res);
  } catch (err) {
    console.error("Express /api/otp/verify error:", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
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
  console.log(`✨ SALORIYA Express Backend running on http://localhost:${PORT}`);
});

export default app;
