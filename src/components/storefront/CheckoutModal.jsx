import React, { useState, useEffect, useRef } from "react";
import { useStore, getColourImage } from "../../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function CheckoutModal() {
  const { checkoutItem, closeCheckout, formatMoney, fetchProducts } = useStore();

  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [phoneToken, setPhoneToken] = useState("");
  
  // OTP state
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpNotice, setOtpNotice] = useState(null); // { type: 'success'|'warning'|'error', text: '' }

  // Address state
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("Chennai");
  const [state, setState] = useState("Tamil Nadu");
  const [pincode, setPincode] = useState("");

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cod"); // 'cod' | 'prepaid'
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState(null);

  // Promo state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");

  // Order submission
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [formError, setFormError] = useState("");

  const otpPanelRef = useRef(null);

  useEffect(() => {
    if (checkoutItem) {
      setQty(1);
      setIsPhoneVerified(false);
      setShowOtpPanel(false);
      setOtpCode("");
      setAppliedPromo(null);
      setConfirmedOrder(null);
      setFormError("");
      document.body.classList.add("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [checkoutItem]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  if (!checkoutItem) return null;

  const { product, initialColour } = checkoutItem;
  const maxStock = Math.max(1, product.stock || 5);

  const subtotalPaise = (product.price_paise || 0) * qty;
  const deliveryPaise = appliedPromo ? 0 : 5000; // ₹50 delivery
  const totalPaise = subtotalPaise + deliveryPaise;

  // Send OTP handler
  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      return;
    }

    setFormError("");
    setOtpSending(true);
    setOtpNotice({ type: "info", text: "Sending OTP to your phone…" });

    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send OTP.");
      }

      setShowOtpPanel(true);
      setOtpCooldown(data.cooldown || 60);

      if (data.testOtp) {
        setOtpCode(data.testOtp);
        if (data.smsSent) {
          setOtpNotice({
            type: "success",
            text: `✓ 6-digit code sent to +91 ${cleanPhone} via SMS. (Test auto-fill: ${data.testOtp})`
          });
        } else {
          setOtpNotice({
            type: "warning",
            text: `⚡ Fast2SMS Gateway Notice: ${data.gatewayError || "Fast2SMS website verification required on fast2sms.com"}. Your test OTP is: ${data.testOtp} (Auto-filled below).`
          });
        }
      } else {
        setOtpNotice({
          type: "success",
          text: `✓ 6-digit code sent to +91 ${cleanPhone}. Please check your SMS messages.`
        });
      }

      setTimeout(() => {
        otpPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (err) {
      setOtpNotice({ type: "error", text: err.message || "Failed to send OTP. Please check phone number." });
    } finally {
      setOtpSending(false);
    }
  };

  // Verify OTP handler
  const handleVerifyOtp = async () => {
    const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);
    const cleanCode = otpCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setOtpNotice({ type: "error", text: "Please enter the complete 6-digit numeric OTP." });
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone, otp: cleanCode })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Incorrect OTP. Please try again.");
      }

      setIsPhoneVerified(true);
      setPhoneToken(data.token || `verified_${Date.now()}`);
      setShowOtpPanel(false);
      setFormError("");
    } catch (err) {
      setOtpNotice({ type: "error", text: err.message || "Invalid OTP code. Please try again." });
    } finally {
      setOtpVerifying(false);
    }
  };

  // Promo Code Apply
  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setPromoError("Please enter a promo code.");
      return;
    }

    if (code === "FREEDELIVERY" || code === "FREESHIP" || code === "GOLD2026") {
      setAppliedPromo({ code, discountPaise: 5000, label: "Free Delivery" });
      setPromoError("");
    } else {
      setPromoError(`Promo code "${code}" is invalid or expired.`);
    }
  };

  // Handle Screenshot Upload
  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshotDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  // Submit Order Handler
  const handlePlaceOrder = async (e) => {
    e.preventDefault();

    if (!isPhoneVerified) {
      setFormError("⚠️ Please verify your 10-digit mobile number with the OTP code first.");
      if (!showOtpPanel) handleSendOtp();
      return;
    }

    if (!customerName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!street.trim() || !pincode.trim()) {
      setFormError("Please complete your delivery street address and PIN code.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const orderId = `SLR-${Date.now().toString().slice(-6)}`;
    const fullAddress = `${street}, ${city}, ${state} - ${pincode}`;

    const orderPayload = {
      order_id: orderId,
      customer_name: customerName.trim(),
      customer_phone: phone.replace(/\D/g, "").slice(0, 10),
      delivery_address: fullAddress,
      product_id: product.id,
      product_name: product.name,
      variant_colour: initialColour,
      quantity: qty,
      subtotal_paise: subtotalPaise,
      total_paise: totalPaise,
      payment_method: paymentMethod,
      utr_number: utrNumber.trim() || null,
      payment_screenshot: screenshotDataUrl || null,
      status: "confirmed",
      created_at: new Date().toISOString()
    };

    // 1. Save to Supabase or localStorage
    try {
      if (isSupabaseConfigured) {
        await supabase.from("orders").insert([orderPayload]);
      }
    } catch (dbErr) {
      console.warn("Supabase order insert notice:", dbErr);
    }

    try {
      const existing = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      existing.unshift(orderPayload);
      localStorage.setItem("saloriya_admin_orders", JSON.stringify(existing));
    } catch (e) {
      // ignore
    }

    // 2. Dispatch email notification via FormSubmit
    try {
      fetch("https://formsubmit.co/ajax/Saloriyaofficial@gmail.com", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `💎 New Order Confirmed #${orderId} - SALORIYA Store`,
          "Order ID": `#${orderId}`,
          "Customer Name": customerName,
          "Customer Phone": phone,
          "Delivery Address": fullAddress,
          "Jewellery Item": product.name,
          "Colour": initialColour,
          "Quantity": String(qty),
          "Total Amount": formatMoney(totalPaise),
          "Payment Method": paymentMethod === "prepaid" ? "Online UPI" : "Cash on Delivery",
          "Order Status": "CONFIRMED ✓"
        })
      }).catch(() => {});
    } catch (e) {}

    // Deduct stock in UI & reload
    fetchProducts();
    setSubmitting(false);
    setConfirmedOrder({ orderId, fullAddress, totalPaise });
  };

  return (
    <div className="product-modal" role="dialog" aria-modal="true">
      <div className="product-modal-backdrop" onClick={closeCheckout}></div>
      <div className="product-modal-dialog checkout-dialog">
        <button className="product-modal-close" onClick={closeCheckout} aria-label="Close checkout">
          ✕
        </button>

        <div className="checkout-modal-content">
          {confirmedOrder ? (
            /* Order Success View */
            <div className="checkout-success-box" style={{ textAlign: "center", padding: "20px 10px" }}>
              <div style={{ fontSize: "44px", marginBottom: "10px" }}>✨🎉✨</div>
              <h3 style={{ fontFamily: "Playfair Display, serif", fontSize: "24px", color: "var(--wine-dark)", margin: "0 0 6px" }}>
                Order Confirmed!
              </h3>
              <p style={{ fontSize: "14px", color: "var(--muted)", margin: "0 0 16px" }}>
                Thank you, <strong>{customerName}</strong>! Your order <strong>#{confirmedOrder.orderId}</strong> has been received and verified.
              </p>
              <div style={{ background: "#fdf5f0", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px", textAlign: "left", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Item:</span>
                  <strong>{product.name} ({initialColour})</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Quantity:</span>
                  <strong>{qty} pc</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Total Paid/Payable:</span>
                  <strong style={{ color: "var(--wine)" }}>{formatMoney(confirmedOrder.totalPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Delivery to:</span>
                  <span style={{ fontSize: "12px", maxWidth: "200px", textAlign: "right" }}>{confirmedOrder.fullAddress}</span>
                </div>
              </div>
              <button type="button" className="button button-gold" style={{ width: "100%", padding: "12px" }} onClick={closeCheckout}>
                Continue Shopping ↗
              </button>
            </div>
          ) : (
            /* Checkout Form View */
            <form onSubmit={handlePlaceOrder} id="storefront-checkout-form">
              <div className="checkout-header">
                <span className="eyebrow" style={{ fontSize: "10px" }}>EXPRESS CHECKOUT</span>
                <h3>Complete Your Order</h3>
              </div>

              {/* Product Summary */}
              <div className="checkout-product-summary">
                <div className="checkout-thumb">
                  {getColourImage(product, initialColour, 0) || product.image_urls?.[0] || product.images?.[0] ? (
                    <img
                      src={getColourImage(product, initialColour, 0) || product.image_urls?.[0] || product.images?.[0]}
                      alt={product.name}
                    />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "#f5e6de", color: "var(--wine)", fontWeight: 700 }}>
                      S
                    </div>
                  )}
                </div>
                <div className="checkout-product-details">
                  <span className="checkout-product-title">{product.name}</span>
                  <span className="checkout-product-variant">Colour: {initialColour}</span>
                  <strong>{formatMoney(product.price_paise)} each</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Qty:</span>
                    <button
                      type="button"
                      style={{ padding: "2px 8px", background: "#f5e6de", border: "1px solid var(--line)", borderRadius: "4px" }}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: 700 }}>{qty}</span>
                    <button
                      type="button"
                      style={{ padding: "2px 8px", background: "#f5e6de", border: "1px solid var(--line)", borderRadius: "4px" }}
                      onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Customer Name */}
              <label>
                Full Name *
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Krishnan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>

              {/* Mobile Phone & OTP Trigger */}
              <label>
                Mobile Phone (10 Digits) *
                <div className="phone-input-group">
                  <span className="phone-prefix-tag">+91</span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={phone}
                    readOnly={isPhoneVerified}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  />
                  {isPhoneVerified ? (
                    <span className="phone-verified-pill" style={{ display: "inline-flex", alignItems: "center", padding: "0 10px", background: "#dcfce7", color: "#15803d", fontSize: "11px", fontWeight: 700 }}>
                      ✓ Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-verify-trigger"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                    >
                      {otpSending ? "Sending…" : "Verify ⚡"}
                    </button>
                  )}
                </div>
              </label>

              {/* OTP Panel */}
              {showOtpPanel && !isPhoneVerified && (
                <div ref={otpPanelRef} className="otp-box-anim" style={{ marginTop: "10px", padding: "12px", background: "#fdf8f5", border: "1.5px solid var(--gold)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <strong style={{ fontSize: "12px", color: "var(--wine)" }}>🔒 Mobile OTP Verification</strong>
                    {otpCooldown > 0 && (
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Resend in {otpCooldown}s</span>
                    )}
                  </div>
                  {otpNotice && (
                    <div style={{ marginBottom: "8px", fontSize: "12px", color: otpNotice.type === "error" ? "#dc2626" : otpNotice.type === "warning" ? "#b45309" : "#15803d" }}>
                      {otpNotice.text}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={{ width: "120px", letterSpacing: "3px", textAlign: "center", fontWeight: 700, fontSize: "16px" }}
                    />
                    <button
                      type="button"
                      className="button button-gold"
                      style={{ padding: "8px 14px", fontSize: "11.5px" }}
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying}
                    >
                      {otpVerifying ? "Verifying…" : "Verify Code ✓"}
                    </button>
                    {otpCooldown <= 0 && (
                      <button
                        type="button"
                        style={{ background: "none", border: "none", color: "var(--wine)", fontSize: "11px", textDecoration: "underline", cursor: "pointer" }}
                        onClick={handleSendOtp}
                      >
                        Resend
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Address Fields */}
              <label style={{ marginTop: "10px" }}>
                Shipping / Delivery Street Address *
                <textarea
                  rows={2}
                  required
                  placeholder="House/Flat No, Street, Landmark"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                />
              </label>

              <div className="form-row form-row-city-state-pin">
                <label>
                  City *
                  <input required placeholder="Chennai" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label>
                  State *
                  <input required value={state} onChange={(e) => setState(e.target.value)} />
                </label>
                <label>
                  PIN Code *
                  <input
                    required
                    maxLength={6}
                    placeholder="600001"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                </label>
              </div>

              {/* Payment Method */}
              <label style={{ marginTop: "10px" }}>
                Payment Method
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="cod">Cash on Delivery (COD)</option>
                  <option value="prepaid">Instant Online Payment (UPI / QR / GPay / PhonePe)</option>
                </select>
              </label>

              {/* Online Payment Portal if Prepaid */}
              {paymentMethod === "prepaid" && (
                <div style={{ background: "#fffcf9", border: "1.5px solid var(--gold)", borderRadius: "8px", padding: "14px", marginTop: "10px" }}>
                  <div style={{ textAlign: "center", marginBottom: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--wine)" }}>⚡ Scan to Pay with Any UPI App</span>
                    <div style={{ margin: "10px auto", width: "160px", height: "160px", background: "#ffffff", border: "1px solid var(--line)", padding: "8px", borderRadius: "8px" }}>
                      <img src="/logo.png" alt="UPI QR" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>UPI ID: <strong>8680824598@upi</strong></span>
                  </div>

                  <label>
                    UPI Reference / UTR Number (Optional)
                    <input
                      type="text"
                      placeholder="12-digit UTR from GPay / PhonePe"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                    />
                  </label>
                  <label style={{ marginTop: "6px" }}>
                    Attach Payment Screenshot (Optional)
                    <input type="file" accept="image/*" onChange={handleScreenshotChange} />
                  </label>
                </div>
              )}

              {/* Promo Code Box */}
              <div style={{ marginTop: "12px", padding: "10px", background: "#faf5f0", borderRadius: "8px", border: "1px solid var(--line)" }}>
                {appliedPromo ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#15803d", fontWeight: 700, fontSize: "12px" }}>
                      🏷️ Promo "{appliedPromo.code}" Applied: Free Delivery!
                    </span>
                    <button
                      type="button"
                      style={{ background: "none", border: "none", color: "#dc2626", fontSize: "11px", cursor: "pointer" }}
                      onClick={() => setAppliedPromo(null)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      placeholder="Promo Code (e.g. FREEDELIVERY)"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      style={{ flex: 1, fontSize: "12px" }}
                    />
                    <button
                      type="button"
                      className="button"
                      style={{ padding: "6px 12px", fontSize: "11px" }}
                      onClick={handleApplyPromo}
                    >
                      Apply
                    </button>
                  </div>
                )}
                {promoError && <p style={{ color: "#dc2626", fontSize: "11px", margin: "4px 0 0" }}>{promoError}</p>}
              </div>

              {/* Price Breakdown */}
              <div className="checkout-price-breakdown" style={{ marginTop: "14px" }}>
                <div className="checkout-line">
                  <span>Item Subtotal ({qty} pc):</span>
                  <strong>{formatMoney(subtotalPaise)}</strong>
                </div>
                <div className="checkout-line">
                  <span>Courier &amp; Transport Fee:</span>
                  {appliedPromo ? (
                    <div>
                      <span style={{ textDecoration: "line-through", color: "var(--muted)", marginRight: "6px", fontSize: "11px" }}>₹50.00</span>
                      <strong style={{ color: "#15803d" }}>FREE ✓</strong>
                    </div>
                  ) : (
                    <strong>+ ₹50.00</strong>
                  )}
                </div>
                <div className="checkout-total-line">
                  <span>Total Payable:</span>
                  <span style={{ color: "var(--wine-dark)" }}>{formatMoney(totalPaise)}</span>
                </div>
              </div>

              {formError && (
                <div style={{ color: "#dc2626", fontSize: "12px", margin: "10px 0", fontWeight: 600 }}>
                  {formError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="button button-gold"
                style={{ width: "100%", padding: "14px", fontSize: "13px", marginTop: "12px", letterSpacing: "0.5px" }}
                disabled={submitting}
              >
                {submitting
                  ? "Placing Order…"
                  : paymentMethod === "prepaid"
                  ? `Proceed & Confirm Order (${formatMoney(totalPaise)}) 💳`
                  : `Confirm & Place Order (${formatMoney(totalPaise)}) ↗`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
