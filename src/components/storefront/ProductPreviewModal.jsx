import React, { useState, useEffect } from "react";
import { useStore } from "../../context/StoreContext";

export default function ProductPreviewModal() {
  const { previewProductId, closePreview, products, formatMoney, openCheckout } = useStore();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [selectedColour, setSelectedColour] = useState("");

  const product = products.find((p) => p.id === previewProductId);

  useEffect(() => {
    if (product) {
      setActivePhotoIdx(0);
      setSelectedColour(product.colours?.[0] || "Standard");
    }
  }, [product]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") closePreview();
    };
    if (previewProductId) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.classList.add("modal-open");
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [previewProductId]);

  if (!product) return null;

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : ["/logo.png"];

  const activeImage = images[activePhotoIdx] || images[0];
  const colours = Array.isArray(product.colours) ? product.colours : [];
  const isOutOfStock = (product.stock || 0) <= 0;

  const handleWhatsApp = () => {
    const message = encodeURIComponent(
      `Hello SALORIYA! I am viewing *${product.name}* (Colour: ${selectedColour}) priced at ${formatMoney(product.price_paise)} on your website and would love to order.`
    );
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleOrder = () => {
    closePreview();
    openCheckout(product, selectedColour);
  };

  return (
    <div className="product-modal" role="dialog" aria-modal="true">
      <div className="product-modal-backdrop" onClick={closePreview}></div>
      <div className="product-modal-dialog">
        <button className="product-modal-close" onClick={closePreview} aria-label="Close product preview">
          ✕
        </button>
        <div className="product-modal-content">
          <div className="modal-grid">
            {/* Gallery Column */}
            <div className="modal-gallery">
              <div className="modal-main-image-wrap">
                <img src={activeImage} alt={product.name} className="modal-main-image" />
                <span className="modal-zoom-hint">🔍 Premium High Finish</span>
              </div>
              {images.length > 1 && (
                <div className="modal-thumb-strip">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`modal-thumb-btn ${idx === activePhotoIdx ? "active" : ""}`}
                      onClick={() => setActivePhotoIdx(idx)}
                    >
                      <img src={img} alt={`Thumbnail ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Meta Column */}
            <div className="modal-details">
              <span className="modal-category-tag">{product.category || "GOLD COVERING & READYMADE"}</span>
              <h2 className="modal-title">{product.name}</h2>

              <div className="modal-rating-row">
                <span className="modal-stars">★★★★★</span>
                <span className="modal-rating-text">4.9 / 5.0 (Hand-checked quality)</span>
                <span className="modal-verified-pill">✓ Boutique Ready</span>
              </div>

              <div className="modal-price-box">
                <div className="modal-price-line">
                  <span className="modal-price">{formatMoney(product.price_paise)}</span>
                  <span className="modal-tax-tag">Inclusive of all taxes</span>
                </div>
                {isOutOfStock ? (
                  <span className="modal-stock-badge out-of-stock">Out of stock</span>
                ) : (
                  <span className="modal-stock-badge in-stock">Ready to wear (Only {product.stock || 5} left)</span>
                )}
              </div>

              {/* Colour options */}
              {colours.length > 0 && (
                <div className="modal-colours-section">
                  <span className="modal-colours-title">Available Colours &amp; Looks:</span>
                  <div className="modal-colours-list">
                    {colours.map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        className={`modal-colour-pill ${c === selectedColour ? "active" : ""}`}
                        onClick={() => {
                          setSelectedColour(c);
                          if (images[i]) setActivePhotoIdx(i);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="modal-desc-box">
                  <p>{product.description}</p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="modal-actions">
                <button
                  type="button"
                  className="button button-gold modal-buy-btn"
                  onClick={handleOrder}
                  disabled={isOutOfStock}
                >
                  {isOutOfStock ? "Sold Out" : "Order Direct Now 🛍️"}
                </button>
                <button
                  type="button"
                  className="button modal-wa-btn"
                  onClick={handleWhatsApp}
                  disabled={isOutOfStock}
                >
                  Enquire on WhatsApp 💬
                </button>
              </div>

              {/* Trust Bar */}
              <div className="modal-trust-bar">
                <div className="trust-item"><span>🚚</span> Fast Insured Dispatch</div>
                <div className="trust-item"><span>✨</span> Non-Allergic 1g Covering</div>
                <div className="trust-item"><span>🛡️</span> Tamper-Proof Boutique Box</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
