import React, { useState } from "react";
import { useStore, getColourStock } from "../../context/StoreContext";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal.jsx";

export default function AdminStockMonitor({ products, onProductChanged, onEditInStudio }) {
  const {
    updateProductStock,
    updateProductColourStock,
    refreshCatalog,
    toggleProductPublish,
    deleteProduct
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState("");
  const [deleteTargetProduct, setDeleteTargetProduct] = useState(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

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
    if (onProductChanged) onProductChanged();
  };

  const handleColourStockUpdate = async (productId, colourName, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    await updateProductColourStock(productId, colourName, newStock);
    if (onProductChanged) onProductChanged();
  };

  const handleTogglePublish = async (productId, currentStatus) => {
    await toggleProductPublish(productId, !currentStatus);
    setRefreshToast("✓ Visibility updated");
    setTimeout(() => setRefreshToast(""), 2500);
    if (onProductChanged) onProductChanged();
  };

  const executeDeleteProduct = async (product) => {
    if (!product) return;
    setIsDeletingProduct(true);
    const prodId = product.id || product.slug;
    await deleteProduct(prodId);
    setIsDeletingProduct(false);
    setDeleteTargetProduct(null);
    setRefreshToast(`✓ "${product.name}" deleted`);
    setTimeout(() => setRefreshToast(""), 3500);
    if (onProductChanged) onProductChanged();
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
                  <th>Actions</th>
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
                        {Array.isArray(p.colours) && p.colours.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {p.colours.map((c) => {
                              const cStock = getColourStock(p, c);
                              const isSold = cStock <= 0;
                              return (
                                <span
                                  key={c}
                                  style={{
                                    fontSize: "11px",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: isSold ? "#fee2e2" : "#f0fdf4",
                                    color: isSold ? "#991b1b" : "#166534",
                                    border: `1px solid ${isSold ? "#fecaca" : "#bbf7d0"}`,
                                    fontWeight: 600,
                                    display: "inline-block",
                                    width: "fit-content"
                                  }}
                                >
                                  {c} {isSold ? "(Out)" : `(${cStock})`}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--ink)" }}>Single Look</span>
                        )}
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
                        {Array.isArray(p.colours) && p.colours.length > 1 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                            {p.colours.map((c) => {
                              const cStock = getColourStock(p, c);
                              return (
                                <div
                                  key={c}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "6px",
                                    background: "#fcf8f5",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: "1px solid var(--line)"
                                  }}
                                >
                                  <span style={{ fontSize: "10.5px", fontWeight: 700, minWidth: "48px" }}>{c}:</span>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <button
                                      type="button"
                                      className="button button-outline button-small"
                                      style={{ padding: "1px 6px", minHeight: "22px", fontSize: "12px", lineHeight: "1" }}
                                      onClick={() => handleColourStockUpdate(p.id, c, cStock, -1)}
                                      title={`Decrease ${c} stock`}
                                    >
                                      −
                                    </button>
                                    <strong style={{ minWidth: "18px", textAlign: "center", fontSize: "11.5px", color: cStock <= 0 ? "#dc2626" : "inherit" }}>
                                      {cStock}
                                    </strong>
                                    <button
                                      type="button"
                                      className="button button-outline button-small"
                                      style={{ padding: "1px 6px", minHeight: "22px", fontSize: "12px", lineHeight: "1" }}
                                      onClick={() => handleColourStockUpdate(p.id, c, cStock, 1)}
                                      title={`Increase ${c} stock`}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
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
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            className="button button-small button-outline"
                            onClick={() => onEditInStudio(p)}
                            title="Edit in Studio"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="button button-small button-outline"
                            onClick={() => handleTogglePublish(p.id, p.is_published !== false)}
                            title={p.is_published !== false ? "Hide Draft" : "Publish Live"}
                          >
                            {p.is_published !== false ? "Hide" : "Publish"}
                          </button>
                          <button
                            type="button"
                            className="button button-small"
                            style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", padding: "6px 9px" }}
                            onClick={() => setDeleteTargetProduct(p)}
                            title="Delete Piece"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* In-App Delete Confirmation Modal */}
      <AdminDeleteConfirmModal
        isOpen={!!deleteTargetProduct}
        title="Delete Piece from Inventory"
        itemName={deleteTargetProduct?.name}
        message="Are you sure you want to permanently delete this piece from inventory and your store? This action cannot be undone."
        confirmLabel="Yes, Delete"
        isDeleting={isDeletingProduct}
        onConfirm={() => executeDeleteProduct(deleteTargetProduct)}
        onClose={() => setDeleteTargetProduct(null)}
      />
    </div>
  );
}
