import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

const DEFAULT_PROMOS = [
  { code: "FREEDELIVERY", discount_type: "free_delivery", description: "Free Courier & Delivery (₹50 OFF)", is_active: true },
  { code: "FREESHIP", discount_type: "free_delivery", description: "Free Courier & Delivery", is_active: true },
  { code: "GOLD2026", discount_type: "free_delivery", description: "Gold Festival Special Free Delivery", is_active: true }
];

export default function AdminPromoManager() {
  const [promos, setPromos] = useState([]);
  const [newCode, setNewCode] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const loadPromos = async () => {
    let list = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.from("promo_codes").select("*");
        if (!error && Array.isArray(data) && data.length > 0) {
          list = data;
        }
      } catch (e) {}
    }

    if (!list.length) {
      try {
        const local = JSON.parse(localStorage.getItem("saloriya_admin_promo_codes") || "[]");
        if (Array.isArray(local) && local.length > 0) list = local;
      } catch (e) {}
    }

    if (!list.length) {
      list = DEFAULT_PROMOS;
      localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(list));
    }

    setPromos(list);
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleAddPromo = async (e) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code) return;

    const newPromo = {
      code,
      discount_type: "free_delivery",
      description: newDesc.trim() || "Free Delivery Waived (₹50 OFF)",
      is_active: true,
      created_at: new Date().toISOString()
    };

    try {
      if (isSupabaseConfigured) {
        await supabase.from("promo_codes").insert([newPromo]);
      }
    } catch (e) {}

    const updated = [newPromo, ...promos.filter((p) => p.code !== code)];
    localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(updated));
    setPromos(updated);
    setNewCode("");
    setNewDesc("");
  };

  const handleDeletePromo = async (code) => {
    try {
      if (isSupabaseConfigured) {
        await supabase.from("promo_codes").delete().eq("code", code);
      }
    } catch (e) {}

    const updated = promos.filter((p) => p.code !== code);
    localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(updated));
    setPromos(updated);
  };

  return (
    <div className="admin-panel" style={{ marginBottom: "40px" }}>
      <div className="section-heading" style={{ marginBottom: "16px" }}>
        <div>
          <p className="eyebrow">DISCOUNT OFFERS</p>
          <h2 style={{ fontSize: "24px" }}>Promo &amp; Free Delivery Codes</h2>
        </div>
      </div>

      {/* Add New Promo Form */}
      <form onSubmit={handleAddPromo} style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Promo Code (e.g. FESTIVE50)"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
          style={{ flex: 1, minWidth: "180px" }}
          required
        />
        <input
          type="text"
          placeholder="Description (e.g. Free Delivery on Orders)"
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          style={{ flex: 1.5, minWidth: "220px" }}
        />
        <button type="submit" className="button button-gold" style={{ padding: "8px 18px", fontSize: "12px" }}>
          + Add Promo Code
        </button>
      </form>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {promos.map((p) => (
          <div
            key={p.code}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              background: "#ffffff",
              border: "1px solid var(--line)",
              borderRadius: "6px"
            }}
          >
            <div>
              <strong style={{ color: "var(--wine-dark)", fontSize: "13px" }}>🏷️ {p.code}</strong>
              <span style={{ fontSize: "12px", color: "var(--muted)", marginLeft: "10px" }}>
                {p.description} (Waives ₹50 delivery)
              </span>
            </div>
            <button
              type="button"
              className="button"
              style={{ padding: "4px 10px", fontSize: "10.5px", background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}
              onClick={() => handleDeletePromo(p.code)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
