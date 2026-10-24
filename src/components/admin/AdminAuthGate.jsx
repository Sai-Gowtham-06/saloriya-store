import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function AdminAuthGate({ onLoginSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Please enter your admin security password.");
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      if (password === "saloriya2026" || password === "admin123") {
        onLoginSuccess();
      } else {
        setError("Incorrect management password. Please try again.");
        setIsSubmitting(false);
      }
    }, 200);
  };

  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px"
      }}
    >
      <div
        className="admin-login-card"
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "20px",
          border: "1.5px solid rgba(207, 156, 78, 0.35)",
          boxShadow: "0 18px 45px -10px rgba(100, 19, 39, 0.09), 0 4px 16px rgba(0, 0, 0, 0.03)",
          padding: "40px 36px",
          textAlign: "center",
          boxSizing: "border-box"
        }}
      >
        {/* Emblem Badge with subtle luxury ring */}
        <div
          style={{
            width: "82px",
            height: "82px",
            margin: "0 auto 16px",
            borderRadius: "50%",
            padding: "4px",
            background: "linear-gradient(135deg, #faede6, #fdf6f2)",
            border: "1.5px solid rgba(207, 156, 78, 0.4)",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 6px 18px rgba(134, 30, 56, 0.08)"
          }}
        >
          <img
            src="/logo.png"
            alt="SALORIYA Emblem"
            style={{ width: "70px", height: "70px", objectFit: "contain", borderRadius: "50%" }}
          />
        </div>

        <span
          style={{
            display: "inline-block",
            fontSize: "10.5px",
            fontWeight: 800,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: "var(--wine)",
            background: "var(--wine-light)",
            border: "1px solid rgba(134, 30, 56, 0.15)",
            padding: "4px 12px",
            borderRadius: "16px",
            marginBottom: "10px"
          }}
        >
          ADMIN ACCESS
        </span>

        <h2
          style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "26px",
            fontWeight: 700,
            color: "var(--wine-dark)",
            margin: "0 0 6px"
          }}
        >
          SALORIYA Admin Portal
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--muted)",
            margin: "0 0 28px",
            lineHeight: "1.55"
          }}
        >
          Enter your boutique management password to access orders, live inventory, and promo codes.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ textAlign: "left", marginBottom: "18px" }}>
            <label
              htmlFor="admin-password-input"
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              Admin Security Password
            </label>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%"
              }}
            >
              {/* Left Lock Icon */}
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  color: "#cf9c4e",
                  fontSize: "15px",
                  pointerEvents: "none",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                🔒
              </span>

              <input
                id="admin-password-input"
                type={showPassword ? "text" : "password"}
                autoFocus
                placeholder="Enter management password…"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className="admin-login-input"
                style={{
                  width: "100%",
                  height: "46px",
                  padding: "0 44px 0 40px",
                  fontSize: "14px",
                  color: "var(--ink)",
                  background: "#faf6f4",
                  border: error ? "1.5px solid #dc2626" : "1.5px solid #e5d7ce",
                  borderRadius: "10px",
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s"
                }}
              />

              {/* Show/Hide Password Eye Button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "16px",
                  color: "var(--muted)",
                  padding: "6px",
                  display: "grid",
                  placeItems: "center",
                  lineHeight: 1
                }}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: "12.5px",
                fontWeight: 600,
                borderRadius: "8px",
                padding: "9px 14px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                textAlign: "left"
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            id="admin-unlock-btn"
            type="submit"
            className="button button-gold"
            disabled={isSubmitting}
            style={{
              width: "100%",
              height: "48px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13.5px",
              fontWeight: 800,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              borderRadius: "10px",
              boxShadow: "0 4px 14px rgba(207, 156, 78, 0.28)",
              cursor: isSubmitting ? "not-allowed" : "pointer"
            }}
          >
            {isSubmitting ? "Unlocking Portal…" : "Unlock Management Console ↗"}
          </button>
        </form>

        <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line-subtle)" }}>
          <Link
            to="/"
            style={{
              fontSize: "12.5px",
              color: "var(--muted)",
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "color 0.2s"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--wine)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
          >
            ← Return to Boutique Storefront
          </Link>
        </div>
      </div>
    </div>
  );
}
