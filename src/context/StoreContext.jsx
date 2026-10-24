import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import productsSeed from "../productsSeed.json";

const StoreContext = createContext();

export function useStore() {
  return useContext(StoreContext);
}

import { normalizeProduct, getColourImage } from "./storeUtils.js";
export { normalizeProduct, getColourImage };

export function StoreProvider({ children }) {
  const [products, setProducts] = useState(() => productsSeed.map((p) => normalizeProduct(p)));
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeVariantType, setActiveVariantType] = useState("all");
  const [activeColourFilter, setActiveColourFilter] = useState("all");
  const [activePriceFilter, setActivePriceFilter] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeSort, setActiveSort] = useState("newest");

  // Modals state
  const [previewProductId, setPreviewProductId] = useState(null);
  const [checkoutItem, setCheckoutItem] = useState(null);

  // Load products from API / Supabase / localStorage / productsSeed
  const getDeletedIds = () => {
    try {
      return JSON.parse(localStorage.getItem("saloriya_deleted_product_ids") || "[]");
    } catch (e) {
      return [];
    }
  };

  const filterOutDeleted = (list) => {
    if (!Array.isArray(list)) return [];
    const deleted = getDeletedIds();
    if (deleted.length === 0) return list;
    return list.filter((p) => !deleted.includes(p.id) && (!p.slug || !deleted.includes(p.slug)));
  };

  const fetchProducts = async () => {
    let loaded = null;

    // 1. Try local Express / Vite dev API first
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const d = await res.json();
        if (d.success && Array.isArray(d.products) && d.products.length > 0) {
          loaded = d.products.map((p) => {
            const seed = productsSeed.find((s) => s.id === p.id || s.slug === p.slug);
            return normalizeProduct(p, seed);
          });
        }
      }
    } catch (err) {}

    // 2. Try Supabase
    if ((!loaded || loaded.length === 0) && isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          loaded = data.map((p) => {
            const seed = productsSeed.find((s) => s.id === p.id || s.slug === p.slug);
            return normalizeProduct(p, seed);
          });
        }
      } catch (err) {
        console.warn("Supabase products fetch failed:", err);
      }
    }

    // 3. Try LocalStorage
    if (!loaded || loaded.length === 0) {
      try {
        const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
        if (Array.isArray(local) && local.length > 0) {
          loaded = local.map((p) => {
            const seed = productsSeed.find((s) => s.id === p.id || s.slug === p.slug);
            return normalizeProduct(p, seed);
          });
        }
      } catch (e) {}
    }

    if (loaded && loaded.length > 0) {
      const cleanList = filterOutDeleted(loaded);
      setProducts(cleanList);
      try {
        localStorage.setItem("saloriya_admin_products", JSON.stringify(cleanList));
      } catch (e) {}
    } else {
      const initial = filterOutDeleted(productsSeed.map((p) => normalizeProduct(p)));
      setProducts(initial);
      try {
        localStorage.setItem("saloriya_admin_products", JSON.stringify(initial));
      } catch (e) {}
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Action: Update Stock
  const updateProductStock = async (productId, newStock) => {
    const cleanStock = Math.max(0, parseInt(newStock, 10) || 0);
    const target = products.find((p) => p.id === productId || p.slug === productId);
    const id = target?.id || productId;
    const slug = target?.slug;

    // 1. Immediate UI update
    setProducts((prev) =>
      prev.map((p) =>
        p.id === id || (slug && p.slug === slug)
          ? { ...p, stock: cleanStock, updated_at: new Date().toISOString() }
          : p
      )
    );

    // 2. LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === id || (slug && p.slug === slug));
      if (idx !== -1) {
        local[idx].stock = cleanStock;
      } else if (target) {
        local.push({ ...target, stock: cleanStock });
      }
      localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
    } catch (e) {}

    // 3. API sync
    try {
      await fetch(`/api/products/${id}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: cleanStock })
      });
    } catch (e) {}

    // 4. Supabase sync
    if (isSupabaseConfigured) {
      try {
        await supabase.from("products").update({ stock: cleanStock }).eq("id", id);
        if (slug) await supabase.from("products").update({ stock: cleanStock }).eq("slug", slug);
      } catch (e) {}
    }
  };

  // Action: Toggle Publish
  const toggleProductPublish = async (productId, targetStatus) => {
    const target = products.find((p) => p.id === productId || p.slug === productId);
    const id = target?.id || productId;
    const slug = target?.slug;
    const nextPublish = typeof targetStatus === "boolean" ? targetStatus : target?.is_published === false;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === id || (slug && p.slug === slug)
          ? { ...p, is_published: nextPublish, updated_at: new Date().toISOString() }
          : p
      )
    );

    // LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === id || (slug && p.slug === slug));
      if (idx !== -1) {
        local[idx].is_published = nextPublish;
        localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
      }
    } catch (e) {}

    // API sync
    try {
      await fetch(`/api/products/${id}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: nextPublish })
      });
    } catch (e) {}

    // Supabase sync
    if (isSupabaseConfigured) {
      try {
        await supabase.from("products").update({ is_published: nextPublish }).eq("id", id);
        if (slug) await supabase.from("products").update({ is_published: nextPublish }).eq("slug", slug);
      } catch (e) {}
    }
  };

  // Action: Delete Product
  const deleteProduct = async (productId) => {
    const target = products.find(
      (p) => String(p.id) === String(productId) || p.slug === String(productId)
    );
    const slug = target?.slug;
    const id = target?.id || productId;

    // 1. Add to deleted IDs tracking
    try {
      const deleted = getDeletedIds();
      [id, productId, slug].forEach((val) => {
        if (val && !deleted.includes(String(val))) {
          deleted.push(String(val));
        }
      });
      localStorage.setItem("saloriya_deleted_product_ids", JSON.stringify(deleted));
    } catch (e) {}

    // 2. Remove immediately from local state
    setProducts((prev) =>
      prev.filter(
        (p) =>
          String(p.id) !== String(id) &&
          String(p.id) !== String(productId) &&
          (!slug || p.slug !== slug) &&
          p.slug !== String(productId)
      )
    );

    // 3. LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const filtered = local.filter(
        (p) =>
          String(p.id) !== String(id) &&
          String(p.id) !== String(productId) &&
          (!slug || p.slug !== slug) &&
          p.slug !== String(productId)
      );
      localStorage.setItem("saloriya_admin_products", JSON.stringify(filtered));
    } catch (e) {}

    // 4. API sync
    try {
      await fetch(`/api/products/${encodeURIComponent(id || productId)}`, { method: "DELETE" });
    } catch (e) {}

    // 5. Supabase sync
    if (isSupabaseConfigured) {
      try {
        if (id) await supabase.from("products").delete().eq("id", id);
        if (slug) await supabase.from("products").delete().eq("slug", slug);
      } catch (e) {}
    }

    return { success: true };
  };

  // Action: Save / Create Product
  const saveProduct = async (productData) => {
    const existing = products.find((p) => (productData.id && p.id === productData.id) || (productData.slug && p.slug === productData.slug));
    const id = productData.id || existing?.id || `prod_${Date.now()}`;
    const normalized = normalizeProduct({ ...productData, id });

    // Untrack from deleted if re-created
    try {
      const deleted = getDeletedIds().filter((d) => d !== id && (!normalized.slug || d !== normalized.slug));
      localStorage.setItem("saloriya_deleted_product_ids", JSON.stringify(deleted));
    } catch (e) {}

    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id || (normalized.slug && p.slug === normalized.slug));
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = normalized;
        return next;
      }
      return [normalized, ...prev];
    });

    // LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === id || (normalized.slug && p.slug === normalized.slug));
      if (idx !== -1) {
        local[idx] = normalized;
      } else {
        local.unshift(normalized);
      }
      localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
    } catch (e) {}

    // API sync
    try {
      await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized)
      });
    } catch (e) {}

    // Supabase sync
    if (isSupabaseConfigured) {
      try {
        if (productData.id || existing?.id) {
          const targetId = productData.id || existing?.id;
          const { error: updErr } = await supabase.from("products").update(normalized).eq("id", targetId);
          if (updErr && normalized.slug) {
            await supabase.from("products").update(normalized).eq("slug", normalized.slug);
          }
        } else {
          await supabase.from("products").insert([normalized]);
        }
      } catch (e) {}
    }

    return normalized;
  };

  // Action: Refresh Catalog
  const refreshCatalog = async () => {
    setLoading(true);
    await fetchProducts();
    setLoading(false);
    return products.length;
  };

  // Format currency helper
  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format((paise || 0) / 100);
  };

  const openPreview = (productId) => setPreviewProductId(productId);
  const closePreview = () => setPreviewProductId(null);

  const openCheckout = (product, initialColour = null) => {
    setCheckoutItem({
      product,
      initialColour: initialColour || (product.colours && product.colours[0]) || "Standard"
    });
  };
  const closeCheckout = () => setCheckoutItem(null);

  // Available unique colours
  const availableColours = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (Array.isArray(p.colours)) {
        p.colours.forEach((c) => {
          if (c && c.trim()) set.add(c.trim());
        });
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtered & Sorted Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (activeCategory !== "All" && p.category !== activeCategory) return false;

      const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
      if (activeVariantType === "with-colours" && !hasMultipleColours) return false;
      if (activeVariantType === "single-colour" && hasMultipleColours) return false;

      if (activeColourFilter !== "all") {
        if (!Array.isArray(p.colours) || !p.colours.some((c) => c.toLowerCase().trim() === activeColourFilter.toLowerCase().trim())) {
          return false;
        }
      }

      const inr = (p.price_paise || 0) / 100;
      if (activePriceFilter === "under-50" && inr >= 50) return false;
      if (activePriceFilter === "under-100" && inr >= 100) return false;
      if (activePriceFilter === "under-399" && inr >= 399) return false;
      if (activePriceFilter === "400-699" && (inr < 400 || inr > 699)) return false;
      if (activePriceFilter === "700-999" && (inr < 700 || inr > 999)) return false;
      if (activePriceFilter === "1000-plus" && inr < 1000) return false;

      if (inStockOnly && (p.stock || 0) <= 0) return false;

      return true;
    }).sort((a, b) => {
      if (activeSort === "price-asc") return (a.price_paise || 0) - (b.price_paise || 0);
      if (activeSort === "price-desc") return (b.price_paise || 0) - (a.price_paise || 0);
      if (activeSort === "name-asc") return a.name.localeCompare(b.name);
      return (new Date(b.created_at || 0)).getTime() - (new Date(a.created_at || 0)).getTime();
    });
  }, [products, activeCategory, activeVariantType, activeColourFilter, activePriceFilter, inStockOnly, activeSort]);

  const resetFilters = () => {
    setActiveCategory("All");
    setActiveVariantType("all");
    setActiveColourFilter("all");
    setActivePriceFilter("all");
    setInStockOnly(false);
    setActiveSort("newest");
  };

  const value = {
    products,
    filteredProducts,
    loading,
    fetchProducts,
    activeCategory,
    setActiveCategory,
    activeVariantType,
    setActiveVariantType,
    activeColourFilter,
    setActiveColourFilter,
    activePriceFilter,
    setActivePriceFilter,
    inStockOnly,
    setInStockOnly,
    activeSort,
    setActiveSort,
    availableColours,
    resetFilters,
    formatMoney,
    previewProductId,
    openPreview,
    closePreview,
    checkoutItem,
    openCheckout,
    closeCheckout,
    updateProductStock,
    toggleProductPublish,
    deleteProduct,
    saveProduct,
    refreshCatalog
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
