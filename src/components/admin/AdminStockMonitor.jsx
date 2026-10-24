import React from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminStockMonitor({ products, onProductChanged, onEditInStudio }) {
  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleStockUpdate = async (productId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    try {
      if (isSupabaseConfigured) {
        await supabase.from("products").update({ stock: newStock }).eq("id", productId);
      }
    } catch (e) {}

    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        local[idx].stock = newStock;
        localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
      }
    } catch (e) {}

    onProductChanged();
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
          <button className="button button-outline" type="button" onClick={onProductChanged}>
            ↻ Refresh Stock
          </button>
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
                  <th>Jewellery Piece</th>
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
                        <div className="stock-item-cell">
                          {thumb ? (
                            <img src={thumb} alt="" className="stock-table-thumb" />
                          ) : (
                            <div
                              className="stock-table-thumb"
                              style={{ display: "grid", placeItems: "center", color: "var(--wine)", fontFamily: "serif", fontSize: "18px" }}
                            >
                              S
                            </div>
                          )}
                          <div>
                            <strong>{p.name}</strong>
                            <div style={{ fontSize: "10px", color: "var(--muted)" }}>/{p.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td>{p.category}</td>
                      <td>
                        <strong>{formatMoney(p.price_paise)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "11px" }}>
                          {Array.isArray(p.colours) && p.colours.length > 0 ? p.colours.join(", ") : "Single Look"}
                        </span>
                      </td>
                      <td>
                        <span className={`stock-qty-badge ${stockClass}`}>{p.stock || 0} units</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: p.stock <= 0 ? "#dc2626" : p.stock <= 3 ? "#d97706" : "#16a34a"
                          }}
                        >
                          {stockLabel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            className="button button-outline button-small"
                            style={{ padding: "2px 8px", minHeight: "26px" }}
                            onClick={() => handleStockUpdate(p.id, p.stock || 0, -1)}
                          >
                            −
                          </button>
                          <strong style={{ minWidth: "24px", textAlign: "center" }}>{p.stock || 0}</strong>
                          <button
                            type="button"
                            className="button button-outline button-small"
                            style={{ padding: "2px 8px", minHeight: "26px" }}
                            onClick={() => handleStockUpdate(p.id, p.stock || 0, 1)}
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
