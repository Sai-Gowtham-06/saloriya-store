import React, { useState } from "react";

export default function AdminAuthGate({ onLoginSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === "saloriya2026" || password === "admin123") {
      onLoginSuccess();
    } else {
      setError("Incorrect management password. Please try again.");
    }
  };

  return (
    <div className="admin-wrap" style={{ maxWidth: "480px", margin: "60px auto", padding: "20px" }}>
      <div className="admin-panel" style={{ textAlign: "center" }}>
        <img src="/logo.png" alt="SALORIYA Emblem" style={{ width: "72px", height: "72px", margin: "0 auto 16px" }} />
        <h2 style={{ fontFamily: "Playfair Display, serif", fontSize: "24px", color: "var(--wine-dark)", margin: "0 0 8px" }}>
          SALORIYA Admin Portal
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", margin: "0 0 24px" }}>
          Enter your boutique management password to access orders, inventory, and promo codes.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ textAlign: "left", display: "block" }}>
            Admin Security Password
            <input
              type="password"
              required
              autoFocus
              placeholder="Enter password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              style={{ marginTop: "6px" }}
            />
          </label>

          {error && <p style={{ color: "#dc2626", fontSize: "12px", margin: "8px 0 0" }}>{error}</p>}

          <button
            type="submit"
            className="button button-gold"
            style={{ width: "100%", padding: "12px", marginTop: "16px", fontSize: "13px" }}
          >
            Unlock Management Console 🔓
          </button>
        </form>
      </div>
    </div>
  );
}
