import React from "react";
import { Link } from "react-router-dom";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand-link" to="/">
        <img src="/logo.png" alt="SALORIYA Logo" className="site-logo" />
        <span className="wordmark">
          SALORIYA
          <span>GOLD COVERING &amp; READYMADE</span>
        </span>
      </Link>
      <nav>
        <a href="#shop">Shop Collection</a>
        <a href="#story">Our story</a>
        <a href="#contact">Contact</a>
        <Link to="/admin" style={{ opacity: 0.8, fontSize: "11px" }}>
          Admin
        </Link>
      </nav>
      <a className="bag-link" href="#shop">
        Explore collection ↗
      </a>
    </header>
  );
}
