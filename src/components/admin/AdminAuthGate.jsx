import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminAuthGate({ onLoginSuccess }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Accepted fallback management usernames and passwords if offline or local testing
  const FALLBACK_USERS = ["admin", "saloriya", "saloriya_admin", "saloriyaofficial@gmail.com"];
  const FALLBACK_PASSWORDS = ["saloriya2026", "admin123"];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const cleanUser = userId.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setError("Please enter your User ID or admin email.");
      return;
    }

    if (!cleanPass) {
      setError("Please enter your admin password.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authenticate with Supabase Authentication as configured in Supabase
      if (isSupabaseConfigured) {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email: cleanUser,
          password: cleanPass
        });

        if (!sbError && data?.session) {
          sessionStorage.setItem("saloriya_admin_auth", "true");
          sessionStorage.setItem("saloriya_admin_user", data.session.user?.email || cleanUser);
          onLoginSuccess();
          return;
        }

        // 2. If Supabase fails, check fallback master credentials for offline resilience
        if (
          FALLBACK_USERS.includes(cleanUser.toLowerCase()) &&
          FALLBACK_PASSWORDS.includes(cleanPass)
        ) {
          sessionStorage.setItem("saloriya_admin_auth", "true");
          sessionStorage.setItem("saloriya_admin_user", cleanUser);
          onLoginSuccess();
          return;
        }

        setError(sbError?.message || "Invalid User ID or password. Please check your Supabase credentials.");
        return;
      }

      // If Supabase is not configured, authenticate against local master credentials
      if (
        FALLBACK_USERS.includes(cleanUser.toLowerCase()) &&
        FALLBACK_PASSWORDS.includes(cleanPass)
      ) {
        sessionStorage.setItem("saloriya_admin_auth", "true");
        sessionStorage.setItem("saloriya_admin_user", cleanUser);
        onLoginSuccess();
      } else {
        setError("Invalid User ID or password. Please verify your credentials.");
      }
    } catch (err) {
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
        {/* Emblem Badge with luxury gold ring */}
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
          SECURE ADMIN PORTAL
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
          SALORIYA Admin Login
        </h2>
        <p
          style={{
            fontSize: "13px",
            color: "var(--muted)",
            margin: "0 0 26px",
            lineHeight: "1.55"
          }}
        >
          Enter your User ID and management password to access orders, stock monitoring, and promo codes.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {/* User ID Field */}
          <div style={{ textAlign: "left", marginBottom: "16px" }}>
            <label
              htmlFor="admin-userid-input"
              style={{
                display: "block",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}
            >
              User ID / Admin Username
            </label>

            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                width: "100%"
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  color: "#cf9c4e",
                  fontSize: "14px",
                  pointerEvents: "none",
                  display: "grid",
                  placeItems: "center"
                }}
              >
                👤
              </span>

              <input
                id="admin-userid-input"
                type="text"
                autoFocus
                autoComplete="username"
                placeholder="e.g. admin or saloriya"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  setError("");
                }}
                className="admin-login-input"
                style={{
                  width: "100%",
                  height: "46px",
                  padding: "0 16px 0 40px",
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
            </div>
          </div>

          {/* Password Field */}
          <div style={{ textAlign: "left", marginBottom: "18px" }}>
            <label
              htmlFor="admin-password-input"
              style={{
                display: "block",
                fontSize: "11.5px",
                fontWeight: 700,
                color: "var(--ink)",
                marginBottom: "6px",
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
              <span
                style={{
                  position: "absolute",
                  left: "14px",
                  color: "#cf9c4e",
                  fontSize: "14px",
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
                autoComplete="current-password"
                placeholder="Enter password…"
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

              {/* Show/Hide Password Eye Toggle */}
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
            {isSubmitting ? "Signing In…" : "Sign In to Admin Console "}
          </button>
        </form>

        <div style={{ marginTop: "22px", paddingTop: "16px", borderTop: "1px solid var(--line-subtle)" }}>
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
