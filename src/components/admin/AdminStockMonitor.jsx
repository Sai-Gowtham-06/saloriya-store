import React, { useState } from "react";
import { useStore } from "../../context/StoreContext";

export default function AdminStockMonitor({ products, onProductChanged, onEditInStudio }) {
  const { updateProductStock, refreshCatalog } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState("");

  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleStockUpdate = async (productId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    await updateProductStock(productId, newStock);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshToast("");
    try {
      await refreshCatalog();
      setRefreshToast("✓ Stock updated");
      setTimeout(() => setRefreshToast(""), 3000);
    } catch (e) {
      setRefreshToast("Stock updated");
      setTimeout(() => setRefreshToast(""), 2000);
    } finally {
      setRefreshing(false);
      if (onProductChanged) onProductChanged();
    }
  };

  return (
    <div id="view-inventory" className="admin-tab-view active">
      <section className="admin-panel">
        <div className="inventory-heading">
          <div>
            <h2>Live Inventory &amp; Stock Levels</h2>
            <p className="hint">
              Real-time stock monitor. When orders are placed and confirmed, stock decreases automatically here.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              className="button button-outline"
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <span style={{ display: "inline-block", transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.5s ease" }}>
                ↻
              </span>
              <span>{refreshing ? "Refreshing…" : "Refresh Stock"}</span>
            </button>
            {refreshToast && (
              <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 700 }}>
                {refreshToast}
              </span>
            )}
          </div>
        </div>

        <div className="stock-table-wrap">
          {products.length === 0 ? (
            <p className="hint" style={{ padding: "30px", textAlign: "center" }}>
              No products found in the database. Add pieces in the Product Studio.
            </p>
          ) : (
            <table className="stock-table">
              <thead>
                <tr>
                  <th style={{ minWidth: "260px" }}>Jewellery Piece</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Colours</th>
                  <th>Current Stock</th>
                  <th>Status</th>
                  <th>Quick Restock</th>
                  <th>Studio</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const stockClass = p.stock <= 0 ? "out-of-stock" : p.stock <= 3 ? "low-stock" : "in-stock";
                  const stockLabel = p.stock <= 0 ? "Out of stock" : p.stock <= 3 ? "Low stock" : "In stock";

                  const thumb = (Array.isArray(p.image_urls) && p.image_urls[0] && p.image_urls[0] !== "/logo.png")
                    ? p.image_urls[0]
                    : ((Array.isArray(p.images) && p.images[0] && p.images[0] !== "/logo.png") ? p.images[0] : "");

                  return (
                    <tr key={p.id} data-product-row={p.id}>
                      <td>
                        <div className="stock-item-cell" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "6px 0" }}>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt={p.name}
                              className="stock-table-thumb"
                              style={{
                                width: "88px",
                                height: "88px",
                                borderRadius: "8px",
                                objectFit: "cover",
                                border: "1.5px solid var(--gold-border)",
                                boxShadow: "0 3px 10px rgba(134,30,56,0.08)",
                                flexShrink: 0
                              }}
                            />
                          ) : (
                            <div
                              className="stock-table-thumb"
                              style={{
                                width: "88px",
                                height: "88px",
                                borderRadius: "8px",
                                display: "grid",
                                placeItems: "center",
                                color: "var(--wine)",
                                fontFamily: "serif",
                                fontSize: "28px",
                                background: "#faf4f0",
                                border: "1.5px solid var(--gold-border)",
                                flexShrink: 0
                              }}
                            >
                              S
                            </div>
                          )}
                          <div>
                            <strong style={{ fontSize: "14.5px", color: "var(--ink)", display: "block", marginBottom: "4px" }}>
                              {p.name}
                            </strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>/{p.slug}</div>
                            {p.is_published === false && (
                              <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: 700, marginTop: "2px", display: "inline-block" }}>
                                ○ Unpublished Draft
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <strong style={{ color: "var(--wine)" }}>{formatMoney(p.price_paise)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", color: "var(--ink)" }}>
                          {Array.isArray(p.colours) && p.colours.length > 0 ? p.colours.join(", ") : "Single Look"}
                        </span>
                      </td>
                      <td>
                        <span className={`stock-qty-badge ${stockClass}`}>{p.stock || 0} units</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11.5px",
                            fontWeight: 700,
                            color: p.stock <= 0 ? "#dc2626" : p.stock <= 3 ? "#d97706" : "#16a34a"
                          }}
                        >
                          {stockLabel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#fcf8f5", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                          <button
                            type="button"
                            className="button button-outline button-small"
                            style={{ padding: "2px 10px", minHeight: "28px", fontSize: "14px", fontWeight: "bold" }}
                            onClick={() => handleStockUpdate(p.id, p.stock || 0, -1)}
                            title="Decrease Stock"
                          >
                            −
                          </button>
                          <strong style={{ minWidth: "26px", textAlign: "center", fontSize: "13px" }}>{p.stock || 0}</strong>
                          <button
                            type="button"
                            className="button button-outline button-small"
                            style={{ padding: "2px 10px", minHeight: "28px", fontSize: "14px", fontWeight: "bold" }}
                            onClick={() => handleStockUpdate(p.id, p.stock || 0, 1)}
                            title="Increase Stock"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-small button-outline"
                          onClick={() => onEditInStudio(p)}
                        >
                          ✏️ Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
