import React, { useEffect } from "react";
import { useStore } from "../../context/StoreContext";

export default function CartDrawer() {
  const {
    cart,
    isCartOpen,
    closeCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    cartCount,
    cartSubtotalPaise,
    formatMoney,
    openCartCheckout
  } = useStore();

  // Lock body scroll when cart is open
  useEffect(() => {
    if (isCartOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isCartOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isCartOpen) {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  return (
    <div className="cart-drawer-backdrop" onClick={closeCart} role="dialog" aria-modal="true" aria-label="Shopping Cart">
      <aside className="cart-drawer-panel" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="cart-drawer-header">
          <div className="cart-header-title-group">
            <span className="cart-header-icon">👜</span>
            <div>
              <h3 className="cart-drawer-title">Shopping Bag</h3>
              <span className="cart-item-count-badge">
                {cartCount} {cartCount === 1 ? "Piece" : "Pieces"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="cart-close-btn"
            onClick={closeCart}
            aria-label="Close cart drawer"
          >
            ✕
          </button>
        </div>

        {/* Free Shipping Strip */}
        <div className="cart-shipping-notice">
          <span>✦ Apply promo codes at checkout for free delivery!</span>
        </div>

        {/* Drawer Body: Cart Items List or Empty State */}
        <div className="cart-drawer-body">
          {cart.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon">💍</div>
              <h4>Your Bag is Empty</h4>
              <p>Explore our handcrafted gold covering jewellery and add your favourite pieces.</p>
              <button
                type="button"
                className="button button-gold"
                style={{ padding: "12px 24px", fontSize: "13px", marginTop: "14px" }}
                onClick={() => {
                  closeCart();
                  const shopSection = document.getElementById("shop");
                  if (shopSection) {
                    shopSection.scrollIntoView({ behavior: "smooth" });
                  }
                }}
              >
                ✦ Explore Collection
              </button>
            </div>
          ) : (
            <div className="cart-items-list">
              {cart.map((item) => {
                const maxStock = Math.max(1, item.stock ?? item.product?.stock ?? 10);
                const isMax = item.quantity >= maxStock;

                return (
                  <div key={item.cartItemId} className="cart-item-card">
                    <div className="cart-item-thumb">
                      {item.image ? (
                        <img src={item.image} alt={item.name} loading="lazy" />
                      ) : (
                        <div className="cart-item-thumb-placeholder">S</div>
                      )}
                    </div>
                    <div className="cart-item-info">
                      <div className="cart-item-title-row">
                        <h4 className="cart-item-name">{item.name}</h4>
                        <button
                          type="button"
                          className="cart-item-remove-btn"
                          onClick={() => removeFromCart(item.cartItemId)}
                          title="Remove item from bag"
                          aria-label={`Remove ${item.name} from bag`}
                        >
                          ✕
                        </button>
                      </div>

                      {item.colour && item.colour !== "Standard" && (
                        <span className="cart-item-colour-tag">
                          Colour: <strong>{item.colour}</strong>
                        </span>
                      )}

                      <div className="cart-item-price-row">
                        <span className="cart-item-unit-price">
                          {formatMoney(item.unit_price_paise)}
                        </span>
                      </div>

                      {/* Quantity Selector & Item Total */}
                      <div className="cart-item-bottom-row">
                        <div className="cart-qty-control">
                          <button
                            type="button"
                            className="cart-qty-btn"
                            onClick={() => updateCartQuantity(item.cartItemId, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <span className="cart-qty-value">{item.quantity}</span>
                          <button
                            type="button"
                            className="cart-qty-btn"
                            disabled={isMax}
                            onClick={() => updateCartQuantity(item.cartItemId, item.quantity + 1)}
                            aria-label="Increase quantity"
                            title={isMax ? "Maximum available stock reached" : "Increase quantity"}
                          >
                            +
                          </button>
                        </div>
                        <span className="cart-item-subtotal">
                          {formatMoney((item.unit_price_paise || 0) * item.quantity)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer: Order Summary & Checkout CTA */}
        {cart.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary-line">
              <span className="cart-summary-label">Items Subtotal</span>
              <strong className="cart-summary-amount">{formatMoney(cartSubtotalPaise)}</strong>
            </div>
            <div className="cart-summary-line">
              <span className="cart-summary-label">Courier Delivery</span>
              <span className="cart-delivery-pill">₹50 (Free with code)</span>
            </div>

            <button
              type="button"
              className="button button-gold cart-checkout-btn"
              onClick={openCartCheckout}
            >
              <span>Proceed to Checkout</span>
              <span className="cart-checkout-arrow">→</span>
            </button>

            <button
              type="button"
              className="cart-continue-btn"
              onClick={closeCart}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
