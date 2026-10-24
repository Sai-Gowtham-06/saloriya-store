import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminOrders({ orders, onOrderUpdated }) {
  const [paymentFilter, setPaymentFilter] = useState("all"); // 'all' | 'prepaid' | 'cod'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      if (isSupabaseConfigured) {
        await supabase.from("orders").update({ status: newStatus }).eq("order_id", orderId);
      }
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      const idx = local.findIndex((o) => o.order_id === orderId);
      if (idx !== -1) {
        local[idx].status = newStatus;
        localStorage.setItem("saloriya_admin_orders", JSON.stringify(local));
      }
    } catch (e) {}

    onOrderUpdated();
  };

  const filteredOrders = orders.filter((o) => {
    // Payment filter
    if (paymentFilter === "prepaid" && o.payment_method !== "prepaid") return false;
    if (paymentFilter === "cod" && o.payment_method === "prepaid") return false;

    // Status filter
    if (statusFilter !== "all" && (o.status || "confirmed") !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (o.customer_name || "").toLowerCase().includes(q);
      const matchPhone = (o.customer_phone || "").includes(q);
      const matchId = (o.order_id || "").toLowerCase().includes(q);
      const matchProduct = (o.product_name || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId && !matchProduct) return false;
    }

    return true;
  });

  const countPrepaid = orders.filter((o) => o.payment_method === "prepaid").length;
  const countCod = orders.filter((o) => o.payment_method !== "prepaid").length;

  return (
    <div className="admin-panel" style={{ marginBottom: "30px" }}>
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div>
          <p className="eyebrow">CUSTOMER ORDERS</p>
          <h2 style={{ fontSize: "28px" }}>Orders Dashboard</h2>
        </div>
      </div>

      {/* Payment Type Tabs */}
      <div className="orders-payment-type-tabs" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className={`payment-type-tab ${paymentFilter === "all" ? "active" : ""}`}
          onClick={() => setPaymentFilter("all")}
        >
          <span className="tab-icon">📦</span>
          <span className="tab-label">All Orders</span>
          <span className="tab-count">{orders.length}</span>
        </button>
        <button
          type="button"
          className={`payment-type-tab ${paymentFilter === "prepaid" ? "active" : ""}`}
          onClick={() => setPaymentFilter("prepaid")}
        >
          <span className="tab-icon">⚡</span>
          <span className="tab-label">Online UPI (Prepaid)</span>
          <span className="tab-count tab-count-highlight">{countPrepaid}</span>
        </button>
        <button
          type="button"
          className={`payment-type-tab ${paymentFilter === "cod" ? "active" : ""}`}
          onClick={() => setPaymentFilter("cod")}
        >
          <span className="tab-icon">💵</span>
          <span className="tab-label">Cash on Delivery (COD)</span>
          <span className="tab-count">{countCod}</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="orders-toolbar" style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        <input
          type="text"
          className="orders-search-box"
          placeholder="Search by customer name, phone, order ID…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: "220px" }}
        />
        <select
          className="toolbar-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: "150px" }}
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="dispatched">Dispatched</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--muted)", background: "#faf4f0", borderRadius: "8px" }}>
          No orders found matching the selected filters.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {filteredOrders.map((order) => {
            const isPrepaid = order.payment_method === "prepaid";
            const status = order.status || "confirmed";

            return (
              <div
                key={order.order_id}
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "16px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid var(--line-subtle)", paddingBottom: "10px", marginBottom: "12px" }}>
                  <div>
                    <strong style={{ fontSize: "16px", color: "var(--wine-dark)" }}>#{order.order_id}</strong>
                    <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "10px" }}>
                      {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: isPrepaid ? "#f3e8ff" : "#fef3c7",
                        color: isPrepaid ? "#6b21a8" : "#92400e"
                      }}
                    >
                      {isPrepaid ? "⚡ Online UPI" : "💵 Cash on Delivery"}
                    </span>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: status === "delivered" ? "#dcfce7" : status === "dispatched" ? "#dbeafe" : status === "cancelled" ? "#fee2e2" : "#fdf6f2",
                        color: status === "delivered" ? "#15803d" : status === "dispatched" ? "#1e40af" : status === "cancelled" ? "#b91c1c" : "var(--wine)"
                      }}
                    >
                      {status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Body Details */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px", fontSize: "13px" }}>
                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>CUSTOMER:</span>
                    <strong>{order.customer_name}</strong>
                    <div style={{ marginTop: "4px" }}>
                      <a
                        href={`https://wa.me/91${order.customer_phone}?text=Hello%20${encodeURIComponent(order.customer_name)},%20this%20is%20SALORIYA%20Store%20regarding%20your%20order%20%23${order.order_id}.`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#15803d", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        📱 +91 {order.customer_phone} ↗
                      </a>
                    </div>
                  </div>

                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>DELIVERY ADDRESS:</span>
                    <span>{order.delivery_address}</span>
                  </div>

                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>ITEM &amp; VARIANT:</span>
                    <strong>{order.product_name}</strong>
                    <span style={{ display: "block", color: "var(--muted)", fontSize: "12px" }}>Colour: {order.variant_colour} · Qty: {order.quantity}</span>
                  </div>

                  <div>
                    <span style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>TOTAL AMOUNT:</span>
                    <strong style={{ fontSize: "16px", color: "var(--wine)" }}>{formatMoney(order.total_paise)}</strong>
                    {order.utr_number && (
                      <span style={{ display: "block", fontSize: "11px", color: "#6b21a8" }}>UTR: {order.utr_number}</span>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginTop: "14px", paddingTop: "10px", borderTop: "1px solid var(--line-subtle)" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {order.payment_screenshot && (
                      <button
                        type="button"
                        className="button"
                        style={{ padding: "6px 12px", fontSize: "11px", background: "#fdf4ff", border: "1px solid #f0abfc", color: "#a21caf" }}
                        onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                      >
                        📸 View UPI Screenshot
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Update Status:</span>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(order.order_id, e.target.value)}
                      style={{ padding: "4px 8px", fontSize: "11.5px", borderRadius: "4px", border: "1px solid var(--line)" }}
                    >
                      <option value="confirmed">Confirmed</option>
                      <option value="dispatched">Dispatched</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div className="product-modal" role="dialog" aria-modal="true">
          <div className="product-modal-backdrop" onClick={() => setSelectedScreenshot(null)}></div>
          <div className="product-modal-dialog" style={{ maxWidth: "450px", padding: "16px" }}>
            <button className="product-modal-close" onClick={() => setSelectedScreenshot(null)}>✕</button>
            <h4 style={{ margin: "0 0 10px" }}>Customer Payment Screenshot</h4>
            <div style={{ maxHeight: "70vh", overflow: "auto", textAlign: "center" }}>
              <img src={selectedScreenshot} alt="Payment Proof" style={{ maxWidth: "100%", borderRadius: "6px" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
