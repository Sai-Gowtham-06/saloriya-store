import React, { useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function AdminProductForm({ editingProduct, onSaved, onCancel }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Earrings");
  const [priceInr, setPriceInr] = useState("");
  const [stock, setStock] = useState("5");
  const [description, setDescription] = useState("");
  const [coloursInput, setColoursInput] = useState("");
  const [images, setImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    if (editingProduct) {
      setName(editingProduct.name || "");
      setCategory(editingProduct.category || "Earrings");
      setPriceInr(editingProduct.price_paise ? (editingProduct.price_paise / 100).toString() : "");
      setStock((editingProduct.stock || 0).toString());
      setDescription(editingProduct.description || "");
      setColoursInput(Array.isArray(editingProduct.colours) ? editingProduct.colours.join(", ") : "");
      setImages(Array.isArray(editingProduct.images) ? editingProduct.images : []);
    } else {
      setName("");
      setCategory("Earrings");
      setPriceInr("");
      setStock("5");
      setDescription("");
      setColoursInput("");
      setImages([]);
    }
  }, [editingProduct]);

  // Handle Image Upload & Compression
  const handleImageFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 900;
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          setImages((prev) => [...prev, compressed]);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setStatusMsg("");

    const coloursArray = coloursInput
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const pricePaise = Math.round(parseFloat(priceInr || "0") * 100);
    const stockQty = parseInt(stock || "0", 10);

    const productPayload = {
      name: name.trim(),
      category: category.trim(),
      price_paise: pricePaise,
      stock: stockQty,
      description: description.trim(),
      colours: coloursArray,
      images: images.length > 0 ? images : ["/logo.png"],
      is_published: true,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingProduct?.id) {
        // Update existing
        if (isSupabaseConfigured) {
          await supabase.from("products").update(productPayload).eq("id", editingProduct.id);
        }
        const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
        const idx = local.findIndex((p) => p.id === editingProduct.id);
        if (idx !== -1) {
          local[idx] = { ...local[idx], ...productPayload };
          localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
        }
      } else {
        // Insert new
        const newId = `prod_${Date.now()}`;
        const newProduct = { ...productPayload, id: newId, created_at: new Date().toISOString() };

        if (isSupabaseConfigured) {
          await supabase.from("products").insert([newProduct]);
        }
        const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
        local.unshift(newProduct);
        localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
      }

      setStatusMsg("✓ Product saved successfully!");
      setTimeout(() => {
        onSaved();
      }, 500);
    } catch (err) {
      console.warn("Product save notice:", err);
      setStatusMsg(`Notice: ${err.message || "Saved locally"}`);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel" style={{ marginBottom: "30px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <p className="eyebrow">INVENTORY MANAGER</p>
          <h2 style={{ fontSize: "24px" }}>
            {editingProduct ? "Edit Product Creation" : "Add New Creation to Storefront"}
          </h2>
        </div>
        {editingProduct && (
          <button type="button" className="button" onClick={onCancel} style={{ fontSize: "11px", padding: "6px 12px" }}>
            ✕ Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label>
            Jewellery Creation Name *
            <input
              type="text"
              required
              placeholder="e.g. Royal Antique Gold Chandbali Earrings"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Category *
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="Combos">Chain &amp; Earring Combos</option>
              <option value="Earrings">Earrings</option>
              <option value="Bracelets">Bracelets &amp; Bangles</option>
              <option value="Jhumkas">Jhumkas</option>
              <option value="Studs">Studs</option>
              <option value="Chains">Chains &amp; Necklaces</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Price in INR (₹) *
            <input
              type="number"
              step="1"
              required
              placeholder="e.g. 105"
              value={priceInr}
              onChange={(e) => setPriceInr(e.target.value)}
            />
          </label>
          <label>
            Available Stock Units *
            <input
              type="number"
              step="1"
              required
              placeholder="e.g. 5"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </label>
        </div>

        <label>
          Colour / Variant Options (Comma separated)
          <input
            type="text"
            placeholder="e.g. BLUE, RED, GREEN, MAROON (or leave blank for single look)"
            value={coloursInput}
            onChange={(e) => setColoursInput(e.target.value)}
          />
        </label>

        <label>
          Product Description
          <textarea
            rows={2}
            placeholder="Describe the finish, polish, stones, or styling tips…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {/* Multi Image Upload */}
        <label>
          Product Photos (High Quality JPEGs)
          <input type="file" accept="image/*" multiple onChange={handleImageFiles} style={{ marginTop: "4px" }} />
        </label>

        {images.length > 0 && (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "10px 0" }}>
            {images.map((img, idx) => (
              <div key={idx} style={{ position: "relative", width: "70px", height: "70px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--line)" }}>
                <img src={img} alt={`Preview ${idx}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(idx)}
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {statusMsg && <p style={{ color: "#15803d", fontSize: "12px", margin: "8px 0" }}>{statusMsg}</p>}

        <button
          type="submit"
          className="button button-gold"
          disabled={saving}
          style={{ width: "100%", padding: "12px", fontSize: "13px", marginTop: "10px" }}
        >
          {saving ? "Saving…" : editingProduct ? "Update Product Details ✓" : "Publish to Live Storefront ↗"}
        </button>
      </form>
    </div>
  );
}
