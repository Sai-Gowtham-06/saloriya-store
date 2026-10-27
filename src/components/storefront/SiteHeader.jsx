import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../context/StoreContext";

export default function SiteHeader() {
  const { cartCount, openCart } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isMenuOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setIsMenuOpen(false);
    }
    if (isMenuOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  const handleLinkClick = () => {
    setIsMenuOpen(false);
  };

  return (
    <header className="site-header">
      <Link className="brand-link" to="/">
        <img src="/logo.png" alt="SALORIYA Logo" className="site-logo" />
        <span className="wordmark">
          SALORIYA
          <span>GOLD COVERING &amp; READYMADE</span>
        </span>
      </Link>

      <div className="header-right-actions" ref={menuRef}>
        {/* Tagline wording beside the hamburger menu icon */}
        <span className="header-tagline-wording">Where Elegance Meets Women</span>

        {/* Cart Bag Icon Button */}
        <button
          type="button"
          className="header-cart-btn"
          onClick={openCart}
          aria-label={`Shopping Bag with ${cartCount} items`}
          title="View Shopping Bag"
        >
          <span className="header-cart-icon">👜</span>
          <span className="header-cart-label">Bag</span>
          {cartCount > 0 && <span className="header-cart-badge">{cartCount}</span>}
        </button>

        {/* Three-line Hamburger Menu Button in the Right Corner */}
        <button
          type="button"
          className={`hamburger-menu-btn ${isMenuOpen ? "active" : ""}`}
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-label={isMenuOpen ? "Close menu" : "Open navigation menu"}
          aria-expanded={isMenuOpen}
        >
          <span className="hamburger-line line-1"></span>
          <span className="hamburger-line line-2"></span>
          <span className="hamburger-line line-3"></span>
        </button>

        {/* Dropdown Navigation Menu */}
        {isMenuOpen && (
          <nav className="header-dropdown-menu" aria-label="Main Navigation">
            <div className="dropdown-menu-header">
              <span className="dropdown-brand-title">SALORIYA</span>
              <button
                type="button"
                className="dropdown-close-btn"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <div className="dropdown-links-list">
              <button
                type="button"
                className="dropdown-link"
                style={{
                  background: "none",
                  border: "none",
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
                onClick={() => {
                  setIsMenuOpen(false);
                  openCart();
                }}
              >
                <span className="link-icon">👜</span>
                <span className="link-text">Shopping Bag ({cartCount})</span>
              </button>
              <a href="#shop" className="dropdown-link" onClick={handleLinkClick}>
                <span className="link-icon"></span>
                <span className="link-text">Shop Collection</span>
              </a>
              <a href="#story" className="dropdown-link" onClick={handleLinkClick}>
                <span className="link-icon"></span>
                <span className="link-text">Our story</span>
              </a>
              <a href="#contact" className="dropdown-link" onClick={handleLinkClick}>
                <span className="link-icon"></span>
                <span className="link-text">Contact</span>
              </a>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
