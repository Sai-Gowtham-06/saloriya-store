import React from "react";

export default function AdminMetrics({ orders }) {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === "pending" || !o.status).length;
  const confirmedOrders = orders.filter((o) => o.status === "confirmed" || o.status === "dispatched" || o.status === "delivered").length;
  
  const totalRevenuePaise = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.total_paise || 0), 0);

  const formatRevenue = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format((paise || 0) / 100);
  };

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <span className="metric-label">Total Orders</span>
        <strong className="metric-value">{totalOrders}</strong>
        <span className="metric-sub">All-time placed orders</span>
      </div>
      <div className="metric-card metric-card-highlight">
        <div className="metric-header-row">
          <span className="metric-label">Pending Confirmation</span>
          {pendingOrders > 0 && <span className="pulse-dot"></span>}
        </div>
        <strong className="metric-value" style={{ color: "#d97706" }}>
          {pendingOrders}
        </strong>
        <span className="metric-sub">Awaiting stock deduction</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Confirmed / In-Transit</span>
        <strong className="metric-value" style={{ color: "#15803d" }}>
          {confirmedOrders}
        </strong>
        <span className="metric-sub">Stock already deducted</span>
      </div>
      <div className="metric-card">
        <span className="metric-label">Total Revenue</span>
        <strong className="metric-value" style={{ color: "var(--wine)" }}>
          {formatRevenue(totalRevenuePaise)}
        </strong>
        <span className="metric-sub">Confirmed &amp; completed sales</span>
      </div>
    </div>
  );
}
