import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminRecordOrderModal({ isOpen, onClose, products, onOrderCreated }) {
  const [productId, setProductId] = useState("");
  const [selectedColour, setSelectedColour] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [qty, setQty] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("prepaid");
  const [utrNumber, setUtrNumber] = useState("");
  const [orderStatus, setOrderStatus] = useState("confirmed");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === productId);
  const colours = selectedProduct && Array.isArray(selectedProduct.colours) ? selectedProduct.colours : [];

  const handleProductChange = (e) => {
    const id = e.target.value;
    setProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod && Array.isArray(prod.colours) && prod.colours.length > 0) {
      setSelectedColour(prod.colours[0]);
    } else {
      setSelectedColour("Standard");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProduct) {
      setErrorMsg("Please select a jewellery piece.");
      return;
    }
    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setErrorMsg("Please complete customer name, phone number, and delivery address.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    const orderId = `SLR-${Date.now().toString().slice(-6)}`;
    const subtotalPaise = (selectedProduct.price_paise || 0) * qty;
    const totalPaise = subtotalPaise + 5000; // Flat ₹50 transport

    const orderPayload = {
      order_id: orderId,
      customer_name: customerName.trim(),
      customer_phone: phone.replace(/\D/g, "").slice(0, 10),
      delivery_address: address.trim(),
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      variant_colour: selectedColour || "Standard",
      quantity: qty,
      subtotal_paise: subtotalPaise,
      total_paise: totalPaise,
      payment_method: paymentMethod,
      utr_number: utrNumber.trim() || null,
      payment_screenshot: null,
      status: orderStatus,
      created_at: new Date().toISOString()
    };

    // 1. Save to Central Orders API
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload)
      });
    } catch (apiErr) {
      console.warn("Central API record order error:", apiErr);
    }

    // 2. Save to Supabase
    try {
      if (isSupabaseConfigured) {
        await supabase.from("orders").insert([orderPayload]);
        if (orderStatus === "confirmed") {
          const newStock = Math.max(0, (selectedProduct.stock || 0) - qty);
          await supabase.from("products").update({ stock: newStock }).eq("id", selectedProduct.id);
        }
      }
    } catch (dbErr) {
      console.warn("Supabase order error:", dbErr);
    }

    // 3. Save to localStorage
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      local.unshift(orderPayload);
      localStorage.setItem("saloriya_admin_orders", JSON.stringify(local));

      if (orderStatus === "confirmed") {
        const localProds = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
        const idx = localProds.findIndex((p) => p.id === selectedProduct.id);
        if (idx !== -1) {
          localProds[idx].stock = Math.max(0, (localProds[idx].stock || 0) - qty);
          localStorage.setItem("saloriya_admin_products", JSON.stringify(localProds));
        }
      }
    } catch (e) {}

    setSaving(false);
    onClose();
    if (onOrderCreated) onOrderCreated();
  };

  return (
    <div className="product-modal" role="dialog" aria-modal="true">
      <div className="product-modal-backdrop" onClick={onClose}></div>
      <div className="product-modal-dialog" style={{ maxWidth: "560px", padding: "24px" }}>
        <button className="product-modal-close" onClick={onClose} aria-label="Close modal">
          ✕
        </button>

        <div style={{ marginBottom: "16px" }}>
          <p className="eyebrow" style={{ color: "var(--wine)", fontSize: "11px", margin: "0 0 4px" }}>
            ORDER MANAGEMENT
          </p>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", margin: 0 }}>Record New Order</h2>
          <p className="hint" style={{ fontSize: "12px", margin: "4px 0 0" }}>
            Record orders placed via WhatsApp, Instagram DM, phone, or in-person.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="admin-form" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ fontSize: "12px", fontWeight: 600 }}>
            Select Jewellery Piece *
            <select
              required
              value={productId}
              onChange={handleProductChange}
              style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
            >
              <option value="">-- Choose jewellery piece --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (₹{(p.price_paise / 100).toFixed(0)} · Stock: {p.stock})
                </option>
              ))}
            </select>
          </label>

          {colours.length > 0 && (
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Variant / Colour
              <select
                value={selectedColour}
                onChange={(e) => setSelectedColour(e.target.value)}
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              >
                {colours.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Customer Full Name *
              <input
                required
                placeholder="e.g. Priya Sharma"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Phone (10 Digits) *
              <input
                required
                type="tel"
                maxLength={10}
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
            </label>
          </div>

          <label style={{ fontSize: "12px", fontWeight: 600 }}>
            Delivery Address *
            <textarea
              required
              rows={2}
              placeholder="Full postal address with city, state, and pincode"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Quantity
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Payment Mode
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              >
                <option value="prepaid">Online UPI</option>
                <option value="cod">Cash on Delivery</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              Order Status
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              >
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>

          {paymentMethod === "prepaid" && (
            <label style={{ fontSize: "12px", fontWeight: 600 }}>
              UPI Transaction / UTR Number (Optional)
              <input
                placeholder="e.g. 329048192841"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                style={{ width: "100%", padding: "9px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--line)" }}
              />
            </label>
          )}

          {errorMsg && (
            <p style={{ color: "#dc2626", fontSize: "12px", margin: "4px 0" }}>{errorMsg}</p>
          )}

          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button
              type="submit"
              className="button button-gold"
              disabled={saving}
              style={{ flex: 1, padding: "12px", fontWeight: 700 }}
            >
              {saving ? "Saving Order…" : "💾 Save &amp; Record Order"}
            </button>
            <button type="button" className="button button-outline" onClick={onClose} style={{ padding: "12px 18px" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
