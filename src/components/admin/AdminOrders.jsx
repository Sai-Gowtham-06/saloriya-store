import React, { useState } from "react";
import { getColourImage } from "../../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../../supabase.js";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal.jsx";
import AdminOrderPreviewModal from "./AdminOrderPreviewModal.jsx";

export default function AdminOrders({ orders, products = [], onOrderUpdated, onOpenRecordOrder }) {
  const [paymentFilter, setPaymentFilter] = useState("all"); // 'all' | 'prepaid' | 'cod'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewOrder, setPreviewOrder] = useState(null);
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

  const handleStatusChange = async (targetOrderId, newStatus, targetOrder = null) => {
    if (!targetOrderId) return;

    if (previewOrder && (previewOrder.order_id === targetOrderId || previewOrder.id === targetOrderId)) {
      setPreviewOrder((prev) => (prev ? { ...prev, status: newStatus, order_status: newStatus } : null));
    }

    // Toast feedback
    if (newStatus === "cancelled") {
      setOrderToast(`Order #${targetOrderId} marked Cancelled. Use the WhatsApp button to send cancellation note.`);
      setTimeout(() => setOrderToast(""), 5000);
    } else if (newStatus === "confirmed") {
      setOrderToast(`Order #${targetOrderId} marked Confirmed.`);
      setTimeout(() => setOrderToast(""), 3500);
    } else if (newStatus === "delivered") {
      setOrderToast(`✓ Order #${targetOrderId} moved to Delivered section.`);
      setTimeout(() => setOrderToast(""), 3500);
    } else if (newStatus === "shipped") {
      setOrderToast(`✓ Order #${targetOrderId} marked Shipped.`);
      setTimeout(() => setOrderToast(""), 3500);
    } else {
      setOrderToast(`✓ Order #${targetOrderId} updated to ${newStatus}.`);
      setTimeout(() => setOrderToast(""), 3000);
    }

    // 1. Update Central Orders API
    try {
      await fetch(`/api/orders/${encodeURIComponent(targetOrderId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, order_id: targetOrderId, id: targetOrderId })
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
          local[idx].order_status = newStatus;
          local[idx].updated_at = new Date().toISOString();
          localStorage.setItem("saloriya_admin_orders", JSON.stringify(local));
        }
      }
    } catch (e) { }

    if (onOrderUpdated) {
      try {
        await onOrderUpdated();
      } catch (err) {
        console.warn("Order reload after status change:", err);
      }
    }
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
    } catch (e) { }

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
    } catch (e) { }

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
    if (!o) return false;

    // Payment filter (supports "prepaid", "online", "upi" vs "cod")
    const payMethod = String(o.payment_method || "cod").toLowerCase();
    const isPrepaid = payMethod === "prepaid" || payMethod === "online" || payMethod === "upi";
    if (paymentFilter === "prepaid" && !isPrepaid) return false;
    if (paymentFilter === "cod" && isPrepaid) return false;

    // Status filter (case-insensitive, supports status & order_status)
    const currStatus = String(o.status || o.order_status || "confirmed").toLowerCase();
    if (statusFilter !== "all") {
      if (statusFilter === "shipped") {
        if (currStatus !== "shipped" && currStatus !== "dispatched") return false;
      } else if (currStatus !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = String(o.customer_name || "").toLowerCase().includes(q);
      const matchPhone = String(o.customer_phone || o.phone || "").includes(q);
      const matchId = String(o.order_id || o.id || "").toLowerCase().includes(q);
      const matchProduct = String(o.product_name || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchId && !matchProduct) return false;
    }

    return true;
  }).sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());

  const countPrepaid = orders.filter((o) => {
    if (!o) return false;
    const pm = String(o.payment_method || "cod").toLowerCase();
    return pm === "prepaid" || pm === "online" || pm === "upi";
  }).length;
  const countCod = orders.filter((o) => {
    if (!o) return false;
    const pm = String(o.payment_method || "cod").toLowerCase();
    return pm !== "prepaid" && pm !== "online" && pm !== "upi";
  }).length;

  const countPending = orders.filter((o) => o && String(o.status || o.order_status || "").toLowerCase() === "pending").length;
  const countConfirmed = orders.filter((o) => {
    if (!o) return false;
    const st = String(o.status || o.order_status || "confirmed").toLowerCase();
    return st === "confirmed" || !st;
  }).length;
  const countShipped = orders.filter((o) => {
    if (!o) return false;
    const st = String(o.status || o.order_status || "").toLowerCase();
    return st === "shipped" || st === "dispatched";
  }).length;
  const countDelivered = orders.filter((o) => o && String(o.status || o.order_status || "").toLowerCase() === "delivered").length;
  const countCancelled = orders.filter((o) => o && String(o.status || o.order_status || "").toLowerCase() === "cancelled").length;

  const activeOrders = filteredOrders.filter((o) => {
    const st = String(o.status || o.order_status || "confirmed").toLowerCase();
    return st !== "delivered";
  });

  const deliveredOrders = filteredOrders.filter((o) => {
    const st = String(o.status || o.order_status || "").toLowerCase();
    return st === "delivered";
  });

  const renderOrderCard = (order, idx, isDelivered = false) => {
    const payMethod = String(order.payment_method || "cod").toLowerCase();
    const isPrepaid = payMethod === "prepaid" || payMethod === "online" || payMethod === "upi";
    const status = String(order.status || order.order_status || (isDelivered ? "delivered" : "confirmed")).toLowerCase();
    const orderKey = order.order_id || order.id || `${isDelivered ? "del" : "ord"}_${idx}`;
    const formattedDate = (() => {
      if (!order.created_at) return "Recently placed";
      const d = new Date(order.created_at);
      return isNaN(d.getTime())
        ? "Recently placed"
        : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
    })();

    const customerPhone = String(order.customer_phone || order.phone || "").replace(/\D/g, "");
    const displayPhone = customerPhone ? (customerPhone.length > 10 ? customerPhone.slice(-10) : customerPhone) : "—";
    const customerAddress = order.delivery_address || (typeof order.address === "object" ? (order.address?.full || `${order.address?.street || ""}, ${order.address?.city || ""}`) : String(order.address || "Address on record"));

    return (
      <div
        key={orderKey}
        className={`order-card ${isDelivered ? "order-card-delivered" : ""}`}
        style={{
          cursor: "pointer",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          borderColor: isDelivered ? "#86efac" : undefined
        }}
        onClick={() => setPreviewOrder(order)}
        title="Click order to preview full details & large product photo"
      >
        <div className="order-card-header" style={{ background: isDelivered ? "#f0fdf4" : undefined }}>
          <div className="order-header-left">
            <span
              className="order-id-badge"
              title="Click to preview order"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOrder(order);
              }}
            >
              #{order.order_id || order.id || "SLR"}
            </span>
            <span className="order-date">
              {formattedDate}
            </span>
          </div>

          <div className="order-badges-group">
            <button
              type="button"
              className="button button-small"
              onClick={(e) => {
                e.stopPropagation();
                setPreviewOrder(order);
              }}
              style={{
                background: "#ffffff",
                color: isDelivered ? "#15803d" : "var(--wine)",
                border: isDelivered ? "1.5px solid #86efac" : "1.5px solid var(--wine)",
                fontWeight: 700,
                fontSize: "11px",
                padding: "3px 9px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
              }}
              title="Click to preview full order details with large product image"
            >
              👁️ Preview Order
            </button>
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
            <strong style={{ fontSize: "15px", color: "var(--ink)" }}>{order.customer_name || "Valued Customer"}</strong>
            <div>
              {customerPhone ? (
                <a
                  href={`https://wa.me/91${displayPhone}?text=Hello%20${encodeURIComponent(order.customer_name || "Customer")},%20this%20is%20SALORIYA%20Store%20regarding%20your%20order%20%23${order.order_id || order.id}.`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
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
                  📱 +91 {displayPhone}
                </a>
              ) : (
                <span style={{ color: "var(--muted)", fontSize: "12px" }}>📱 Phone not provided</span>
              )}
            </div>
            <div style={{ fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.4, marginTop: "4px" }}>
              📍 {customerAddress}
            </div>
          </div>

          {/* Order Items Column with Preview Image or Multi-Item List */}
          <div className="order-items-col">
            <span className="order-section-subtitle">Ordered Pieces</span>
            {(() => {
              const parsedItems = Array.isArray(order.items)
                ? order.items
                : (typeof order.items === "string" ? (() => { try { const p = JSON.parse(order.items); return Array.isArray(p) ? p : null; } catch(e) { return null; } })() : null);
              const hasMultiItems = Array.isArray(parsedItems) && parsedItems.length > 0;

              if (hasMultiItems) {
                return (
                  <div
                    style={{
                      background: isDelivered ? "#f4fcf6" : "#fcf8f5",
                      border: "1px solid var(--line-subtle)",
                      borderRadius: "8px",
                      padding: "10px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid var(--line-subtle)",
                        paddingBottom: "6px"
                      }}
                    >
                      <span style={{ fontSize: "11.5px", color: isDelivered ? "#15803d" : "var(--wine)", fontWeight: 700 }}>
                        👜 {parsedItems.length} {parsedItems.length === 1 ? "Piece" : "Pieces"} in Cart Order
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span
                          style={{
                            fontSize: "11px",
                            color: isDelivered ? "#15803d" : "var(--wine)",
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewOrder(order);
                          }}
                        >
                          👁️ Preview Pieces
                        </span>
                        <strong style={{ fontSize: "14px", color: isDelivered ? "#15803d" : "var(--wine)" }}>
                          Total: {formatMoney(order.total_paise)}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto", paddingRight: "2px" }}>
                      {parsedItems.map((it, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            background: "#ffffff",
                            border: "1px solid var(--line-subtle)",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            cursor: "pointer",
                            transition: "background 0.15s ease"
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewOrder(order);
                          }}
                          title="Click to preview order with large piece image"
                        >
                          {it.product_image ? (
                            <img
                              src={it.product_image}
                              alt={it.product_name}
                              style={{
                                width: "50px",
                                height: "50px",
                                borderRadius: "6px",
                                objectFit: "cover",
                                border: "1px solid var(--line)",
                                flexShrink: 0,
                                boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
                              }}
                            />
                          ) : (
                            <div style={{ width: "50px", height: "50px", borderRadius: "6px", display: "grid", placeItems: "center", background: "#faf4f0", color: "var(--wine)", fontFamily: "serif", fontSize: "16px", flexShrink: 0 }}>
                              S
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: "12.5px", color: "var(--ink)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {it.product_name}
                            </strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                              Colour: <strong>{it.variant_colour || "Standard"}</strong> · Qty: <strong>{it.quantity || 1}</strong>
                            </div>
                          </div>
                          <strong style={{ fontSize: "12px", color: isDelivered ? "#15803d" : "var(--wine)", flexShrink: 0 }}>
                            {formatMoney(it.subtotal_paise || ((it.unit_price_paise || 0) * (it.quantity || 1)))}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {order.utr_number && (
                      <div style={{ fontSize: "11px", color: "#6b21a8", marginTop: "4px", fontWeight: 600 }}>
                        UPI Ref / UTR: {order.utr_number}
                      </div>
                    )}
                  </div>
                );
              }

              // Fallback: Single product display
              const matchedProduct = products?.find(
                (p) => p.id === order.product_id || (p.name && order.product_name && p.name.trim().toLowerCase() === order.product_name.trim().toLowerCase())
              );
              const orderImg = order.product_image || (matchedProduct ? (getColourImage(matchedProduct, order.variant_colour, 0) || matchedProduct.image_urls?.[0] || matchedProduct.images?.[0]) : "");

              return (
                <div
                  style={{
                    background: isDelivered ? "#f4fcf6" : "#fcf8f5",
                    border: isDelivered ? "1px solid #bbf7d0" : "1px solid var(--line-subtle)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    transition: "background 0.15s ease"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOrder(order);
                  }}
                  title="Click to preview order details and see large product image"
                >
                  <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
                    <div
                      style={{
                        position: "relative",
                        flexShrink: 0,
                        cursor: "pointer"
                      }}
                      title="Click to preview large product photo"
                    >
                      {orderImg ? (
                        <img
                          src={orderImg}
                          alt={order.product_name}
                          style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "8px",
                            objectFit: "cover",
                            border: isDelivered ? "1.5px solid #86efac" : "1.5px solid var(--gold-border)",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            display: "block"
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "80px",
                            height: "80px",
                            borderRadius: "8px",
                            display: "grid",
                            placeItems: "center",
                            background: "#faf4f0",
                            border: "1.5px solid var(--gold-border)",
                            color: "var(--wine)",
                            fontFamily: "serif",
                            fontSize: "20px"
                          }}
                        >
                          S
                        </div>
                      )}
                      <span
                        style={{
                          position: "absolute",
                          bottom: "3px",
                          right: "3px",
                          background: isDelivered ? "rgba(21,128,61,0.9)" : "rgba(134,30,56,0.85)",
                          color: "#fff",
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: "3px",
                          lineHeight: 1.2
                        }}
                      >
                        🔍 View
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: "14px", color: "var(--ink)", display: "block" }}>
                        {order.product_name}
                      </strong>
                      <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                        Colour: <strong>{order.variant_colour || "Standard"}</strong> · Qty: <strong>{order.quantity || 1} pc</strong>
                      </div>
                      <div style={{ fontSize: "11px", color: isDelivered ? "#15803d" : "var(--wine)", marginTop: "4px", fontWeight: 700 }}>
                        👁️ Click to preview full order details
                      </div>
                    </div>

                    <strong style={{ fontSize: "16px", color: isDelivered ? "#15803d" : "var(--wine)", flexShrink: 0 }}>
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

        {/* Footer Actions Strip with WhatsApp Status Notification & Live Status Selector */}
        {(() => {
          const phoneDigits = (order.customer_phone || order.phone || "").replace(/\D/g, "").slice(-10);
          const custName = order.customer_name || "Valued Customer";
          const oId = order.order_id || order.id || "SLR";
          const pName = order.product_name || "Jewellery Order";
          const totalFormatted = formatMoney(order.total_paise);
          const custAddress = order.delivery_address || (typeof order.address === "object" ? (order.address?.full || `${order.address?.street || ""}, ${order.address?.city || ""}`) : String(order.address || "Address on record"));

          const cancellationNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been cancelled. If you have any questions or would like to choose another piece from our catalogue, feel free to reply directly to this message. Team SALORIYA.`;
          const confirmationNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been confirmed! Total: ${totalFormatted}. We are carefully packing your jewellery for dispatch. Thank you for shopping with SALORIYA!`;
          const shippedNote = `Namaste ${custName}, your SALORIYA order #${oId} for "${pName}" has been dispatched and shipped! Delivery address: ${custAddress}. Team SALORIYA.`;
          const generalNote = `Namaste ${custName}, this is SALORIYA Store regarding your order #${oId}.`;

          const waCancelUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(cancellationNote)}`;
          const waConfirmUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(confirmationNote)}`;
          const waShippedUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(shippedNote)}`;
          const waGeneralUrl = `https://wa.me/91${phoneDigits}?text=${encodeURIComponent(generalNote)}`;

          return (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                padding: "12px 20px",
                background: isDelivered ? "#f4fcf6" : "#fbf7f4",
                borderTop: isDelivered ? "1px solid #bbf7d0" : "1px solid var(--line)"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="button button-small"
                  style={{
                    background: "#ffffff",
                    color: isDelivered ? "#15803d" : "var(--wine)",
                    border: isDelivered ? "1.5px solid #86efac" : "1.5px solid var(--wine)",
                    fontWeight: 700,
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    cursor: "pointer"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewOrder(order);
                  }}
                  title="Preview order with large product image"
                >
                  👁️ Preview Order
                </button>

                {order.payment_screenshot && (
                  <button
                    type="button"
                    className="button button-small"
                    style={{
                      padding: "6px 12px",
                      fontSize: "11px",
                      background: "#fdf4ff",
                      border: "1px solid #f0abfc",
                      color: "#a21caf"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedScreenshot(order.payment_screenshot);
                    }}
                  >
                    📸 View Proof
                  </button>
                )}

                {/* Status-specific WhatsApp Note Actions */}
                {status === "cancelled" && (
                  <a
                    href={waCancelUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="button button-small"
                    style={{
                      background: "#fef2f2",
                      color: "#b91c1c",
                      border: "1.5px solid #f87171",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700,
                      boxShadow: "0 1px 4px rgba(185,28,28,0.12)"
                    }}
                    title="Send cancellation note to customer's WhatsApp"
                  >
                    <span>💬 Cancellation Note</span>
                  </a>
                )}

                {status === "confirmed" && (
                  <a
                    href={waConfirmUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="button button-small"
                    style={{
                      background: "#f0fdf4",
                      color: "#15803d",
                      border: "1.5px solid #86efac",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700
                    }}
                    title="Send confirmation note to customer's WhatsApp"
                  >
                    <span>💬 Confirmation Note</span>
                  </a>
                )}

                {status === "shipped" && (
                  <a
                    href={waShippedUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="button button-small"
                    style={{
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1.5px solid #93c5fd",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700
                    }}
                    title="Send shipping dispatch note to customer's WhatsApp"
                  >
                    <span>🚚 Shipping Note</span>
                  </a>
                )}

                <a
                  href={waGeneralUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="button button-small"
                  style={{
                    background: "#ffffff",
                    color: "#166534",
                    border: "1px solid #bbf7d0",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px"
                  }}
                  title="Message customer on WhatsApp"
                >
                  <span>💬 Message</span>
                </a>
              </div>

              {/* Status Selector Dropdown (Active in both main and delivered section) */}
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", color: isDelivered ? "#166534" : "var(--muted)", fontWeight: 700 }}>
                  Status:
                </span>
                <select
                  value={status}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => handleStatusChange(order.order_id || order.id, e.target.value, order)}
                  style={{
                    padding: "5px 10px",
                    fontSize: "11.5px",
                    borderRadius: "6px",
                    border: isDelivered ? "1.5px solid #86efac" : "1px solid var(--line)",
                    background: "#fff",
                    fontWeight: 700,
                    color: isDelivered ? "#15803d" : "var(--wine)"
                  }}
                  title="Change order status (updates immediately)"
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
                  style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", marginLeft: "4px" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTargetOrder(order);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  };

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
        ) : statusFilter === "delivered" ? (
          /* Filtered specifically to Delivered */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              className="delivered-section-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: "10px",
                padding: "12px 18px",
                flexWrap: "wrap",
                gap: "10px"
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16.5px", color: "#166534", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Playfair Display', serif" }}>
                  <span>🎁 Delivered Orders</span>
                  <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "12px", padding: "2px 8px", borderRadius: "12px", border: "1px solid #86efac" }}>
                    {deliveredOrders.length}
                  </span>
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#166534" }}>
                  Orders delivered to customer. Status can be changed anytime below.
                </p>
              </div>
            </div>
            {deliveredOrders.map((o, idx) => renderOrderCard(o, idx, true))}
          </div>
        ) : statusFilter === "all" ? (
          /* All view: Active Orders Section FIRST, then Separate Delivered Orders Section */
          <div>
            {/* 1. Active & Processing Orders Section */}
            <div className="active-orders-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "14px",
                  paddingBottom: "8px",
                  borderBottom: "1.5px solid var(--line)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", color: "var(--ink)", fontFamily: "'Playfair Display', serif" }}>
                    Active &amp; Processing Orders
                  </h3>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "12px", background: "rgba(134,30,56,0.1)", color: "var(--wine)" }}>
                    {activeOrders.length}
                  </span>
                </div>
                <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                  Pending, Confirmed &amp; Dispatched Orders
                </span>
              </div>

              {activeOrders.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {activeOrders.map((o, idx) => renderOrderCard(o, idx, false))}
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", background: "#fcf8f5", borderRadius: "10px", border: "1px dashed var(--line)", marginBottom: "20px" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                    ✨ No active pending orders. All current orders have been completed and delivered!
                  </p>
                </div>
              )}
            </div>

            {/* 2. Separate Delivered Orders Section */}
            <div className="delivered-orders-section">
              <div className="delivered-section-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: "16.5px", color: "#166534", display: "flex", alignItems: "center", gap: "8px", fontFamily: "'Playfair Display', serif" }}>
                    <span>🎁 Delivered Orders</span>
                    <span style={{ background: "#dcfce7", color: "#15803d", fontWeight: 700, fontSize: "12px", padding: "2px 8px", borderRadius: "12px", border: "1px solid #86efac" }}>
                      {deliveredOrders.length}
                    </span>
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#166534" }}>
                    Safely delivered pieces. You can update status back to active anytime below.
                  </p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", background: "#ffffff", padding: "4px 10px", borderRadius: "6px", border: "1px solid #86efac" }}>
                  ✓ Status changers active in section
                </span>
              </div>

              {deliveredOrders.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {deliveredOrders.map((o, idx) => renderOrderCard(o, idx, true))}
                </div>
              ) : (
                <div style={{ padding: "24px", textAlign: "center", background: "#ffffff", borderRadius: "10px", border: "1px dashed #bbf7d0" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
                    No orders marked as Delivered yet. When an order status is set to Delivered, it will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Filtered to pending / confirmed / shipped / cancelled */
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredOrders.map((o, idx) => renderOrderCard(o, idx, false))}
          </div>
        )}
      </div>

      {/* Full Order Preview Modal */}
      <AdminOrderPreviewModal
        isOpen={!!previewOrder}
        order={previewOrder}
        products={products}
        onClose={() => setPreviewOrder(null)}
        onStatusChange={handleStatusChange}
        formatMoney={formatMoney}
      />

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
