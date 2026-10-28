import React, { useState, useEffect } from "react";
import AdminHeader from "../components/admin/AdminHeader";
import AdminAuthGate from "../components/admin/AdminAuthGate";
import AdminMetrics from "../components/admin/AdminMetrics";
import AdminOrders from "../components/admin/AdminOrders";
import AdminProductStudio from "../components/admin/AdminProductStudio";
import AdminStockMonitor from "../components/admin/AdminStockMonitor";
import AdminPromoManager from "../components/admin/AdminPromoManager";
import AdminRecordOrderModal from "../components/admin/AdminRecordOrderModal";
import { useStore } from "../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../supabase.js";
import ordersSeed from "../ordersSeed.json";

export default function AdminPage() {
  const { products, fetchProducts } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("saloriya_admin_auth") === "true";
  });

  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'products' | 'inventory' | 'promos'
  const [orders, setOrders] = useState(() => {
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        return [...local].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
      }
    } catch (e) {}
    const seed = Array.isArray(ordersSeed) ? ordersSeed : [];
    return [...seed].sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [openAddProductTrigger, setOpenAddProductTrigger] = useState(0);
  const [promosCount, setPromosCount] = useState(() => {
    try {
      const deleted = JSON.parse(localStorage.getItem("saloriya_deleted_promo_codes") || "[]");
      const initialized = localStorage.getItem("saloriya_promo_initialized") === "true";
      const local = JSON.parse(localStorage.getItem("saloriya_admin_promo_codes") || "[]");
      if (Array.isArray(local) && local.length > 0) {
        const filtered = local.filter((p) => !deleted.includes(p.code));
        return filtered.length;
      }
      if (deleted.includes("FREEDELIVERY") || initialized) {
        return 0;
      }
    } catch (e) {}
    return 0;
  });

  const getDeletedOrderIds = () => {
    try {
      const raw = JSON.parse(localStorage.getItem("saloriya_deleted_order_ids") || "[]");
      if (Array.isArray(raw)) {
        return raw.filter((d) => d && d !== "undefined" && d !== "null" && typeof d === "string" && d.trim() !== "");
      }
    } catch (e) {
      return [];
    }
    return [];
  };

  const loadOrders = async () => {
    let apiList = [];
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      if (json?.success && Array.isArray(json.orders)) {
        apiList = json.orders;
      }
    } catch (e) {
      console.warn("Central /api/orders fetch warning:", e);
    }

    let sbList = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && Array.isArray(data)) {
          sbList = data.map((o) => ({
            ...o,
            order_id: o.order_id || (o.id ? `SLR-${String(o.id).slice(-6).toUpperCase()}` : `SLR-${Date.now().toString().slice(-6)}`),
            customer_phone: o.customer_phone || o.phone || "",
            delivery_address: o.delivery_address || (typeof o.address === "object" ? (o.address?.full || `${o.address?.street || ""}, ${o.address?.city || ""}`) : String(o.address || "")),
            status: (o.status || o.order_status || "confirmed").toLowerCase(),
            payment_method: (o.payment_method || "cod").toLowerCase()
          }));
        }
      } catch (e) {
        console.warn("Supabase orders query error:", e);
      }
    }

    let localList = [];
    try {
      const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
      if (Array.isArray(local)) localList = local;
    } catch (e) {}

    // Baseline seed fallback: only used if all live sources (API, Supabase, LocalStorage) are empty
    const baseSeed = Array.isArray(ordersSeed) ? ordersSeed : [];
    const liveOrders = [...apiList, ...sbList, ...localList].filter(Boolean);
    const candidateList = liveOrders.length > 0 ? liveOrders : baseSeed;

    const normalizePhone = (p) => String(p || "").replace(/\D/g, "").slice(-10);
    const normalizeName = (n) => String(n || "").trim().toLowerCase();

    // Deduplicate and merge across all sources
    const mergedMap = new Map();

    candidateList.forEach((o) => {
      if (!o) return;

      const hasProducts = Boolean(
        (o.product_name && String(o.product_name).trim()) ||
        (Array.isArray(o.items) && o.items.length > 0) ||
        (o.product_id && String(o.product_id).trim())
      );

      const rawOrderId = o.order_id && String(o.order_id).trim() !== "" && String(o.order_id) !== "undefined" && String(o.order_id) !== "null"
        ? String(o.order_id).trim()
        : null;
      const rawDbId = o.id && String(o.id).trim() !== "" && String(o.id) !== "undefined" && String(o.id) !== "null"
        ? String(o.id).trim()
        : null;
      const effectiveOrderId = rawOrderId || (rawDbId ? `SLR-${String(rawDbId).slice(-6).toUpperCase()}` : null);

      const normalizedItem = {
        ...o,
        order_id: effectiveOrderId || `SLR-${Date.now().toString().slice(-6)}`,
        id: rawDbId || o.id || undefined,
        customer_phone: o.customer_phone || o.phone || "",
        delivery_address: o.delivery_address || (typeof o.address === "object" ? (o.address?.full || `${o.address?.street || ""}, ${o.address?.city || ""}`) : String(o.address || "")),
        status: (o.status || o.order_status || "confirmed").toLowerCase(),
        payment_method: (o.payment_method || "cod").toLowerCase()
      };

      const itemPhone = normalizePhone(normalizedItem.customer_phone);
      const itemName = normalizeName(normalizedItem.customer_name);
      const itemTime = new Date(normalizedItem.created_at || normalizedItem.updated_at || 0).getTime();
      const itemPaise = Number(normalizedItem.total_paise || 0);

      let matchedKey = null;

      // 1. Direct match by order_id or database id
      if (rawOrderId && mergedMap.has(rawOrderId)) {
        matchedKey = rawOrderId;
      } else if (rawDbId && mergedMap.has(rawDbId)) {
        matchedKey = rawDbId;
      } else {
        // 2. Fuzzy match across existing processed orders to catch duplicate fragments from same checkout
        for (const [k, existing] of mergedMap.entries()) {
          const exPhone = normalizePhone(existing.customer_phone);
          const exName = normalizeName(existing.customer_name);
          const exTime = new Date(existing.created_at || existing.updated_at || 0).getTime();
          const exPaise = Number(existing.total_paise || 0);

          const isSameCustomer = (itemPhone && exPhone && itemPhone === exPhone) || (itemName && exName && itemName === exName);
          const isSameAmount = Math.abs(itemPaise - exPaise) === 0;
          const isCloseTime = Math.abs(itemTime - exTime) < 300000; // within 5 minutes

          if (isSameCustomer && isSameAmount && isCloseTime) {
            matchedKey = k;
            break;
          }
        }
      }

      if (matchedKey) {
        const existing = mergedMap.get(matchedKey);
        const existingHasProducts = Boolean(
          (existing.product_name && String(existing.product_name).trim()) ||
          (Array.isArray(existing.items) && existing.items.length > 0)
        );

        // Merge: keep the richer product info, keep database id, keep the legitimate SLR order_id
        const richerOrder = (hasProducts && !existingHasProducts) ? normalizedItem : existing;
        const secondary = (hasProducts && !existingHasProducts) ? existing : normalizedItem;

        const merged = {
          ...secondary,
          ...richerOrder,
          id: richerOrder.id || secondary.id,
          order_id: (richerOrder.order_id && !richerOrder.order_id.includes("-") ? richerOrder.order_id : null) ||
                    (richerOrder.order_id && !richerOrder.order_id.startsWith("SLR-") ? richerOrder.order_id : null) ||
                    richerOrder.order_id || secondary.order_id
        };

        mergedMap.set(matchedKey, merged);
      } else {
        // Ignore ghost dummy record with no product info and no legitimate order_id
        if (!hasProducts && (!normalizedItem.product_name && (!normalizedItem.items || normalizedItem.items.length === 0))) {
          return;
        }

        const primaryKey = rawOrderId || normalizedItem.order_id || `order_${mergedMap.size}_${Date.now()}`;
        mergedMap.set(primaryKey, normalizedItem);
      }
    });

    let list = Array.from(mergedMap.values());
    list.sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime());

    const deletedIds = getDeletedOrderIds();
    if (deletedIds.length > 0) {
      list = list.filter((o) => {
        const oid = o.order_id ? String(o.order_id).trim() : null;
        const uid = o.id ? String(o.id).trim() : null;
        if (oid && deletedIds.includes(oid)) return false;
        if (uid && deletedIds.includes(uid)) return false;
        return true;
      });
    }

    // Safety fallback: if list is empty but seed exists and no deletedIds, keep seed
    if (list.length === 0 && baseSeed.length > 0 && deletedIds.length === 0) {
      list = [...baseSeed];
    }

    // Keep localStorage synchronized with latest unified list
    try {
      localStorage.setItem("saloriya_admin_orders", JSON.stringify(list));
      localStorage.setItem("saloriya_deleted_order_ids", JSON.stringify(deletedIds));
    } catch (e) {}

    setOrders(list);
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session) {
          setIsAuthenticated(true);
          sessionStorage.setItem("saloriya_admin_auth", "true");
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setIsAuthenticated(true);
          sessionStorage.setItem("saloriya_admin_auth", "true");
        }
      });

      return () => {
        authListener?.subscription?.unsubscribe?.();
      };
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadOrders();
    fetchProducts();

    const handleSync = () => {
      if (document.visibilityState === "visible") {
        loadOrders();
      }
    };
    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    const interval = setInterval(() => {
      loadOrders();
    }, 30000);

    return () => {
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const handleLoginSuccess = () => {
    sessionStorage.setItem("saloriya_admin_auth", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {}
    }
    sessionStorage.removeItem("saloriya_admin_auth");
    sessionStorage.removeItem("saloriya_admin_user");
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="admin-body">
        <AdminHeader />
        <main className="admin-wrap">
          <AdminAuthGate onLoginSuccess={handleLoginSuccess} />
        </main>
      </div>
    );
  }

  const pendingOrdersCount = orders.filter((o) => (o.status || o.order_status || "").toLowerCase() === "pending").length;

  return (
    <div className="admin-body">
      <AdminHeader />
      <main className="admin-wrap">
        <section id="dashboard">
          {/* Admin Title Strip */}
          <div className="admin-title">
            <div>
              <p className="eyebrow">SALORIYA MANAGEMENT CONSOLE</p>
              <h1>
                Store <em>Studio &amp; Orders.</em>
              </h1>
            </div>
            <div className="admin-header-actions">
              <button
                id="admin-add-piece-header-btn"
                className="button button-gold"
                type="button"
                onClick={() => {
                  setActiveTab("products");
                  setEditingProduct(null);
                  setOpenAddProductTrigger((t) => t + 1);
                }}
              >
                + Add Piece
              </button>
              <button
                id="open-record-order-btn"
                className="button button-outline"
                type="button"
                onClick={() => setShowRecordModal(true)}
              >
                + Record Order
              </button>
              <button id="signout" className="button button-outline" type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>

          {/* Segmented Luxury Navigation Tabs */}
          <nav className="admin-tabs-nav" aria-label="Admin Sections">
            <button
              type="button"
              className={`admin-tab ${activeTab === "orders" ? "active" : ""}`}
              onClick={() => setActiveTab("orders")}
            >
              <span className="tab-icon">📦</span>
              <span>Orders Dashboard</span>
              {pendingOrdersCount > 0 && <span className="tab-badge">{pendingOrdersCount}</span>}
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === "products" ? "active" : ""}`}
              onClick={() => setActiveTab("products")}
            >
              <span className="tab-icon">✨</span>
              <span>Product Studio</span>
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === "inventory" ? "active" : ""}`}
              onClick={() => setActiveTab("inventory")}
            >
              <span className="tab-icon">📋</span>
              <span>Live Stock Monitor</span>
            </button>
            <button
              type="button"
              className={`admin-tab ${activeTab === "promos" ? "active" : ""}`}
              onClick={() => setActiveTab("promos")}
            >
              <span className="tab-icon">🏷️</span>
              <span>Promo Codes</span>
              {promosCount > 0 && <span className="tab-badge">{promosCount}</span>}
            </button>
          </nav>

          {/* TAB 1: ORDERS DASHBOARD */}
          {activeTab === "orders" && (
            <>
              <AdminMetrics orders={orders} />
              <AdminOrders
                orders={orders}
                products={products}
                onOrderUpdated={loadOrders}
                onOpenRecordOrder={() => setShowRecordModal(true)}
              />
            </>
          )}

          {/* TAB 2: PRODUCT STUDIO */}
          {activeTab === "products" && (
            <AdminProductStudio
              products={products}
              onProductChanged={fetchProducts}
              editingProduct={editingProduct}
              setEditingProduct={setEditingProduct}
              openAddTrigger={openAddProductTrigger}
            />
          )}

          {/* TAB 3: LIVE STOCK MONITOR */}
          {activeTab === "inventory" && (
            <AdminStockMonitor
              products={products}
              onProductChanged={fetchProducts}
              onEditInStudio={(prod) => {
                setEditingProduct(prod);
                setActiveTab("products");
                window.scrollTo({ top: 150, behavior: "smooth" });
              }}
            />
          )}

          {/* TAB 4: PROMO CODES */}
          {activeTab === "promos" && (
            <AdminPromoManager onPromosUpdated={(count) => setPromosCount(count)} />
          )}
        </section>
      </main>

      {/* Record Order Modal */}
      <AdminRecordOrderModal
        isOpen={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        products={products}
        onOrderCreated={() => {
          loadOrders();
          fetchProducts();
        }}
      />
    </div>
  );
}
