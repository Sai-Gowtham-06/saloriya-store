import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import productsSeed from "../productsSeed.json";

const StoreContext = createContext();

export function useStore() {
  return useContext(StoreContext);
}

// Normalize product to guarantee valid image_urls, images array, and colours
export function normalizeProduct(p, seedFallback = null) {
  let urls = [];
  if (Array.isArray(p.image_urls) && p.image_urls.length > 0) {
    urls = p.image_urls.filter((u) => u && u !== "/logo.png");
  }
  if (!urls.length && Array.isArray(p.images) && p.images.length > 0) {
    urls = p.images.filter((u) => u && u !== "/logo.png");
  }
  if (!urls.length && seedFallback && Array.isArray(seedFallback.image_urls) && seedFallback.image_urls.length > 0) {
    urls = seedFallback.image_urls;
  }
  return {
    ...p,
    image_urls: urls,
    images: urls,
    colours: Array.isArray(p.colours) ? p.colours : (seedFallback?.colours || [])
  };
}

export function getColourImage(p, colourName = "", colourIndex = 0) {
  if (!p) return "";
  const urls = (Array.isArray(p.image_urls) && p.image_urls.length > 0)
    ? p.image_urls
    : (Array.isArray(p.images) && p.images.length > 0 ? p.images : []);
  if (!urls.length) return "";

  const clean = (colourName || "").trim().toLowerCase();
  if (clean && clean !== "standard") {
    const matched = urls.find((url) => {
      try {
        const decoded = decodeURIComponent(url).toLowerCase();
        return decoded.includes(clean);
      } catch {
        return false;
      }
    });
    if (matched) return matched;
  }
  if (typeof colourIndex === "number" && colourIndex >= 0 && colourIndex < urls.length) {
    return urls[colourIndex];
  }
  return urls[0] || "";
}

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
      setProducts(loaded);
      try {
        localStorage.setItem("saloriya_admin_products", JSON.stringify(loaded));
      } catch (e) {}
    } else {
      const initial = productsSeed.map((p) => normalizeProduct(p));
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
    // 1. Immediate UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, stock: cleanStock, updated_at: new Date().toISOString() } : p))
    );

    // 2. LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        local[idx].stock = cleanStock;
      } else {
        const currentProd = products.find((p) => p.id === productId);
        if (currentProd) local.push({ ...currentProd, stock: cleanStock });
      }
      localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
    } catch (e) {}

    // 3. API sync
    try {
      await fetch(`/api/products/${productId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: cleanStock })
      });
    } catch (e) {}

    // 4. Supabase sync
    if (isSupabaseConfigured) {
      try {
        await supabase.from("products").update({ stock: cleanStock }).eq("id", productId);
      } catch (e) {}
    }
  };

  // Action: Toggle Publish
  const toggleProductPublish = async (productId) => {
    let nextPublish = false;
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === productId) {
          nextPublish = !p.is_published;
          return { ...p, is_published: nextPublish, updated_at: new Date().toISOString() };
        }
        return p;
      })
    );

    // LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const idx = local.findIndex((p) => p.id === productId);
      if (idx !== -1) {
        local[idx].is_published = nextPublish;
        localStorage.setItem("saloriya_admin_products", JSON.stringify(local));
      }
    } catch (e) {}

    // API sync
    try {
      await fetch(`/api/products/${productId}/publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_published: nextPublish })
      });
    } catch (e) {}

    // Supabase sync
    if (isSupabaseConfigured) {
      try {
        await supabase.from("products").update({ is_published: nextPublish }).eq("id", productId);
      } catch (e) {}
    }
  };

  // Action: Delete Product
  const deleteProduct = async (productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));

    // LocalStorage sync
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
      const filtered = local.filter((p) => p.id !== productId);
      localStorage.setItem("saloriya_admin_products", JSON.stringify(filtered));
    } catch (e) {}

    // API sync
    try {
      await fetch(`/api/products/${productId}`, { method: "DELETE" });
    } catch (e) {}

    // Supabase sync
    if (isSupabaseConfigured) {
      try {
        await supabase.from("products").delete().eq("id", productId);
      } catch (e) {}
    }
  };

  // Action: Save / Create Product
  const saveProduct = async (productData) => {
    const id = productData.id || `prod_${Date.now()}`;
    const normalized = normalizeProduct({ ...productData, id });

    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
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
      const idx = local.findIndex((p) => p.id === id);
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
        if (productData.id) {
          await supabase.from("products").update(normalized).eq("id", id);
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
