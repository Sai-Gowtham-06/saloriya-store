import React, { useState, useEffect, useRef } from "react";
import { useStore, getColourForImage } from "../../context/StoreContext";

export default function ProductPreviewModal() {
  const { previewProductId, closePreview, products, formatMoney, openCheckout, addToCart } = useStore();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [selectedColour, setSelectedColour] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const mainImgRef = useRef(null);

  const product = products.find((p) => p.id === previewProductId);

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product, selectedColour || "Standard", 1);
  };

  const zoomOut = () => {
    if (mainImgRef.current) {
      mainImgRef.current.style.transform = "scale(1)";
      mainImgRef.current.style.transformOrigin = "center center";
    }
    setIsZoomed(false);
  };

  const zoomIn = (x, y) => {
    if (mainImgRef.current) {
      mainImgRef.current.style.transformOrigin = `${x}% ${y}%`;
      mainImgRef.current.style.transform = "scale(2.1)";
    }
    setIsZoomed(true);
  };

  useEffect(() => {
    if (product) {
      setActivePhotoIdx(0);
      setSelectedColour(product.colours?.[0] || "Standard");
      zoomOut();
    }
  }, [product]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        zoomOut();
        closePreview();
      }
    };
    if (previewProductId) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.classList.add("modal-open");
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
      zoomOut();
    };
  }, [previewProductId]);

  if (!product) return null;

  const images = (Array.isArray(product.image_urls) && product.image_urls.length > 0)
    ? product.image_urls.filter((u) => u && u !== "/logo.png")
    : ((Array.isArray(product.images) && product.images.length > 0)
      ? product.images.filter((u) => u && u !== "/logo.png")
      : []);

  const activeImage = images[activePhotoIdx] || images[0] || "";
  const colours = Array.isArray(product.colours) ? product.colours : [];
  const isOutOfStock = (product.stock || 0) <= 0;
  const categoryName = product.category || "GOLD COVERING";

  const isTouchDevice = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(hover: none)").matches || window.matchMedia("(pointer: coarse)").matches;
  };

  const handleMouseMove = (e) => {
    // Disable disruptive hover zoom on touch devices
    if (isTouchDevice() || !mainImgRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (((e.clientX - rect.left) / rect.width) * 100).toFixed(1);
    const y = (((e.clientY - rect.top) / rect.height) * 100).toFixed(1);
    zoomIn(x, y);
  };

  const handleMouseLeave = () => {
    if (isTouchDevice()) return;
    zoomOut();
  };

  // Mobile Touch & Tap-to-Zoom handlers
  const handleImageClick = (e) => {
    if (isZoomed) {
      zoomOut();
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX ?? e.changedTouches?.[0]?.clientX;
      const clientY = e.clientY ?? e.changedTouches?.[0]?.clientY;
      if (clientX !== undefined && clientY !== undefined && rect.width > 0 && rect.height > 0) {
        const rawX = ((clientX - rect.left) / rect.width) * 100;
        const rawY = ((clientY - rect.top) / rect.height) * 100;
        const x = Math.max(10, Math.min(90, rawX)).toFixed(1);
        const y = Math.max(10, Math.min(90, rawY)).toFixed(1);
        zoomIn(x, y);
      } else {
        zoomIn(50, 50);
      }
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches && e.touches.length === 1 && isZoomed && mainImgRef.current) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const x = Math.max(10, Math.min(90, ((touch.clientX - rect.left) / rect.width) * 100)).toFixed(1);
        const y = Math.max(10, Math.min(90, ((touch.clientY - rect.top) / rect.height) * 100)).toFixed(1);
        zoomIn(x, y);
      }
    }
  };

  const handleColourClick = (colour, index) => {
    zoomOut();
    setSelectedColour(colour);
    const clean = colour.trim().toLowerCase();
    const matchedIdx = images.findIndex((url) => {
      try {
        return decodeURIComponent(url).toLowerCase().includes(clean);
      } catch {
        return false;
      }
    });
    if (matchedIdx !== -1) {
      setActivePhotoIdx(matchedIdx);
    } else if (images[index]) {
      setActivePhotoIdx(index);
    }
  };

  const handleThumbnailClick = (url, i) => {
    zoomOut();
    setActivePhotoIdx(i);
    const matched = getColourForImage(product, url, i);
    if (matched) {
      setSelectedColour(matched);
    }
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    zoomOut();
    const prevIdx = (activePhotoIdx - 1 + images.length) % images.length;
    setActivePhotoIdx(prevIdx);
    const matched = getColourForImage(product, images[prevIdx], prevIdx);
    if (matched) setSelectedColour(matched);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    zoomOut();
    const nextIdx = (activePhotoIdx + 1) % images.length;
    setActivePhotoIdx(nextIdx);
    const matched = getColourForImage(product, images[nextIdx], nextIdx);
    if (matched) setSelectedColour(matched);
  };

  const handleBuyNow = () => {
    zoomOut();
    closePreview();
    openCheckout(product, selectedColour);
  };

  const handleWhatsApp = () => {
    const colourText = selectedColour ? ` (Colour: ${selectedColour})` : "";
    const message = encodeURIComponent(
      `Hello SALORIYA! I am viewing *${product.name}*${colourText} priced at ${formatMoney(product.price_paise)} on your website and would love to order.`
    );
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleQuery = () => {
    const message = encodeURIComponent(
      `Hello SALORIYA! I have a question about ${product.name}:\nCould you please help me with sizing/custom options?`
    );
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div id="product-modal" className="product-modal" role="dialog" aria-modal="true">
      <div className="product-modal-backdrop" onClick={() => { zoomOut(); closePreview(); }}></div>
      <div className="product-modal-dialog">
        <button
          className="product-modal-close"
          onClick={() => { zoomOut(); closePreview(); }}
          aria-label="Close product preview"
        >
          ✕
        </button>

        <div id="product-modal-content" className="product-modal-content">
          <div className="modal-grid">
            {/* Left Column: Gallery & Interactive Zoom Lens */}
            <div className="modal-gallery">
              <div
                className={`modal-main-image-wrap ${isZoomed ? "is-zoomed" : ""}`}
                id="modal-image-wrap"
                title={isZoomed ? "Tap to zoom out back" : "Tap or hover to inspect details"}
                onClick={handleImageClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onTouchMove={handleTouchMove}
              >
                {activeImage ? (
                  <img
                    ref={mainImgRef}
                    id="modal-main-img"
                    className="modal-main-img"
                    src={activeImage}
                    alt={product.name}
                  />
                ) : (
                  <div className="image-placeholder">
                    <span>S</span>
                    <small>READY TO WEAR</small>
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="modal-nav-arrow prev"
                      onClick={handlePrevPhoto}
                      aria-label="Previous photo and colour"
                      title="Previous colour image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="modal-nav-arrow next"
                      onClick={handleNextPhoto}
                      aria-label="Next photo and colour"
                      title="Next colour image"
                    >
                      ›
                    </button>
                  </>
                )}

                <div
                  className={`modal-zoom-hint ${isZoomed ? "zoom-hint-active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isZoomed) zoomOut();
                    else zoomIn(50, 50);
                  }}
                  title={isZoomed ? "Tap to zoom out" : "Tap to zoom in"}
                >
                  <span>{isZoomed ? "🔍 Zoom Out ↩" : "🔍 Tap to Zoom"}</span>
                </div>
              </div>

              {images.length > 1 && (
                <div className="modal-thumbs" id="modal-thumbs">
                  {images.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`modal-thumb ${i === activePhotoIdx ? "active" : ""}`}
                      onClick={() => handleThumbnailClick(url, i)}
                      aria-label={`View photo ${i + 1}`}
                      title="Click to view this colour and photo"
                    >
                      <img src={url} alt={`${product.name} - photo ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Flipkart / Amazon Style Details */}
            <div className="modal-details">
              <div className="modal-breadcrumb">
                <span>SALORIYA</span> &rsaquo; <span>JEWELLERY</span> &rsaquo;{" "}
                <span className="modal-category">{categoryName}</span>
              </div>

              <h2 className="modal-title">
                {product.name}
                {selectedColour && selectedColour !== "Standard" && (
                  <span className="modal-title-colour-badge"> ({selectedColour})</span>
                )}
              </h2>

              <div className="modal-rating-row">
                <div className="modal-stars">★★★★★</div>
                <span className="modal-rating-text">4.9 / 5 · Handcrafted Polish</span>
                <span className="modal-verified-pill">✦ Boutique Quality</span>
              </div>

              <div className="modal-price-box">
                <div className="modal-price-line">
                  <span className="modal-price">{formatMoney(product.price_paise)}</span>
                  <span className="modal-tax-tag">Inclusive of all taxes</span>
                </div>
                {isOutOfStock ? (
                  <span className="modal-stock-badge out-of-stock">Currently Out of Stock</span>
                ) : (
                  <span className="modal-stock-badge in-stock">✓ Ready to Wear / In Stock</span>
                )}
                <div className="modal-tagline">
                  Direct artisan craft · Tarnish-resistant coating · Instant dispatch
                </div>
              </div>

              {colours.length > 0 && (
                <div className="modal-option-block">
                  <label className="modal-option-label">
                    Selected Colour:{" "}
                    <strong id="modal-chosen-colour" className="modal-selected-colour-highlight" key={selectedColour}>
                      {selectedColour}
                    </strong>
                  </label>
                  <div className="modal-colour-pills" id="modal-colour-pills">
                    {colours.map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        className={`modal-colour-pill ${c === selectedColour ? "active" : ""}`}
                        onClick={() => handleColourClick(c, i)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Product Highlights */}
              <div className="modal-highlights">
                <h4 className="modal-section-title">Product Highlights</h4>
                <ul className="modal-spec-list">
                  <li>
                    <strong>Craft &amp; Style:</strong> Premium 1-Gram Gold Covering &amp; Readymade Jewellery
                  </li>
                  <li>
                    <strong>Coating:</strong> Long-lasting micro-gold finish with protective tarnish barrier
                  </li>
                  <li>
                    <strong>Skin Comfort:</strong> 100% Nickel-free, lead-free &amp; hypoallergenic daily wear
                  </li>
                  <li>
                    <strong>Packaging:</strong> Safely secured in protective jewellery-grade box
                  </li>
                  <li>
                    <strong>Occasion:</strong> Perfect for festive, wedding, temple &amp; everyday elegance
                  </li>
                </ul>
              </div>

              {/* Description */}
              <div className="modal-description-section">
                <h4 className="modal-section-title">About this piece</h4>
                <p className="modal-description-text">
                  {product.description ||
                    "Designed with meticulous attention to detail, this SALORIYA piece captures the authentic grandeur of heirloom gold jewellery in a lightweight, ready-to-wear silhouette."}
                </p>
              </div>

              {/* Order & Enquiries Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cart-btn"
                  id="modal-cart-button"
                  disabled={isOutOfStock}
                  onClick={handleAddToCart}
                  title="Add to Shopping Bag"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                  <span>{isOutOfStock ? "Out of Stock" : "Add to Bag 👜"}</span>
                </button>

                <button
                  type="button"
                  className="modal-buy-direct-btn"
                  id="modal-buy-button"
                  disabled={isOutOfStock}
                  onClick={handleBuyNow}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                  <span>{isOutOfStock ? "Unavailable" : "Order Now"}</span>
                </button>

                <button
                  type="button"
                  className="modal-wa-btn"
                  id="modal-order-button"
                  disabled={isOutOfStock}
                  onClick={handleWhatsApp}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z" />
                  </svg>
                  <span>WhatsApp</span>
                </button>
              </div>

              <button type="button" className="modal-query-link" id="modal-query-btn" onClick={handleQuery}>
                Need custom sizing or have questions? Chat with our stylist
              </button>

              {/* Trust Bar */}
              <div className="modal-trust-bar">
                <div className="trust-item">
                  <span></span> Authentic Finish
                </div>
                <div className="trust-item">
                  <span></span> Direct Dispatch
                </div>
                <div className="trust-item">
                  <span></span> Verified Quality
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
