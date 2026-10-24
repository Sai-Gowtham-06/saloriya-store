import React, { useState } from "react";
import { useStore } from "../../context/StoreContext";

export default function ProductCard({ product }) {
  const { formatMoney, openPreview, openCheckout } = useStore();
  const [selectedColourIndex, setSelectedColourIndex] = useState(0);

  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : ["/logo.png"];

  // Select image based on chosen colour if multiple images exist
  const activeImage = images[selectedColourIndex] || images[0];
  const colours = Array.isArray(product.colours) ? product.colours : [];
  const selectedColour = colours[selectedColourIndex] || "Standard";

  const isOutOfStock = (product.stock || 0) <= 0;

  const handleWhatsApp = (e) => {
    e.stopPropagation();
    const message = encodeURIComponent(
      `Hello SALORIYA! I would like to order *${product.name}* (Colour: ${selectedColour}) priced at ${formatMoney(product.price_paise)}.`
    );
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
  };

  const handleBuyNow = (e) => {
    e.stopPropagation();
    openCheckout(product, selectedColour);
  };

  return (
    <article className="product-card" data-product-id={product.id}>
      {/* Product Image Frame */}
      <div
        className="product-image"
        onClick={() => openPreview(product.id)}
        title="Click to view details & photos"
      >
        <img src={activeImage} alt={product.name} loading="lazy" />
        {isOutOfStock ? (
          <span className="stock-tag out-of-stock">Out of stock</span>
        ) : (
          <span className="stock-tag">Ready to wear</span>
        )}
        <div className="card-quick-preview-badge">Quick View ↗</div>
      </div>

      {/* Product Info */}
      <div className="product-info" onClick={() => openPreview(product.id)}>
        <div>
          {colours.length > 1 ? (
            <span className="variant-count-badge">✨ {colours.length} Colour Options</span>
          ) : (
            <span className="variant-count-badge single">👑 Signature Single Look</span>
          )}
          <p className="product-category">{product.category || "GOLD COVERING"}</p>
          <h3 className="product-title-link">{product.name}</h3>
        </div>
        <strong>{formatMoney(product.price_paise)}</strong>
      </div>

      {product.description && (
        <p className="product-description" onClick={() => openPreview(product.id)}>
          {product.description}
        </p>
      )}

      {/* Swatches */}
      {colours.length > 1 && (
        <div className="card-colour-swatches">
          <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: 600 }}>Colours:</span>
          {colours.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`card-colour-swatch ${i === selectedColourIndex ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedColourIndex(i);
              }}
              title={c}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Stacked Mobile-Responsive Action Row */}
      <div className="card-action-row">
        <button
          type="button"
          className="card-buy-btn"
          onClick={handleBuyNow}
          disabled={isOutOfStock}
        >
          <span>{isOutOfStock ? "Out of Stock" : "Order Now 🛍️"}</span>
        </button>
        <button
          type="button"
          className="card-wa-btn"
          onClick={handleWhatsApp}
          disabled={isOutOfStock}
          title="Order on WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z"/>
          </svg>
          <span>WhatsApp ↗</span>
        </button>
      </div>
    </article>
  );
}
