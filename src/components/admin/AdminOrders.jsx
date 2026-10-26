import React, { useState } from "react";
import { getColourImage } from "../../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../../supabase.js";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal.jsx";

export default function AdminOrders({ orders, products = [], onOrderUpdated, onOpenRecordOrder }) {
  const [paymentFilter, setPaymentFilter] = useState("all"); // 'all' | 'prepaid' | 'cod'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [deleteTargetOrder, setDeleteTargetOrder] = useState(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [orderToast, setOrderToast] = useState("");
  const [isRefreshingOrders, setIsRefreshingOrders] = useState(false);

  const handleRefreshOrders = async () => {
    setIsRefreshingOrders(true);
    setOrderToast("");
    try {
      if (onOrderUpdated) {
        await onOrderUpdated();
      }
      setOrderToast("✓ Orders refreshed successfully");
      setTimeout(() => setOrderToast(""), 3000);
    } catch (e) {
      setOrderToast("Orders refreshed");
      setTimeout(() => setOrderToast(""), 2000);
    } finally {
      setIsRefreshingOrders(false);
    }
  };

  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleStatusChange = async (targetOrderId, newStatus) => {
    if (!targetOrderId) return;

    // 1. Update Central Orders API
    try {
      await fetch(`/api/orders/${encodeURIComponent(targetOrderId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (apiErr) {
      console.warn("Central API update status error:", apiErr);
    }

    // 2. Update Supabase
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from("orders")
          .update({ status: newStatus, order_status: newStatus })
          .or(`order_id.eq.${targetOrderId},id.eq.${targetOrderId}`);
      }
    } catch (e) {
      console.warn("Supabase update error:", e);
    }

    // 3. Update localStorage
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      if (Array.isArray(local)) {
        const idx = local.findIndex(
          (o) => (o.order_id && o.order_id === targetOrderId) || (o.id && o.id === targetOrderId)
        );
        if (idx !== -1) {
          local[idx].status = newStatus;
          localStorage.setItem("saloriya_admin_orders", JSON.stringify(local));
        }
      }
    } catch (e) {}

    onOrderUpdated();
  };

  const executeDeleteOrder = async (order) => {
    if (!order) return;
    setIsDeletingOrder(true);
    const targetOrderId = order.order_id ? String(order.order_id).trim() : null;
    const targetDbId = order.id ? String(order.id).trim() : null;
    const identifier = targetOrderId || targetDbId;

    if (!identifier) {
      setIsDeletingOrder(false);
      setDeleteTargetOrder(null);
      return;
    }

    // 1. Add valid ID(s) to deleted tracking list
    try {
      const rawDeleted = JSON.parse(localStorage.getItem("saloriya_deleted_order_ids") || "[]");
      const deleted = Array.isArray(rawDeleted)
        ? rawDeleted.filter((d) => d && d !== "undefined" && d !== "null" && typeof d === "string" && d.trim())
        : [];
      if (targetOrderId && !deleted.includes(targetOrderId)) deleted.push(targetOrderId);
      if (targetDbId && !deleted.includes(targetDbId)) deleted.push(targetDbId);
      localStorage.setItem("saloriya_deleted_order_ids", JSON.stringify(deleted));
    } catch (e) {}

    // 2. Remove from Central Orders API
    try {
      if (targetOrderId) {
        await fetch(`/api/orders/${encodeURIComponent(targetOrderId)}`, { method: "DELETE" });
      }
      if (targetDbId && targetDbId !== targetOrderId) {
        await fetch(`/api/orders/${encodeURIComponent(targetDbId)}`, { method: "DELETE" });
      }
    } catch (apiErr) {
      console.warn("Central API delete error:", apiErr);
    }

    // 3. Remove precisely ONLY this target order from localStorage
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      if (Array.isArray(local)) {
        const filtered = local.filter((o) => {
          if (!o) return false;
          const currOrderId = o.order_id ? String(o.order_id).trim() : null;
          const currDbId = o.id ? String(o.id).trim() : null;
          const isTarget =
            (targetOrderId && (currOrderId === targetOrderId || currDbId === targetOrderId)) ||
            (targetDbId && (currOrderId === targetDbId || currDbId === targetDbId));
          return !isTarget;
        });
        localStorage.setItem("saloriya_admin_orders", JSON.stringify(filtered));
      }
    } catch (e) {}

    // 4. Delete from Supabase
    try {
      if (isSupabaseConfigured) {
        if (targetOrderId) await supabase.from("orders").delete().eq("order_id", targetOrderId);
        if (targetDbId && targetDbId !== targetOrderId) await supabase.from("orders").delete().eq("id", targetDbId);
      }
    } catch (e) {
      console.warn("Supabase delete order:", e);
    }

    setIsDeletingOrder(false);
    setDeleteTargetOrder(null);
    setOrderToast(`✓ Order #${identifier} deleted successfully`);
    setTimeout(() => setOrderToast(""), 3500);

    if (onOrderUpdated) onOrderUpdated();
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

  const countPending = orders.filter((o) => o.status === "pending").length;
  const countConfirmed = orders.filter((o) => o.status === "confirmed" || !o.status).length;
  const countShipped = orders.filter((o) => o.status === "shipped" || o.status === "dispatched").length;
  const countDelivered = orders.filter((o) => o.status === "delivered").length;
  const countCancelled = orders.filter((o) => o.status === "cancelled").length;

  return (
    <div id="view-orders" className="admin-tab-view active">
      {/* Payment Mode Tabs */}
      <div className="orders-payment-type-tabs" style={{ marginBottom: "18px" }}>
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

      {/* Orders Toolbar */}
      <div className="orders-toolbar">
        <div className="orders-search-box">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            id="orders-search"
            placeholder="Search orders by customer, phone, product, or Order ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="orders-filter-chips">
          <button
            type="button"
            className={`filter-chip ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All ({orders.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            Pending ({countPending})
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "confirmed" ? "active" : ""}`}
            onClick={() => setStatusFilter("confirmed")}
          >
            Confirmed ({countConfirmed})
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "shipped" ? "active" : ""}`}
            onClick={() => setStatusFilter("shipped")}
          >
            Shipped ({countShipped})
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "delivered" ? "active" : ""}`}
            onClick={() => setStatusFilter("delivered")}
          >
            Delivered ({countDelivered})
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === "cancelled" ? "active" : ""}`}
            onClick={() => setStatusFilter("cancelled")}
          >
            Cancelled ({countCancelled})
          </button>
        </div>

        <div className="orders-toolbar-actions" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {orderToast && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--wine)",
                fontWeight: 600,
                background: "rgba(134,30,56,0.08)",
                padding: "4px 10px",
                borderRadius: "4px"
              }}
            >
              {orderToast}
            </span>
          )}
          <button
            type="button"
            className="button button-outline button-small"
            onClick={handleRefreshOrders}
            disabled={isRefreshingOrders}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span
              style={{
                display: "inline-block",
                transform: isRefreshingOrders ? "rotate(360deg)" : "none",
                transition: "transform 0.6s ease"
              }}
            >
              ↻
            </span>
            <span>{isRefreshingOrders ? "Refreshing…" : "Refresh Orders"}</span>
          </button>
          {onOpenRecordOrder && (
            <button type="button" className="button button-dark button-small" onClick={onOpenRecordOrder}>
              + New Order
            </button>
          )}
        </div>
      </div>

      {/* Orders List Container */}
      <div id="orders-list-container" className="orders-list-container">
        {filteredOrders.length === 0 ? (
          <div className="empty-orders-box">
            <p style={{ fontSize: "28px", marginBottom: "8px" }}>📦</p>
            <strong>No orders match your filters</strong>
            <p className="hint">Try switching payment tab or clearing search filters.</p>
          </div>
        ) : (
          filteredOrders.map((order, idx) => {
            const isPrepaid = order.payment_method === "prepaid";
            const status = order.status || "confirmed";
            const orderKey = order.order_id || order.id || `order_${idx}`;
            const formattedDate = (() => {
              if (!order.created_at) return "Recently placed";
              const d = new Date(order.created_at);
              return isNaN(d.getTime())
                ? "Recently placed"
                : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
            })();

            return (
              <div key={orderKey} className="order-card">
                <div className="order-card-header">
                  <div className="order-header-left">
                    <span className="order-id-badge" title="Order ID">
                      #{order.order_id || order.id || "SLR"}
                    </span>
                    <span className="order-date">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="order-badges-group">
                    <span className={`payment-tag ${isPrepaid ? "paid" : ""}`}>
                      {isPrepaid ? "⚡ UPI PREPAID" : "💵 CASH ON DELIVERY"}
                    </span>
                    <span className={`status-tag status-tag-${status}`}>
                      {status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="order-card-body">
                  {/* Customer Column */}
                  <div className="order-customer-col">
                    <span className="order-section-subtitle">Customer Details</span>
                    <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{order.customer_name}</strong>
                    <div>
                      <a
                        href={`https://wa.me/91${order.customer_phone}?text=Hello%20${encodeURIComponent(order.customer_name)},%20this%20is%20SALORIYA%20Store%20regarding%20your%20order%20%23${order.order_id}.`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#15803d",
                          fontWeight: 600,
                          fontSize: "13px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          textDecoration: "none"
                        }}
                      >
                        📱 +91 {order.customer_phone} 
                      </a>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4, marginTop: "4px" }}>
                      📍 {order.delivery_address}
                    </div>
                  </div>

                  {/* Order Items Column with Preview Image */}
                  <div className="order-items-col">
                    <span className="order-section-subtitle">Ordered Pieces</span>
                    {(() => {
                      const matchedProduct = products?.find(
                        (p) => p.id === order.product_id || (p.name && order.product_name && p.name.trim().toLowerCase() === order.product_name.trim().toLowerCase())
                      );
                      const orderImg = order.product_image || (matchedProduct ? (getColourImage(matchedProduct, order.variant_colour, 0) || matchedProduct.image_urls?.[0] || matchedProduct.images?.[0]) : "");

                      return (
                        <div style={{ background: "#fcf8f5", border: "1px solid var(--line-subtle)", borderRadius: "8px", padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                            {orderImg ? (
                              <img
                                src={orderImg}
                                alt={order.product_name}
                                style={{
                                  width: "64px",
                                  height: "64px",
                                  borderRadius: "8px",
                                  objectFit: "cover",
                                  border: "1.5px solid var(--gold-border)",
                                  boxShadow: "0 2px 8px rgba(134,30,56,0.08)",
                                  flexShrink: 0
                                }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "64px",
                                  height: "64px",
                                  borderRadius: "8px",
                                  display: "grid",
                                  placeItems: "center",
                                  background: "#faf4f0",
                                  border: "1.5px solid var(--gold-border)",
                                  color: "var(--wine)",
                                  fontFamily: "serif",
                                  fontSize: "20px",
                                  flexShrink: 0
                                }}
                              >
                                S
                              </div>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={{ fontSize: "14px", color: "var(--ink)", display: "block" }}>
                                {order.product_name}
                              </strong>
                              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                                Colour: <strong>{order.variant_colour || "Standard"}</strong> · Qty: <strong>{order.quantity || 1} pc</strong>
                              </div>
                            </div>

                            <strong style={{ fontSize: "16px", color: "var(--wine)", flexShrink: 0 }}>
                              {formatMoney(order.total_paise)}
                            </strong>
                          </div>

                          {order.utr_number && (
                            <div style={{ fontSize: "11px", color: "#6b21a8", marginTop: "8px", fontWeight: 600 }}>
                              UPI Ref / UTR: {order.utr_number}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Footer Actions Strip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "10px",
                    padding: "12px 20px",
                    background: "#fbf7f4",
                    borderTop: "1px solid var(--line)"
                  }}
                >
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {order.payment_screenshot && (
                      <button
                        type="button"
                        className="button"
                        style={{
                          padding: "6px 12px",
                          fontSize: "11px",
                          background: "#fdf4ff",
                          border: "1px solid #f0abfc",
                          color: "#a21caf"
                        }}
                        onClick={() => setSelectedScreenshot(order.payment_screenshot)}
                      >
                        📸 View UPI Screenshot Proof
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>Status:</span>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(order.order_id || order.id, e.target.value)}
                      style={{
                        padding: "5px 10px",
                        fontSize: "11.5px",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                        background: "#fff",
                        fontWeight: 600
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>

                    <button
                      type="button"
                      className="button button-small"
                      style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", marginLeft: "8px" }}
                      onClick={() => setDeleteTargetOrder(order)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Screenshot Modal Lightbox */}
      {selectedScreenshot && (
        <div className="product-modal" role="dialog" aria-modal="true">
          <div className="product-modal-backdrop" onClick={() => setSelectedScreenshot(null)}></div>
          <div className="product-modal-dialog" style={{ maxWidth: "480px", padding: "20px" }}>
            <button className="product-modal-close" onClick={() => setSelectedScreenshot(null)}>
              ✕
            </button>
            <h4 style={{ margin: "0 0 12px", fontFamily: "'Playfair Display', serif", fontSize: "18px" }}>
              Customer Payment Confirmation
            </h4>
            <div style={{ maxHeight: "75vh", overflow: "auto", textAlign: "center", borderRadius: "8px" }}>
              <img src={selectedScreenshot} alt="Payment Proof" style={{ maxWidth: "100%", borderRadius: "8px" }} />
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      <AdminDeleteConfirmModal
        isOpen={!!deleteTargetOrder}
        title="Delete Order Record"
        itemName={
          deleteTargetOrder
            ? `Order #${deleteTargetOrder.order_id || deleteTargetOrder.id} — ${deleteTargetOrder.customer_name || "Customer"}`
            : ""
        }
        message="Are you sure you want to permanently delete this order record? This cannot be undone."
        confirmLabel="Yes, Delete"
        isDeleting={isDeletingOrder}
        onConfirm={() => executeDeleteOrder(deleteTargetOrder)}
        onClose={() => setDeleteTargetOrder(null)}
      />

      {/* Order Toast Notification */}
      {orderToast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#15803d",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 99999
          }}
        >
          {orderToast}
        </div>
      )}
    </div>
  );
}
