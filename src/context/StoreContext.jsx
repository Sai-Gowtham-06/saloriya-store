import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isSupabaseConfigured } from "../supabase.js";

const StoreContext = createContext();

export function useStore() {
  return useContext(StoreContext);
}

// Fallback seed catalog when database is empty or connection pending
const SEED_PRODUCTS = [
  {
    id: "royal-lotus-chandbali",
    name: "Royal Lotus Antique Gold Chandbali Earrings",
    category: "Earrings",
    price_paise: 10500,
    stock: 2,
    description: "Elegant antique gold-tone chandbali earrings featuring beautiful royal blue stone accents, intricate floral motifs, and lustrous hanging pearls.",
    colours: ["BLUE", "RED"],
    images: ["/logo.png"],
    is_published: true
  },
  {
    id: "antique-silver-stone-jhumka",
    name: "Antique Silver Stone Jhumka Earrings",
    category: "Earrings",
    price_paise: 12900,
    stock: 5,
    description: "Elegant antique silver-tone jhumka earrings featuring floral motifs, vibrant stone centers, and dangling metallic beads.",
    colours: ["PINK", "BLACK", "RED", "GREEN", "MAROON"],
    images: ["/logo.png"],
    is_published: true
  },
  {
    id: "antique-gold-ruby-temple-jhumka",
    name: "Antique Gold Ruby Temple Jhumka Earrings",
    category: "Earrings",
    price_paise: 8900,
    stock: 5,
    description: "Beautiful antique gold-tone temple earrings featuring intricate goddess Lakshmi motifs and hanging pearls.",
    colours: ["MAROON", "BLUE", "PINK", "GREEN", "SKY BLUE"],
    images: ["/logo.png"],
    is_published: true
  },
  {
    id: "antique-gold-stone-bridal-jhumka",
    name: "Antique Gold Stone Bridal Jhumka Earrings",
    category: "Jhumkas",
    price_paise: 16900,
    stock: 5,
    description: "Intricate floral and peacock antique gold bridal jhumka earrings with stone studs.",
    colours: ["BLACK", "GREEN", "VIOLET", "SKY BLUE", "RED"],
    images: ["/logo.png"],
    is_published: true
  },
  {
    id: "royal-square-pearl-jhumka",
    name: "Royal Square Pearl Jhumka Earrings",
    category: "Jhumkas",
    price_paise: 6900,
    stock: 3,
    description: "Royal square stones, pearl accents, and traditional filigree bell drops.",
    colours: ["BLUE", "BLACK", "GREEN", "PINK", "SKY BLUE", "RED"],
    images: ["/logo.png"],
    is_published: true
  },
  {
    id: "butterfly-earrings",
    name: "Butterfly Earring",
    category: "Jhumkas",
    price_paise: 6900,
    stock: 5,
    description: "Lavender Butterfly Oxidised Silver Jhumka Earrings. Add a touch of charm with this trending design.",
    colours: ["GREEN", "PINK", "BEIGE", "LIGHT PINK", "LAVENDER"],
    images: ["/logo.png"],
    is_published: true
  }
];

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeVariantType, setActiveVariantType] = useState("all");
  const [activeColourFilter, setActiveColourFilter] = useState("all");
  const [activePriceFilter, setActivePriceFilter] = useState("all");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [activeSort, setActiveSort] = useState("newest");

  // Modals state
  const [previewProductId, setPreviewProductId] = useState(null);
  const [checkoutItem, setCheckoutItem] = useState(null); // { product, initialColour }

  // Load products from Supabase + localStorage fallback
  const fetchProducts = async () => {
    setLoading(true);
    let loaded = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          loaded = data;
        }
      } catch (err) {
        console.warn("Supabase products fetch failed:", err);
      }
    }

    if (!loaded.length) {
      try {
        const local = JSON.parse(localStorage.getItem("saloriya_admin_products") || "[]");
        if (Array.isArray(local) && local.length > 0) {
          loaded = local.filter(p => p.is_published !== false);
        }
      } catch (e) {
        // ignore
      }
    }

    if (!loaded.length) {
      loaded = SEED_PRODUCTS;
    }

    setProducts(loaded);
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Format currency helper
  const formatMoney = (paise) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format((paise || 0) / 100);
  };

  // Open / Close modal helpers
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
  const availableColours = React.useMemo(() => {
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
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (activeCategory !== "All" && p.category !== activeCategory) return false;

      // Variant Type filter
      const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
      if (activeVariantType === "with-colours" && !hasMultipleColours) return false;
      if (activeVariantType === "single-colour" && hasMultipleColours) return false;

      // Colour filter
      if (activeColourFilter !== "all") {
        if (!Array.isArray(p.colours) || !p.colours.some((c) => c.toLowerCase().trim() === activeColourFilter.toLowerCase().trim())) {
          return false;
        }
      }

      // Price filter
      const inr = (p.price_paise || 0) / 100;
      if (activePriceFilter === "under-50" && inr >= 50) return false;
      if (activePriceFilter === "under-100" && inr >= 100) return false;
      if (activePriceFilter === "under-399" && inr >= 399) return false;
      if (activePriceFilter === "400-699" && (inr < 400 || inr > 699)) return false;
      if (activePriceFilter === "700-999" && (inr < 700 || inr > 999)) return false;
      if (activePriceFilter === "1000-plus" && inr < 1000) return false;

      // In stock only filter
      if (inStockOnly && (p.stock || 0) <= 0) return false;

      return true;
    }).sort((a, b) => {
      if (activeSort === "price-asc") return (a.price_paise || 0) - (b.price_paise || 0);
      if (activeSort === "price-desc") return (b.price_paise || 0) - (a.price_paise || 0);
      if (activeSort === "name-asc") return a.name.localeCompare(b.name);
      // Newest
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
    closeCheckout
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
