import React from "react";
import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer>
      <Link className="brand-link" to="/" id="footer-brand-logo" title="SALORIYA — Where Elegance Meets Women">
        <img src="/logo.png" alt="SALORIYA Logo" className="footer-logo" />
        <span className="wordmark">
          SALORIYA
          <span>GOLD COVERING &amp; READYMADE</span>
        </span>
      </Link>
      <p>Where Elegance Meets Women. © {new Date().getFullYear()} SALORIYA</p>
    </footer>
  );
}
