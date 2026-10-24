import React from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminInventoryList({ products, onEdit, onProductChanged }) {
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

  const handleDelete = async (productId, productName) => {
    if (!window.confirm(`Are you sure you want to delete "${productName}" from your storefront?`)) {
      return;
    }

    try {
      if (isSupabaseConfigured) {
        await supabase.from("products").delete().eq("id", productId);
      }
    } catch (e) {}

    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const filtered = local.filter((p) => p.id !== productId);
      localStorage.setItem("saloriya_admin_products", JSON.stringify(filtered));
    } catch (e) {}

    onProductChanged();
  };

  return (
    <div className="admin-panel" style={{ marginBottom: "30px" }}>
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div>
          <p className="eyebrow">CURRENT STOCK</p>
          <h2 style={{ fontSize: "24px" }}>Storefront Jewellery Inventory ({products.length})</h2>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {products.map((p) => {
          const isOut = (p.stock || 0) <= 0;
          const image = p.images?.[0] || "/logo.png";

          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "12px",
                padding: "12px 16px",
                background: "#ffffff",
                border: "1px solid var(--line)",
                borderRadius: "8px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img
                  src={image}
                  alt={p.name}
                  style={{ width: "50px", height: "50px", objectFit: "cover", borderRadius: "6px", background: "#f5e6de" }}
                />
                <div>
                  <strong style={{ fontSize: "14px", display: "block" }}>{p.name}</strong>
                  <span style={{ fontSize: "11.5px", color: "var(--muted)" }}>
                    {p.category} · {formatMoney(p.price_paise)}
                    {Array.isArray(p.colours) && p.colours.length > 0 && ` · ${p.colours.length} colours`}
                  </span>
                </div>
              </div>

              {/* Stock Controls & Actions */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Stock:</span>
                  <button
                    type="button"
                    style={{ padding: "2px 7px", border: "1px solid var(--line)", background: "#f5e6de", borderRadius: "4px" }}
                    onClick={() => handleStockUpdate(p.id, p.stock || 0, -1)}
                  >
                    -
                  </button>
                  <strong style={{ minWidth: "20px", textAlign: "center", color: isOut ? "#dc2626" : "inherit" }}>
                    {p.stock || 0}
                  </strong>
                  <button
                    type="button"
                    style={{ padding: "2px 7px", border: "1px solid var(--line)", background: "#f5e6de", borderRadius: "4px" }}
                    onClick={() => handleStockUpdate(p.id, p.stock || 0, 1)}
                  >
                    +
                  </button>
                  {isOut && (
                    <span style={{ fontSize: "10px", color: "#dc2626", fontWeight: 700, marginLeft: "4px" }}>
                      OUT OF STOCK
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="button"
                    className="button"
                    style={{ padding: "6px 12px", fontSize: "11px" }}
                    onClick={() => onEdit(p)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    type="button"
                    className="button"
                    style={{ padding: "6px 12px", fontSize: "11px", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}
                    onClick={() => handleDelete(p.id, p.name)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
