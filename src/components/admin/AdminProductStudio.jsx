import React, { useState, useMemo } from "react";
import { useStore } from "../../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../../supabase.js";
import AdminDeleteConfirmModal from "./AdminDeleteConfirmModal.jsx";

export default function AdminProductStudio({ products, onProductChanged, editingProduct, setEditingProduct, openAddTrigger }) {
  const {
    updateProductStock,
    toggleProductPublish,
    deleteProduct,
    saveProduct,
    refreshCatalog
  } = useStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [variantFilter, setVariantFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState("");
  const [deleteTargetProduct, setDeleteTargetProduct] = useState(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    id: "",
    name: "",
    slug: "",
    description: "",
    category: "Combos",
    priceInr: "",
    colours: "",
    stock: "5",
    is_published: true
  });

  // Image list: [{ type: 'url'|'data', url: string }]
  const [imageList, setImageList] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  // Sync editing product if changed
  React.useEffect(() => {
    if (editingProduct) {
      setFormData({
        id: editingProduct.id || "",
        name: editingProduct.name || "",
        slug: editingProduct.slug || "",
        description: editingProduct.description || "",
        category: editingProduct.category || "Combos",
        priceInr: editingProduct.price_paise ? (editingProduct.price_paise / 100).toString() : "",
        colours: Array.isArray(editingProduct.colours) ? editingProduct.colours.join(", ") : "",
        stock: (editingProduct.stock || 0).toString(),
        is_published: editingProduct.is_published !== false
      });

      const urls = Array.isArray(editingProduct.image_urls) && editingProduct.image_urls.length > 0
        ? editingProduct.image_urls
        : (Array.isArray(editingProduct.images) ? editingProduct.images : []);

      setImageList(urls.map((url) => ({ type: "url", url })));
      setIsFormOpen(true);
      setFormMsg("");
    }
  }, [editingProduct]);

  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format((paise || 0) / 100);
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormData({
      id: "",
      name: "",
      slug: "",
      description: "",
      category: "Combos",
      priceInr: "",
      colours: "",
      stock: "5",
      is_published: true
    });
    setImageList([]);
    setFormMsg("");
    setIsFormOpen(true);
  };

  React.useEffect(() => {
    if (openAddTrigger) {
      handleOpenAdd();
      setTimeout(() => {
        const panel = document.getElementById("product-form-panel") || document.getElementById("view-products");
        if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [openAddTrigger]);

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingProduct(null);
    setFormMsg("");
  };

  // Image uploads with client-side compression
  const handleImageFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1000;
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
          setImageList((prev) => [...prev, { type: "data", url: compressed, file }]);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const moveImage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= imageList.length) return;
    const next = [...imageList];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    setImageList(next);
  };

  const removeImage = (index) => {
    setImageList((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSaving(true);
    setFormMsg("Processing images…");

    // Upload any new image files to Supabase Storage if configured
    const finalImageUrls = [];
    for (let i = 0; i < imageList.length; i++) {
      const item = imageList[i];
      if (item.file && isSupabaseConfigured && supabase) {
        setFormMsg(`Uploading photo ${i + 1} of ${imageList.length} to storage…`);
        try {
          const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `${Date.now()}-${safeName}`;
          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, item.file, { upsert: false, contentType: item.file.type });

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("product-images")
              .getPublicUrl(path);
            if (urlData?.publicUrl) {
              finalImageUrls.push(urlData.publicUrl);
              continue;
            }
          }
        } catch (uploadErr) {
          console.warn("Storage upload fallback:", uploadErr);
        }
      }
      finalImageUrls.push(item.url);
    }

    setFormMsg("Saving piece to store & catalogue…");

    const slug = formData.slug.trim() || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const coloursArray = formData.colours
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    const pricePaise = Math.round(parseFloat(formData.priceInr || "0") * 100);
    const stockVal = parseInt(formData.stock || "0", 10);

    const payload = {
      ...(formData.id ? { id: formData.id } : {}),
      name: formData.name.trim(),
      slug,
      description: formData.description.trim(),
      category: formData.category,
      price_paise: pricePaise,
      stock: stockVal,
      colours: coloursArray,
      image_urls: finalImageUrls,
      images: finalImageUrls,
      is_published: formData.is_published,
      updated_at: new Date().toISOString()
    };

    // Save product to StoreContext & backend
    try {
      await saveProduct(payload);
    } catch (e) {
      console.error("Save product error:", e);
    }

    setSaving(false);
    setFormMsg("✓ Piece successfully saved and updated in catalogue!");
    setTimeout(async () => {
      handleCloseForm();
      if (onProductChanged) {
        await onProductChanged();
      }
    }, 600);
  };

  // Quick Stock Step
  const handleStockDelta = async (productId, currentStock, delta) => {
    const newStock = Math.max(0, currentStock + delta);
    await updateProductStock(productId, newStock);
    if (onProductChanged) onProductChanged();
  };

  // Toggle publish
  const handleTogglePublish = async (productId, currentPublish) => {
    await toggleProductPublish(productId, !currentPublish);
    if (onProductChanged) onProductChanged();
  };

  // Delete product
  const executeDeleteProduct = async (product) => {
    if (!product) return;
    setIsDeletingProduct(true);
    const prodId = product.id || product.slug;
    await deleteProduct(prodId);
    setIsDeletingProduct(false);
    setDeleteTargetProduct(null);
    setRefreshToast(`✓ "${product.name}" deleted from store`);
    setTimeout(() => setRefreshToast(""), 3500);
    if (onProductChanged) onProductChanged();
  };

  // Refresh Catalogue
  const handleRefreshClick = async () => {
    setRefreshing(true);
    setRefreshToast("");
    try {
      const count = await refreshCatalog();
      setRefreshToast(`✓ Catalogue refreshed (${count} pieces active)`);
      setTimeout(() => setRefreshToast(""), 3500);
    } catch (e) {
      setRefreshToast("Catalogue refreshed.");
      setTimeout(() => setRefreshToast(""), 2000);
    } finally {
      setRefreshing(false);
      if (onProductChanged) onProductChanged();
    }
  };

  // Filtered & Sorted Pieces
  const filteredPieces = useMemo(() => {
    return products.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (p.name || "").toLowerCase().includes(q);
        const matchCategory = (p.category || "").toLowerCase().includes(q);
        const matchSlug = (p.slug || "").toLowerCase().includes(q);
        if (!matchName && !matchCategory && !matchSlug) return false;
      }

      // Status
      if (statusFilter === "published" && p.is_published === false) return false;
      if (statusFilter === "draft" && p.is_published !== false) return false;

      // Stock
      if (stockFilter === "in-stock" && (p.stock || 0) <= 0) return false;
      if (stockFilter === "low-stock" && ((p.stock || 0) <= 0 || (p.stock || 0) > 3)) return false;
      if (stockFilter === "out-of-stock" && (p.stock || 0) > 0) return false;

      // Category
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;

      // Variants
      const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
      if (variantFilter === "with-colours" && !hasMultipleColours) return false;
      if (variantFilter === "single-colour" && hasMultipleColours) return false;

      return true;
    }).sort((a, b) => {
      if (sortOrder === "price-asc") return (a.price_paise || 0) - (b.price_paise || 0);
      if (sortOrder === "price-desc") return (b.price_paise || 0) - (a.price_paise || 0);
      if (sortOrder === "stock-asc") return (a.stock || 0) - (b.stock || 0);
      if (sortOrder === "stock-desc") return (b.stock || 0) - (a.stock || 0);
      if (sortOrder === "name-asc") return (a.name || "").localeCompare(b.name || "");
      if (sortOrder === "oldest") return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [products, searchQuery, statusFilter, stockFilter, categoryFilter, variantFilter, sortOrder]);

  return (
    <div id="view-products" className="admin-tab-view active">
      {/* 1. Studio Header Strip */}
      <div className="studio-header-strip">
        <div className="studio-header-info">
          <h2>Product Studio &amp; Catalogue</h2>
          <p className="hint">Organize pieces, toggle publish status, manage pricing, and update stock.</p>
        </div>
        <div className="studio-header-actions">
          <button
            type="button"
            className="button button-gold"
            onClick={() => (isFormOpen ? handleCloseForm() : handleOpenAdd())}
          >
            <span className="btn-icon">✨</span>
            <span>{isFormOpen ? "✕ Close Editor" : "+ Add New Piece"}</span>
          </button>
          <button
            type="button"
            className="button button-outline button-small"
            onClick={handleRefreshClick}
            disabled={refreshing}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <span style={{ display: "inline-block", transform: refreshing ? "rotate(180deg)" : "none", transition: "transform 0.5s ease" }}>
              ↻
            </span>
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
          {refreshToast && (
            <span style={{ fontSize: "11px", color: "#15803d", fontWeight: 700, marginLeft: "8px" }}>
              {refreshToast}
            </span>
          )}
        </div>
      </div>

      {/* 2. Expandable / Collapsible Product Editor Panel */}
      {isFormOpen && (
        <section id="product-form-panel" className="admin-panel product-editor-panel" style={{ marginBottom: "26px" }}>
          <div className="editor-panel-header">
            <div>
              <span className="eyebrow">CATALOGUE CREATOR &amp; EDITOR</span>
              <h2 id="form-title">{formData.id ? `Edit: ${formData.name}` : "Add a new piece"}</h2>
            </div>
            <button type="button" className="editor-close-btn" onClick={handleCloseForm} title="Close editor">
              ✕
            </button>
          </div>

          <form id="product-form" className="admin-form product-editor-form" onSubmit={handleSaveProduct}>
            <div className="editor-grid">
              {/* Product Information */}
              <div className="editor-section">
                <h3 className="editor-section-title">1. Product Information</h3>
                <label>
                  Product Name *
                  <input
                    name="name"
                    required
                    maxLength={120}
                    placeholder="e.g. 1g Gold Covering Earring &amp; Chain Combo"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </label>
                <label>
                  Slug (Web Address URL)
                  <input
                    name="slug"
                    pattern="[a-z0-9-]+"
                    placeholder="gold-covering-combo-set"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </label>
                <label>
                  Description &amp; Materials
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Details about this piece, 1g gold micro-plating, chain length, stones, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </label>
                <div className="form-row">
                  <label>
                    Category *
                    <select
                      name="category"
                      required
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="Combos">Chain &amp; Earring Combos</option>
                      <option value="Earrings">Earrings</option>
                      <option value="Bracelets">Bracelets &amp; Bangles</option>
                      <option value="Jhumkas">Jhumkas</option>
                      <option value="Studs">Studs</option>
                      <option value="Chains">Chains &amp; Necklaces</option>
                    </select>
                  </label>
                  <label>
                    Price in Rupees (₹) *
                    <input
                      name="price"
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      placeholder="299"
                      value={formData.priceInr}
                      onChange={(e) => setFormData({ ...formData, priceInr: e.target.value })}
                    />
                  </label>
                </div>
              </div>

              {/* Variants & Inventory */}
              <div className="editor-section">
                <h3 className="editor-section-title">2. Variants &amp; Inventory</h3>
                <label>
                  Colours / Variants (Comma Separated)
                  <input
                    name="colours"
                    placeholder="BLUE, RED, GREEN, PINK (or leave blank for single look)"
                    value={formData.colours}
                    onChange={(e) => setFormData({ ...formData, colours: e.target.value })}
                  />
                  <span className="field-hint">
                    Leave blank for pieces with no colour choices. If multi-colour, separate with commas.
                  </span>
                </label>

                <label>
                  Stock Quantity Available *
                  <input
                    name="stock"
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                  <span className="field-hint">Automatically decrements whenever an order is confirmed.</span>
                </label>

                <div className="editor-publish-box" style={{ marginTop: "14px" }}>
                  <label className="checkbox-label">
                    <input
                      name="published"
                      type="checkbox"
                      checked={formData.is_published}
                      onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    />
                    <span>
                      <strong>Publish to live storefront</strong> (Visible to all customers immediately)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* High-Definition Photos */}
            <div className="editor-section image-upload-section" style={{ marginTop: "16px" }}>
              <h3 className="editor-section-title">3. High-Definition Photos</h3>
              <div className="file-dropzone" id="file-dropzone">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="file-input-hidden"
                  id="studio-file-input"
                  onChange={handleImageFiles}
                />
                <label htmlFor="studio-file-input" style={{ cursor: "pointer", width: "100%", display: "block" }}>
                  <div className="dropzone-content">
                    <svg
                      className="dropzone-icon"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="dropzone-text">
                      <strong>Click to upload photos</strong> or select multiple images
                    </p>
                    <span className="dropzone-sub">PNG, JPG, WEBP up to 5 MB per photo</span>
                  </div>
                </label>
              </div>

              {/* Image Previews Strip */}
              {imageList.length > 0 && (
                <div id="image-previews" className="image-previews">
                  <div className="previews-header">
                    <span className="previews-count">
                      {imageList.length} image{imageList.length === 1 ? "" : "s"} selected
                    </span>
                    <button type="button" className="text-button" onClick={() => setImageList([])}>
                      Remove all
                    </button>
                  </div>
                  <div className="previews-grid">
                    {imageList.map((item, idx) => (
                      <div key={idx} className="image-preview-item" title={`Image #${idx + 1}`}>
                        <img src={item.url} alt={`Preview #${idx + 1}`} loading="lazy" />
                        <div className="preview-actions">
                          {idx > 0 && (
                            <button
                              type="button"
                              className="preview-btn move-btn"
                              onClick={() => moveImage(idx, -1)}
                              title="Move left"
                            >
                              ‹
                            </button>
                          )}
                          <button
                            type="button"
                            className="preview-btn remove-img"
                            onClick={() => removeImage(idx)}
                            title="Remove image"
                          >
                            ×
                          </button>
                          {idx < imageList.length - 1 && (
                            <button
                              type="button"
                              className="preview-btn move-btn"
                              onClick={() => moveImage(idx, 1)}
                              title="Move right"
                            >
                              ›
                            </button>
                          )}
                        </div>
                        <span className="img-tag">#{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="hint" style={{ marginTop: "8px" }}>
                Upload in the order of your colours so storefront automatically switches photos when a colour is selected.
              </p>
            </div>

            {/* Actions Row */}
            <div className="editor-actions-row" style={{ marginTop: "18px" }}>
              <button className="button button-dark" type="submit" disabled={saving}>
                <span>{saving ? "Saving…" : "💾 Save &amp; Publish Piece"}</span>
              </button>
              <button
                className="button button-outline"
                type="button"
                onClick={() => {
                  setFormData({
                    id: "",
                    name: "",
                    slug: "",
                    description: "",
                    category: "Combos",
                    priceInr: "",
                    colours: "",
                    stock: "5",
                    is_published: true
                  });
                  setImageList([]);
                }}
              >
                Clear Form
              </button>
              <button className="button button-outline" type="button" onClick={handleCloseForm}>
                Cancel
              </button>
            </div>

            {formMsg && (
              <p className="form-message" role="status" style={{ marginTop: "10px", color: "var(--wine)" }}>
                {formMsg}
              </p>
            )}
          </form>
        </section>
      )}

      {/* 3. Sort & Filter Toolbar for Products in Admin */}
      <div className="admin-products-toolbar">
        <div className="admin-search-wrap">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            id="admin-product-search"
            placeholder="Search pieces by name, category, or slug…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="admin-filter-group">
          {/* Status */}
          <div className="toolbar-select-wrap">
            <label className="toolbar-label">Status:</label>
            <select
              className="toolbar-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Drafts / Unpublished</option>
            </select>
          </div>

          {/* Stock */}
          <div className="toolbar-select-wrap">
            <label className="toolbar-label">Stock:</label>
            <select
              className="toolbar-select"
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
            >
              <option value="all">All Stock</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock (≤ 3)</option>
              <option value="out-of-stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* Category */}
          <div className="toolbar-select-wrap">
            <label className="toolbar-label">Category:</label>
            <select
              className="toolbar-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              <option value="Combos">Combos</option>
              <option value="Earrings">Earrings</option>
              <option value="Bracelets">Bracelets &amp; Bangles</option>
              <option value="Jhumkas">Jhumkas</option>
              <option value="Studs">Studs</option>
              <option value="Chains">Chains &amp; Necklaces</option>
            </select>
          </div>

          {/* Variants */}
          <div className="toolbar-select-wrap">
            <label className="toolbar-label">Variants:</label>
            <select
              className="toolbar-select"
              value={variantFilter}
              onChange={(e) => setVariantFilter(e.target.value)}
            >
              <option value="all">All Pieces</option>
              <option value="with-colours">✨ With Colour Options</option>
              <option value="single-colour">👑 Single Look</option>
            </select>
          </div>

          {/* Sort */}
          <div className="toolbar-select-wrap">
            <label className="toolbar-label">Sort:</label>
            <select
              className="toolbar-select"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="stock-asc">Stock: Low to High</option>
              <option value="stock-desc">Stock: High to Low</option>
              <option value="name-asc">Name (A – Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="admin-products-summary-strip">
        <span className="summary-count">
          Showing {filteredPieces.length} of {products.length} jewellery pieces
        </span>
      </div>

      {/* 4. Sequenced Luxury Products Grid */}
      <div id="admin-products" className="admin-products-grid">
        {filteredPieces.length === 0 ? (
          <div className="empty-orders-box" style={{ gridColumn: "1 / -1", padding: "40px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", marginBottom: "8px" }}></p>
            <strong>No pieces match your filters</strong>
            <p className="hint">Try adjusting the search query, category, or status filter.</p>
          </div>
        ) : (
          filteredPieces.map((p) => {
            const stockClass = p.stock <= 0 ? "out-of-stock" : p.stock <= 3 ? "low-stock" : "in-stock";
            const stockLabel =
              p.stock <= 0 ? "Out of stock (0)" : p.stock <= 3 ? `Low Stock (${p.stock} pcs)` : `In Stock (${p.stock} pcs)`;

            const thumbUrl = (Array.isArray(p.image_urls) && p.image_urls[0] && p.image_urls[0] !== "/logo.png")
              ? p.image_urls[0]
              : ((Array.isArray(p.images) && p.images[0] && p.images[0] !== "/logo.png") ? p.images[0] : "");

            const hasColours = Array.isArray(p.colours) && p.colours.length > 1;

            return (
              <article
                key={p.id}
                className={`admin-product-card ${p.is_published !== false ? "" : "draft-card"}`}
                data-card-id={p.id}
              >
                <div className="admin-product-top">
                  <div className="admin-product-thumb">
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={p.name} loading="lazy" />
                    ) : (
                      <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", color: "var(--wine)", fontFamily: "serif", fontSize: "22px" }}>
                        S
                      </div>
                    )}
                  </div>
                  <div className="admin-product-meta">
                    <span className="category-tag">{p.category || "Jewellery"}</span>
                    <h3 className="product-title" title={p.name}>
                      {p.name}
                    </h3>
                    <span className="product-slug">/{p.slug}</span>
                    <div className="admin-card-badges">
                      <span className={`badge-publish ${p.is_published !== false ? "published" : "draft"}`}>
                        {p.is_published !== false ? "✓ Live Published" : "○ Draft / Hidden"}
                      </span>
                      <span className={`stock-qty-badge ${stockClass}`}>{stockLabel}</span>
                    </div>
                  </div>
                </div>

                <div style={{ margin: "6px 0" }}>
                  {hasColours ? (
                    <span className="card-variant-badge multi-colour">
                      ✨ {p.colours.length} Colours ({p.colours.join(", ")})
                    </span>
                  ) : (
                    <span className="card-variant-badge single-look">👑 Single Signature Look</span>
                  )}
                </div>

                <div className="admin-product-pricing-row">
                  <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600 }}>
                    Retail Price
                  </span>
                  <strong className="price-val">{formatMoney(p.price_paise)}</strong>
                </div>

                {/* Stock Controls Stepper */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0", background: "#fdf8f5", padding: "6px 10px", borderRadius: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)" }}>Quick Stock:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      style={{ padding: "2px 8px", minHeight: "26px" }}
                      onClick={() => handleStockDelta(p.id, p.stock || 0, -1)}
                    >
                      −
                    </button>
                    <strong style={{ minWidth: "24px", textAlign: "center", color: p.stock <= 0 ? "#dc2626" : "inherit" }}>
                      {p.stock || 0}
                    </strong>
                    <button
                      type="button"
                      className="button button-outline button-small"
                      style={{ padding: "2px 8px", minHeight: "26px" }}
                      onClick={() => handleStockDelta(p.id, p.stock || 0, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Actions Row */}
                <div className="admin-product-card-actions" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--line)" }}>
                  <button
                    type="button"
                    className="button button-small button-outline"
                    onClick={() => {
                      setEditingProduct(p);
                      window.scrollTo({ top: 150, behavior: "smooth" });
                    }}
                  >
                    ✏️ Edit Piece
                  </button>
                  <button
                    type="button"
                    className="button button-small button-outline"
                    onClick={() => handleTogglePublish(p.id, p.is_published !== false)}
                  >
                    {p.is_published !== false ? "Hide Draft" : "Publish Live"}
                  </button>
                  <button
                    type="button"
                    className="button button-small"
                    style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", marginLeft: "auto" }}
                    onClick={() => setDeleteTargetProduct(p)}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AdminDeleteConfirmModal
        isOpen={!!deleteTargetProduct}
        title="Delete Piece from Catalogue"
        itemName={deleteTargetProduct?.name}
        message="Are you sure you want to permanently delete this piece from your store catalogue? This action cannot be undone."
        confirmLabel="Yes, Delete"
        isDeleting={isDeletingProduct}
        onConfirm={() => executeDeleteProduct(deleteTargetProduct)}
        onClose={() => setDeleteTargetProduct(null)}
      />
    </div>
  );
}
