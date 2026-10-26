import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal.jsx";

const DEFAULT_PROMOS = [
  {
    code: "FREEDELIVERY",
    discount_type: "free_delivery",
    amount: 50,
    discount_value: 50,
    description: "Complimentary Free Transport & Packaging (Waives ₹50 delivery)",
    is_active: true
  },
  {
    code: "SALORIYA50",
    discount_type: "fixed_amount",
    amount: 50,
    discount_value: 50,
    description: "Flat ₹50 OFF Special Promo",
    is_active: true
  },
  {
    code: "GOLD2026",
    discount_type: "fixed_amount",
    amount: 50,
    discount_value: 50,
    description: "Special ₹50 OFF Jewellery Voucher",
    is_active: true
  }
];

export default function AdminPromoManager({ onPromosUpdated }) {
  const [promos, setPromos] = useState([]);
  const [newCode, setNewCode] = useState("");
  const [discountType, setDiscountType] = useState("fixed_amount"); // 'fixed_amount' | 'free_delivery' | 'percentage'
  const [amount, setAmount] = useState("50");
  const [newDesc, setNewDesc] = useState("");
  const [msg, setMsg] = useState("");
  const [deleteTargetPromo, setDeleteTargetPromo] = useState(null);
  const [isDeletingPromo, setIsDeletingPromo] = useState(false);

  const getDeletedPromoCodes = () => {
    try {
      return JSON.parse(localStorage.getItem("saloriya_deleted_promo_codes") || "[]");
    } catch (e) {
      return [];
    }
  };

  const loadPromos = async () => {
    let list = [];
    const deletedCodes = getDeletedPromoCodes();

    // 1. First-Party Central API check
    try {
      const res = await fetch("/api/promos");
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.promos) && data.promos.length > 0) {
          list = data.promos.map((p) => ({
            ...p,
            code: String(p.code || "").trim().toUpperCase(),
            amount: Number(p.discount_value ?? p.amount ?? 50)
          }));
        }
      }
    } catch (e) {}

    // 2. Query live Supabase database
    if (!list.length && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("promo_codes")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          list = data.map((p) => ({
            ...p,
            code: String(p.code || "").trim().toUpperCase(),
            amount: Number(p.discount_value ?? p.amount ?? 50)
          }));
        }
      } catch (e) {}
    }

    // 3. Fallback to localStorage
    if (!list.length) {
      try {
        const local = JSON.parse(localStorage.getItem("saloriya_admin_promo_codes") || "[]");
        if (Array.isArray(local) && local.length > 0) {
          list = local.map((p) => ({
            ...p,
            code: String(p.code || "").trim().toUpperCase(),
            amount: Number(p.discount_value ?? p.amount ?? 50)
          }));
        }
      } catch (e) {}
    }

    // 4. Default seed promos fallback
    if (!list.length) {
      list = DEFAULT_PROMOS;
    }

    // Filter out explicitly deleted codes only if deletedCodes exists and list has non-deleted
    if (deletedCodes.length > 0) {
      const filtered = list.filter((p) => !deletedCodes.includes(p.code));
      if (filtered.length > 0) {
        list = filtered;
      }
    }

    // Cross-device sync: Ensure valid promo codes are present in Supabase so mobile users get them immediately
    if (isSupabaseConfigured && list.length > 0) {
      try {
        for (const item of list) {
          await supabase.from("promo_codes").upsert([{
            code: item.code,
            discount_type: item.discount_type || "free_delivery",
            discount_value: Number(item.discount_value ?? item.amount ?? 50),
            description: item.description || "Active Voucher",
            is_active: item.is_active !== false
          }], { onConflict: "code" });
        }
      } catch (e) {}
    }

    try {
      localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(list));
    } catch (e) {}

    setPromos(list);
    if (onPromosUpdated) onPromosUpdated(list.length);
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleAddPromo = async (e) => {
    e.preventDefault();
    const code = newCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!code) return;

    const numAmount = discountType === "free_delivery" ? 50 : Math.max(1, parseFloat(amount) || 0);

    setMsg("");
    const newPromo = {
      code,
      discount_type: discountType,
      discount_value: numAmount,
      amount: numAmount,
      description: newDesc.trim() || (
        discountType === "free_delivery"
          ? "Complimentary Free Delivery (Waives ₹50 fee)"
          : discountType === "fixed_amount"
          ? `Flat ₹${numAmount} Discount on Order`
          : `${numAmount}% Off Entire Order`
      ),
      is_active: true,
      created_at: new Date().toISOString()
    };

    // Remove from deleted codes if previously deleted
    try {
      const deleted = getDeletedPromoCodes().filter((c) => c !== code);
      localStorage.setItem("saloriya_deleted_promo_codes", JSON.stringify(deleted));
      localStorage.setItem("saloriya_promo_initialized", "true");
    } catch (e) {}

    // 1. Save to Central API
    try {
      await fetch("/api/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPromo)
      });
    } catch (e) {}

    // 2. Save to Supabase using correct column name discount_value
    try {
      if (isSupabaseConfigured) {
        await supabase.from("promo_codes").upsert([{
          code: newPromo.code,
          discount_type: newPromo.discount_type,
          discount_value: newPromo.discount_value,
          description: newPromo.description,
          is_active: true
        }], { onConflict: "code" });
      }
    } catch (e) {
      console.warn("Supabase promo insert error:", e);
    }

    const updated = [newPromo, ...promos.filter((p) => p.code !== code)];
    localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(updated));
    setPromos(updated);
    setNewCode("");
    setAmount("50");
    setNewDesc("");
    setMsg(`✓ Promo code "${code}" added successfully.`);
    if (onPromosUpdated) onPromosUpdated(updated.length);
  };

  const executeDeletePromo = async (promo) => {
    if (!promo) return;
    setIsDeletingPromo(true);
    const code = promo.code;

    // 1. Add to deleted tracking
    try {
      const deleted = getDeletedPromoCodes();
      if (!deleted.includes(code)) deleted.push(code);
      localStorage.setItem("saloriya_deleted_promo_codes", JSON.stringify(deleted));
      localStorage.setItem("saloriya_promo_initialized", "true");
    } catch (e) {}

    // 2. Delete from Central API
    try {
      await fetch(`/api/promos?code=${encodeURIComponent(code)}`, {
        method: "DELETE"
      });
    } catch (e) {}

    // 3. Delete from Supabase
    try {
      if (isSupabaseConfigured) {
        await supabase.from("promo_codes").delete().ilike("code", code);
      }
    } catch (e) {}

    // 4. Update localStorage and local state
    const updated = promos.filter((p) => p.code !== code);
    try {
      localStorage.setItem("saloriya_admin_promo_codes", JSON.stringify(updated));
    } catch (e) {}

    setPromos(updated);
    setIsDeletingPromo(false);
    setDeleteTargetPromo(null);
    setMsg(`✓ Promo voucher "${code}" removed.`);
    setTimeout(() => setMsg(""), 3500);
    if (onPromosUpdated) onPromosUpdated(updated.length);
  };

  return (
    <div id="view-promos" className="admin-tab-view active">
      <section className="admin-panel">
        <div className="inventory-heading" style={{ marginBottom: "16px" }}>
          <div>
            <p className="eyebrow" style={{ color: "var(--wine)", fontSize: "11px", margin: "0 0 4px" }}>
              MARKETING &amp; DISCOUNTS
            </p>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", margin: "0 0 4px" }}>
              Promo Codes (Free Delivery)
            </h2>
            <p className="hint" style={{ margin: 0 }}>
              Create and manage voucher codes to give customers complimentary free delivery (waives the ₹50.00 courier fee).
            </p>
          </div>
          <button className="button button-outline" type="button" onClick={loadPromos}>
            ↻ Refresh Codes
          </button>
        </div>

        {/* Promo Creator Card */}
        <div
          className="promo-creator-card"
          style={{
            background: "#fffaf6",
            border: "1.5px solid var(--gold)",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "20px",
            boxShadow: "0 4px 16px rgba(134,30,56,0.06)"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "14px",
              borderBottom: "1px solid rgba(209,180,144,0.3)",
              paddingBottom: "10px"
            }}
          >
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "17px", color: "var(--wine)", margin: 0 }}>
              + Create New Promo Code
            </h3>
            <span className="eyebrow" style={{ fontSize: "10px", color: "var(--gold)" }}>
              MANUAL VOUCHER CREATOR
            </span>
          </div>

          <form
            id="create-promo-form"
            onSubmit={handleAddPromo}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "14px",
              alignItems: "end"
            }}
          >
            <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", flexDirection: "column", gap: "6px" }}>
              Promo Code (Letters &amp; Numbers) *
              <input
                type="text"
                name="code"
                id="promo-code-input"
                placeholder="e.g. FREEDELIVERY, SALORIYA50"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                required
                style={{
                  textTransform: "uppercase",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  padding: "10px",
                  border: "1.5px solid #d1b490",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </label>

            <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", flexDirection: "column", gap: "6px" }}>
              Discount Type *
              <select
                name="discountType"
                id="promo-type-select"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1.5px solid #d1b490",
                  borderRadius: "6px",
                  fontSize: "13px",
                  background: "#fff"
                }}
              >
                <option value="fixed_amount">Fixed Amount Discount (₹ OFF)</option>
                <option value="free_delivery">Free Delivery (Waives ₹50 Courier Fee)</option>
                <option value="percentage">Percentage Discount (% OFF)</option>
              </select>
            </label>

            {discountType !== "free_delivery" && (
              <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", flexDirection: "column", gap: "6px" }}>
                {discountType === "fixed_amount" ? "Discount Amount (₹) *" : "Discount Percentage (%) *"}
                <input
                  type="number"
                  min="1"
                  max={discountType === "percentage" ? "100" : "10000"}
                  required
                  placeholder={discountType === "fixed_amount" ? "e.g. 50, 100, 200" : "e.g. 10, 20"}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    padding: "10px",
                    border: "1.5px solid #d1b490",
                    borderRadius: "6px",
                    fontSize: "13px"
                  }}
                />
              </label>
            )}

            <label style={{ fontSize: "12px", fontWeight: 600, display: "flex", flexDirection: "column", gap: "6px" }}>
              Voucher Note / Description
              <input
                type="text"
                name="description"
                id="promo-desc-input"
                placeholder={
                  discountType === "free_delivery"
                    ? "e.g. Free Delivery on Orders"
                    : discountType === "fixed_amount"
                    ? `e.g. Special ₹${amount || 50} Off Voucher`
                    : `e.g. Special ${amount || 10}% Off Voucher`
                }
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{
                  padding: "10px",
                  border: "1.5px solid #d1b490",
                  borderRadius: "6px",
                  fontSize: "13px"
                }}
              />
            </label>

            <div>
              <button
                type="submit"
                id="btn-save-promo"
                className="button button-gold"
                style={{ width: "100%", padding: "11px 18px", fontSize: "13px", fontWeight: 700 }}
              >
                + Add Promo Code
              </button>
            </div>
          </form>

          {msg && (
            <p className="form-message" role="status" style={{ margin: "10px 0 0", color: "var(--wine)" }}>
              {msg}
            </p>
          )}
        </div>

        {/* Existing Promo Codes List */}
        <div
          className="promos-table-wrap"
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
          }}
        >
          <div id="promos-list-container">
            {promos.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--muted)" }}>
                No active promo codes. Use the creator above to add one.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "#fbf7f4", borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px" }}>Voucher Code</th>
                    <th style={{ padding: "12px 16px" }}>Benefit</th>
                    <th style={{ padding: "12px 16px" }}>Description</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.code} style={{ borderBottom: "1px solid var(--line-subtle)" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            background: "#faecf0",
                            color: "var(--wine)",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            letterSpacing: "0.5px"
                          }}
                        >
                          🏷️ {p.code}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {p.discount_type === "fixed_amount" ? (
                          <span style={{ color: "#15803d", fontWeight: 700, background: "#dcfce7", padding: "3px 8px", borderRadius: "4px", fontSize: "12px" }}>
                            ₹{p.amount || 50}.00 OFF
                          </span>
                        ) : p.discount_type === "percentage" ? (
                          <span style={{ color: "#7c2d12", fontWeight: 700, background: "#ffedd5", padding: "3px 8px", borderRadius: "4px", fontSize: "12px" }}>
                            {p.amount || 10}% OFF
                          </span>
                        ) : (
                          <span style={{ color: "#166534", fontWeight: 700, background: "#dcfce7", padding: "3px 8px", borderRadius: "4px", fontSize: "12px" }}>
                            FREE DELIVERY (₹50 OFF)
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--muted)" }}>{p.description}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          className="button button-small"
                          style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca" }}
                          onClick={() => setDeleteTargetPromo(p)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* In-App Delete Confirmation Modal */}
      <AdminDeleteConfirmModal
        isOpen={!!deleteTargetPromo}
        title="Delete Promo Voucher"
        itemName={deleteTargetPromo ? `Code: ${deleteTargetPromo.code}` : ""}
        message="Are you sure you want to permanently remove this promo code? Customers will no longer be able to use it at checkout."
        confirmLabel="Yes, Remove"
        isDeleting={isDeletingPromo}
        onConfirm={() => executeDeletePromo(deleteTargetPromo)}
        onClose={() => setDeleteTargetPromo(null)}
      />
    </div>
  );
}
