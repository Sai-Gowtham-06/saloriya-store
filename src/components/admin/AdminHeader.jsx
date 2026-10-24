import React from "react";
import { Link } from "react-router-dom";

export default function AdminHeader() {
  return (
    <header className="admin-header">
      <Link className="brand-link" to="/">
        <img src="/logo.png" alt="SALORIYA Logo" className="site-logo" />
        <span className="wordmark">
          SALORIYA<span>STORE ADMIN</span>
        </span>
      </Link>
      <Link to="/" style={{ fontSize: "13px", color: "var(--wine)", textDecoration: "none", fontWeight: 600 }}>
        ← View storefront
      </Link>
    </header>
  );
}
