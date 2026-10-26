import React from "react";

export default function ContactSection() {
  return (
    <section className="contact" id="contact">
      <div className="contact-card">
        <p className="eyebrow">LET'S CONNECT</p>
        <h2>Looking for a combo or custom size?</h2>
        <p className="contact-desc">
          Need help with bracelet sizing, chain lengths, colour availability, or gift orders? Reach out directly through any of our channels below.
        </p>

        <div className="contact-grid">
          <a
            className="contact-item contact-whatsapp"
            href="https://wa.me/918680824598?text=Hello%20SALORIYA!%20I'd%20like%20to%20enquire%20about%20your%20jewellery%20collection."
            target="_blank"
            rel="noreferrer"
          >
            <div className="contact-icon-box whatsapp-icon-box">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z"/>
              </svg>
            </div>
            <div className="contact-text">
              <span className="contact-label">WhatsApp Concierge</span>
              <span className="contact-value">Chat with Us</span>
            </div>
            <span className="contact-arrow"></span>
          </a>

          <a
            className="contact-item"
            href="https://www.instagram.com/saloriya_off?dlrf=enVmYjhhMTc1Y2tz"
            target="_blank"
            rel="noreferrer"
          >
            <div className="contact-icon-box">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </div>
            <div className="contact-text">
              <span className="contact-label">Instagram</span>
              <span className="contact-value">@saloriya_off</span>
            </div>
            <span className="contact-arrow"></span>
          </a>

          <a className="contact-item" href="mailto:Saloriyaofficial@gmail.com">
            <div className="contact-icon-box">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
            </div>
            <div className="contact-text">
              <span className="contact-label">Email Support</span>
              <span className="contact-value">Saloriyaofficial@gmail.com</span>
            </div>
            <span className="contact-arrow"></span>
          </a>
        </div>
      </div>
    </section>
  );
}
