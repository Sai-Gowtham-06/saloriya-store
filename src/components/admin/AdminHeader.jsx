import React from "react";
import { Link } from "react-router-dom";

export default function AdminHeader({ onLogout, isAuthenticated }) {
  return (
    <header className="admin-header">
      <Link className="brand-link" to="/">
        <img src="/logo.png" alt="SALORIYA Logo" className="site-logo" />
        <span className="wordmark">
          SALORIYA
          <span style={{ color: "var(--gold)" }}>BOUTIQUE ADMIN CONSOLE</span>
        </span>
      </Link>

      <div className="admin-header-actions" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
        <Link to="/" className="button" style={{ padding: "8px 14px", fontSize: "11px" }}>
          View Live Store ↗
        </Link>
        {isAuthenticated && (
          <button
            type="button"
            className="button"
            style={{ padding: "8px 14px", fontSize: "11px", background: "#f2dede", color: "#a94442", border: "1px solid #ebccd1" }}
            onClick={onLogout}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}
