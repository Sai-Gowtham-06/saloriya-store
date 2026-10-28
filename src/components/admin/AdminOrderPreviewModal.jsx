import React, { useState, useEffect } from "react";
import { getColourImage } from "../../context/StoreContext";

export default function AdminOrderPreviewModal({
  isOpen,
  order,
  products = [],
  onClose,
  onStatusChange,
  formatMoney
}) {
  const [activeItemIdx, setActiveItemIdx] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");

  useEffect(() => {
    if (order) {
      setActiveItemIdx(0);
      setIsZoomed(false);
      setPreviewScreenshot(false);
      setCopiedId(false);
      setCurrentStatus(String(order.status || order.order_status || "confirmed").toLowerCase());
    }
  }, [order]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (previewScreenshot) {
          setPreviewScreenshot(false);
        } else if (isZoomed) {
          setIsZoomed(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [isOpen, previewScreenshot, isZoomed, onClose]);

  if (!isOpen || !order) return null;

  const defaultFormatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };
  const moneyFormatter = formatMoney || defaultFormatMoney;

  const parsedItems = Array.isArray(order.items)
    ? order.items
    : (typeof order.items === "string" ? (() => { try { const p = JSON.parse(order.items); return Array.isArray(p) ? p : null; } catch(e) { return null; } })() : null);

  const hasMultiItems = Array.isArray(parsedItems) && parsedItems.length > 0;
  const itemsList = hasMultiItems
    ? parsedItems
    : [
        {
          product_id: order.product_id,
          product_name: order.product_name || "Jewellery Piece",
          variant_colour: order.variant_colour || "Standard",
          quantity: order.quantity || 1,
          product_image: order.product_image,
          subtotal_paise: order.total_paise || order.subtotal_paise || 0,
          unit_price_paise: order.unit_price_paise || (order.total_paise ? Math.round(order.total_paise / (order.quantity || 1)) : 0)
        }
      ];

  const safeIdx = Math.min(activeItemIdx, itemsList.length - 1);
  const activeItem = itemsList[safeIdx] || itemsList[0];

  // Try to find matching product in catalogue for richer images & catalogue data
  const matchedProduct = products?.find(
    (p) =>
      p.id === activeItem.product_id ||
      (p.name && activeItem.product_name && p.name.trim().toLowerCase() === activeItem.product_name.trim().toLowerCase())
  );

  // Determine active item image
  const displayImage =
    activeItem.product_image ||
    (matchedProduct ? (getColourImage(matchedProduct, activeItem.variant_colour, 0) || matchedProduct.image_urls?.[0] || matchedProduct.images?.[0]) : "") ||
    order.product_image ||
    "";

  const payMethod = String(order.payment_method || "cod").toLowerCase();
  const isPrepaid = payMethod === "prepaid" || payMethod === "online" || payMethod === "upi";

  const formattedDate = (() => {
    if (!order.created_at) return "Recently placed";
    const d = new Date(order.created_at);
    return isNaN(d.getTime())
      ? "Recently placed"
      : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  })();

  const customerPhone = String(order.customer_phone || order.phone || "").replace(/\D/g, "");
  const displayPhone = customerPhone ? (customerPhone.length > 10 ? customerPhone.slice(-10) : customerPhone) : "";
  const custName = order.customer_name || "Valued Customer";
  const oId = order.order_id || order.id || "SLR";
  const pName = activeItem.product_name || order.product_name || "Jewellery Order";
  const totalFormatted = moneyFormatter(order.total_paise);
  const custAddress = order.delivery_address || (typeof order.address === "object" ? (order.address?.full || `${order.address?.street || ""}, ${order.address?.city || ""}`) : String(order.address || "Address on record"));

  const cancellationNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been cancelled. If you have any questions or would like to choose another piece from our catalogue, feel free to reply directly to this message. Team SALORIYA.`;
  const confirmationNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been confirmed! Total: ${totalFormatted}. We are carefully packing your jewellery for dispatch. Thank you for shopping with SALORIYA!`;
  const shippedNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been dispatched and shipped! Delivery address: ${custAddress}. Team SALORIYA.`;
  const generalNote = `Namaste ${custName}, this is SALORIYA Store regarding your order #${oId}.`;

  const waCancelUrl = `https://wa.me/91${displayPhone}?text=${encodeURIComponent(cancellationNote)}`;
  const waConfirmUrl = `https://wa.me/91${displayPhone}?text=${encodeURIComponent(confirmationNote)}`;
  const waShippedUrl = `https://wa.me/91${displayPhone}?text=${encodeURIComponent(shippedNote)}`;
  const waGeneralUrl = `https://wa.me/91${displayPhone}?text=${encodeURIComponent(generalNote)}`;

  const handleCopyOrderId = () => {
    const text = order.order_id || order.id || "";
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleStatusUpdate = (newStatus) => {
    setCurrentStatus(newStatus);
    if (onStatusChange) {
      onStatusChange(order.order_id || order.id, newStatus, order);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="product-modal" className="product-modal admin-order-modal" role="dialog" aria-modal="true" style={{ zIndex: 100000 }}>
      {/* Dark Blur Backdrop */}
      <div className="product-modal-backdrop" onClick={onClose}></div>

      {/* Product-Preview-Card-Sized Dialog (Exact same size as storefront product preview modal) */}
      <div className="product-modal-dialog">
        <button
          className="product-modal-close"
          onClick={onClose}
          aria-label="Close order preview"
        >
          ✕
        </button>

        <div className="product-modal-content">
          <div className="modal-grid">
            {/* Left Column: Product Showcase & Interactive Image Preview (Matches storefront modal-gallery) */}
            <div className="modal-gallery">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px"
                }}
              >
                <span className="modal-breadcrumb" style={{ margin: 0, color: "var(--wine)", fontWeight: 700 }}>
                  {hasMultiItems ? `PIECE ${safeIdx + 1} OF ${itemsList.length}` : "ORDERED JEWELLERY PIECE"}
                </span>
                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>
                  🔍 Click image to inspect
                </span>
              </div>

              {/* Large Product Image Box (Matches storefront modal-main-image-wrap: 420px desktop, 290px mobile) */}
              <div
                className="modal-main-image-wrap"
                style={{
                  cursor: "zoom-in",
                  background: "radial-gradient(circle at center, #ffffff 0%, #faf3ef 100%)",
                  border: "1.5px solid var(--gold-border, rgba(212,175,55,0.4))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 16px rgba(134,30,56,0.06)",
                  position: "relative"
                }}
                onClick={() => setIsZoomed(true)}
                title="Click to view full-size high resolution image"
              >
                {displayImage ? (
                  <img
                    className="modal-main-img"
                    src={displayImage}
                    alt={activeItem.product_name}
                    style={{
                      objectFit: "contain",
                      padding: "10px",
                      width: "100%",
                      height: "100%"
                    }}
                  />
                ) : (
                  <div className="image-placeholder">
                    <span>S</span>
                    <small>SALORIYA</small>
                  </div>
                )}

                <div className="modal-zoom-hint" style={{ pointerEvents: "none" }}>
                  🔍 Tap to Enlarge
                </div>
              </div>

              {/* Multi-Item Thumbnails Strip (if order contains multiple cart items) */}
              {hasMultiItems && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase" }}>
                    Select Piece to Preview ({itemsList.length} items):
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      overflowX: "auto",
                      paddingBottom: "4px"
                    }}
                  >
                    {itemsList.map((item, idx) => {
                      const isSelected = idx === safeIdx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveItemIdx(idx)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: "6px",
                            borderRadius: "8px",
                            border: isSelected ? "2px solid var(--wine)" : "1px solid var(--line)",
                            background: isSelected ? "#fff5f7" : "#ffffff",
                            cursor: "pointer",
                            minWidth: "70px",
                            flexShrink: 0,
                            transition: "all 0.15s ease"
                          }}
                        >
                          {item.product_image ? (
                            <img
                              src={item.product_image}
                              alt={item.product_name}
                              style={{ width: "48px", height: "48px", borderRadius: "4px", objectFit: "cover" }}
                            />
                          ) : (
                            <div style={{ width: "48px", height: "48px", borderRadius: "4px", background: "#faf3ef", display: "grid", placeItems: "center", color: "var(--wine)", fontWeight: 700 }}>
                              S
                            </div>
                          )}
                          <span style={{ fontSize: "10px", fontWeight: 700, marginTop: "4px", color: isSelected ? "var(--wine)" : "var(--ink)", maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            #{idx + 1}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Item Specs Card */}
              <div
                style={{
                  background: "#fdf8f5",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "14px",
                  marginTop: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "17px",
                    color: "var(--wine)",
                    margin: 0,
                    lineHeight: 1.3
                  }}
                >
                  {activeItem.product_name}
                </h3>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                  <span
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--line)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11.5px",
                      color: "var(--ink)",
                      fontWeight: 600
                    }}
                  >
                    Colour: <strong style={{ color: "var(--wine)" }}>{activeItem.variant_colour || "Standard"}</strong>
                  </span>
                  <span
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--line)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11.5px",
                      color: "var(--ink)",
                      fontWeight: 600
                    }}
                  >
                    Qty: <strong>{activeItem.quantity || 1}</strong>
                  </span>
                  <span
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--line)",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      fontSize: "11.5px",
                      color: "var(--wine)",
                      fontWeight: 700
                    }}
                  >
                    Piece Price: {moneyFormatter(activeItem.subtotal_paise || ((activeItem.unit_price_paise || 0) * (activeItem.quantity || 1)))}
                  </span>
                </div>

                {matchedProduct && (
                  <div style={{ fontSize: "11px", color: "var(--muted)", borderTop: "1px dashed var(--line)", paddingTop: "6px", marginTop: "2px" }}>
                    Category: <strong>{matchedProduct.category || "Jewellery"}</strong> · Live Store Stock: <strong>{matchedProduct.stock ?? "In stock"} pcs</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Order Details, Customer Contact, Delivery & Live Controls (Matches storefront modal-details) */}
            <div className="modal-details" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Order Badges Header Strip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  paddingBottom: "10px",
                  borderBottom: "1.5px solid var(--line)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 800,
                      fontSize: "13.5px",
                      background: "#ffffff",
                      border: "1.5px solid var(--wine)",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      color: "var(--wine)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px"
                    }}
                    onClick={handleCopyOrderId}
                    title="Click to copy Order ID"
                  >
                    📦 #{order.order_id || order.id || "SLR"}
                    <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>
                      {copiedId ? "✓ Copied" : "📋"}
                    </span>
                  </span>

                  <span className={`status-tag status-tag-${currentStatus}`} style={{ fontSize: "11px", padding: "3px 10px" }}>
                    ● {currentStatus.toUpperCase()}
                  </span>

                  <span className={`payment-tag ${isPrepaid ? "paid" : ""}`} style={{ fontSize: "11px", padding: "3px 8px" }}>
                    {isPrepaid ? "⚡ UPI PREPAID" : "💵 CASH ON DELIVERY"}
                  </span>
                </div>

                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                  📅 {formattedDate}
                </span>
              </div>

              {/* Customer Contact & Delivery Card */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.02)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--line-subtle)",
                    paddingBottom: "6px",
                    marginBottom: "10px"
                  }}
                >
                  <span style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--wine)", textTransform: "uppercase" }}>
                    Customer &amp; Delivery Details
                  </span>
                  {displayPhone && (
                    <a
                      href={waGeneralUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: "#25d366",
                        color: "#ffffff",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: "5px",
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      💬 WhatsApp
                    </a>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ color: "var(--muted)", width: "65px", flexShrink: 0 }}>Customer:</span>
                    <strong style={{ color: "var(--ink)" }}>{custName}</strong>
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <span style={{ color: "var(--muted)", width: "65px", flexShrink: 0 }}>Phone:</span>
                    {displayPhone ? (
                      <a
                        href={`tel:+91${displayPhone}`}
                        style={{ color: "#15803d", fontWeight: 700, textDecoration: "none" }}
                      >
                        📞 +91 {displayPhone}
                      </a>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Not provided</span>
                    )}
                  </div>

                  {order.customer_email && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span style={{ color: "var(--muted)", width: "65px", flexShrink: 0 }}>Email:</span>
                      <a href={`mailto:${order.customer_email}`} style={{ color: "var(--wine)", textDecoration: "none" }}>
                        {order.customer_email}
                      </a>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "6px", marginTop: "2px" }}>
                    <span style={{ color: "var(--muted)", width: "65px", flexShrink: 0 }}>Address:</span>
                    <div
                      style={{
                        background: "#faf5f1",
                        border: "1px solid var(--line)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        fontSize: "12px",
                        color: "var(--ink)",
                        lineHeight: 1.4,
                        flex: 1,
                        wordBreak: "break-word"
                      }}
                    >
                      📍 {custAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment & Financial Summary Card */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.02)"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: "1px solid var(--line-subtle)",
                    paddingBottom: "6px",
                    marginBottom: "8px"
                  }}
                >
                  <span style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--wine)", textTransform: "uppercase" }}>
                    Payment Summary
                  </span>
                  <span className={`payment-tag ${isPrepaid ? "paid" : ""}`}>
                    {isPrepaid ? "⚡ ONLINE UPI" : "💵 CASH ON DELIVERY"}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "12.5px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
                    <span>Items Count:</span>
                    <strong>{itemsList.length} piece{itemsList.length === 1 ? "" : "s"}</strong>
                  </div>

                  {order.discount_paise > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#15803d" }}>
                      <span>Discount ({order.promo_code || "Promo"}):</span>
                      <span>- {moneyFormatter(order.discount_paise)}</span>
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--line)",
                      paddingTop: "6px",
                      marginTop: "2px",
                      alignItems: "baseline"
                    }}
                  >
                    <strong style={{ fontSize: "14px", color: "var(--ink)" }}>Grand Total:</strong>
                    <strong style={{ fontSize: "20px", color: "var(--wine)" }}>
                      {moneyFormatter(order.total_paise)}
                    </strong>
                  </div>

                  {order.utr_number && (
                    <div
                      style={{
                        background: "#f5f3ff",
                        border: "1px solid #ddd6fe",
                        borderRadius: "5px",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        color: "#6b21a8",
                        fontWeight: 700,
                        marginTop: "4px"
                      }}
                    >
                      ⚡ UTR Ref: <span style={{ fontFamily: "monospace" }}>{order.utr_number}</span>
                    </div>
                  )}

                  {order.payment_screenshot && (
                    <button
                      type="button"
                      className="button button-small"
                      onClick={() => setPreviewScreenshot(true)}
                      style={{
                        background: "#fdf4ff",
                        border: "1px solid #f0abfc",
                        color: "#a21caf",
                        fontWeight: 700,
                        fontSize: "11.5px",
                        padding: "6px",
                        marginTop: "6px",
                        width: "100%",
                        justifyContent: "center",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px"
                      }}
                    >
                      📸 View Customer UPI Screenshot Proof
                    </button>
                  )}
                </div>
              </div>

              {/* Live Status Management Box */}
              <div
                style={{
                  background: "#faf4f0",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "12px 14px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.06em", color: "var(--wine)", textTransform: "uppercase" }}>
                    Update Order Status
                  </span>
                  <span style={{ fontSize: "10.5px", color: "var(--muted)" }}>Syncs instantly</span>
                </div>

                <select
                  value={currentStatus}
                  onChange={(e) => handleStatusUpdate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1.5px solid var(--line)",
                    background: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    color: "var(--wine)"
                  }}
                >
                  <option value="pending">⏳ Pending Verification</option>
                  <option value="confirmed">✓ Confirmed &amp; Packing</option>
                  <option value="shipped">🚚 Shipped / Dispatched</option>
                  <option value="delivered">🎁 Delivered to Customer</option>
                  <option value="cancelled">✕ Cancelled Order</option>
                </select>

                {/* WhatsApp Notification Shortcuts */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                  {currentStatus === "confirmed" && (
                    <a
                      href={waConfirmUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-small"
                      style={{
                        background: "#f0fdf4",
                        color: "#15803d",
                        border: "1px solid #86efac",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "11px",
                        padding: "5px 10px"
                      }}
                    >
                      💬 Send WhatsApp Confirmation
                    </a>
                  )}

                  {currentStatus === "shipped" && (
                    <a
                      href={waShippedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-small"
                      style={{
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        border: "1px solid #93c5fd",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "11px",
                        padding: "5px 10px"
                      }}
                    >
                      🚚 Send WhatsApp Dispatch Note
                    </a>
                  )}

                  {currentStatus === "cancelled" && (
                    <a
                      href={waCancelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-small"
                      style={{
                        background: "#fef2f2",
                        color: "#b91c1c",
                        border: "1px solid #f87171",
                        textDecoration: "none",
                        fontWeight: 700,
                        fontSize: "11px",
                        padding: "5px 10px"
                      }}
                    >
                      💬 Send Cancellation Message
                    </a>
                  )}

                  <a
                    href={waGeneralUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-small"
                    style={{
                      background: "#ffffff",
                      color: "#166534",
                      border: "1px solid #bbf7d0",
                      textDecoration: "none",
                      fontSize: "11px",
                      padding: "5px 10px"
                    }}
                  >
                    💬 Message Customer
                  </a>
                </div>
              </div>

              {/* Action Buttons Strip */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={handlePrint}
                  style={{ flex: 1, padding: "8px", fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                >
                  🖨️ Print Slip
                </button>
                <button
                  type="button"
                  className="button button-dark button-small"
                  onClick={onClose}
                  style={{ flex: 1, padding: "8px", fontSize: "12px" }}
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Zoom Lightbox for Jewellery Photo */}
      {isZoomed && displayImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000000,
            background: "rgba(18, 5, 10, 0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setIsZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setIsZoomed(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              background: "#ffffff",
              color: "var(--wine)",
              border: "none",
              borderRadius: "50%",
              width: "42px",
              height: "42px",
              fontSize: "18px",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}
          >
            ✕
          </button>
          <div style={{ textAlign: "center", marginBottom: "12px" }}>
            <h4 style={{ color: "#ffffff", fontFamily: "'Playfair Display', serif", margin: 0, fontSize: "20px" }}>
              {activeItem.product_name}
            </h4>
            <span style={{ color: "#f3e8eb", fontSize: "13px" }}>
              Colour: {activeItem.variant_colour || "Standard"} · High-Resolution Verification
            </span>
          </div>
          <div
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              overflow: "auto",
              borderRadius: "12px",
              background: "#ffffff",
              padding: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={displayImage}
              alt={activeItem.product_name}
              style={{
                maxWidth: "100%",
                maxHeight: "75vh",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
                borderRadius: "8px"
              }}
            />
          </div>
        </div>
      )}

      {/* Full-Screen Payment Screenshot Proof Lightbox */}
      {previewScreenshot && order.payment_screenshot && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000000,
            background: "rgba(18, 5, 10, 0.92)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={() => setPreviewScreenshot(false)}
        >
          <button
            type="button"
            onClick={() => setPreviewScreenshot(false)}
            style={{
              position: "absolute",
              top: "20px",
              right: "24px",
              background: "#ffffff",
              color: "var(--wine)",
              border: "none",
              borderRadius: "50%",
              width: "42px",
              height: "42px",
              fontSize: "18px",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
            }}
          >
            ✕
          </button>
          <h4 style={{ color: "#ffffff", fontFamily: "'Playfair Display', serif", margin: "0 0 12px", fontSize: "18px" }}>
            Customer UPI Payment Proof — Order #{order.order_id || order.id}
          </h4>
          <div
            style={{
              maxWidth: "500px",
              maxHeight: "80vh",
              overflow: "auto",
              borderRadius: "12px",
              background: "#ffffff",
              padding: "8px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={order.payment_screenshot}
              alt="UPI Screenshot Proof"
              style={{ width: "100%", height: "auto", borderRadius: "8px", display: "block" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
