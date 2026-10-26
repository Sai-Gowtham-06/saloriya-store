import React from "react";

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">PREMIUM GOLD COVERING &amp; READYMADE</p>
        <h1>
          All the shine.<br />
          <em>Ready to wear.</em>
        </h1>
        <p className="hero-intro">
          High-finish 1-gram gold covering jewellery, trending earring &amp; chain combos, bracelets, and readymade designs crafted for daily elegance and grand occasions.
        </p>
        <a className="button button-dark" href="#shop">
          Explore our collection <span></span>
        </a>
        <p className="hero-note">Rich gold finish · Non-allergic · Everyday friendly prices</p>
      </div>
      <div className="hero-art">
        <div className="hero-orbit orbit-one"></div>
        <div className="hero-orbit orbit-two"></div>
        <div className="hero-sun"></div>
        <div className="hero-caption">
          READYMADE ELEGANCE<br />
          <strong>GOLD COVERING &amp; COMBOS</strong>
        </div>
        <img src="/logo.png" alt="SALORIYA Emblem" className="hero-emblem" />
      </div>
    </section>
  );
}
