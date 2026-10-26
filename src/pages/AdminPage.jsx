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

export default function AdminPage() {
  const { products, fetchProducts } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("saloriya_admin_auth") === "true";
  });

  const [activeTab, setActiveTab] = useState("orders"); // 'orders' | 'products' | 'inventory' | 'promos'
  const [orders, setOrders] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showRecordModal, setShowRecordModal] = useState(false);
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
      return JSON.parse(localStorage.getItem("saloriya_deleted_order_ids") || "[]");
    } catch (e) {
      return [];
    }
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
            status: o.status || o.order_status || "confirmed"
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

    // Merge and deduplicate across Central API, Supabase, and localStorage
    const mergedMap = new Map();
    [...apiList, ...sbList, ...localList].forEach((o) => {
      const key = String(o.order_id || o.id);
      if (key && !mergedMap.has(key)) {
        mergedMap.set(key, o);
      }
    });

    let list = Array.from(mergedMap.values());

    const deletedIds = getDeletedOrderIds();
    if (deletedIds.length > 0) {
      list = list.filter((o) => {
        const oid = o.order_id ? String(o.order_id) : null;
        const uid = o.id ? String(o.id) : null;
        if (oid && deletedIds.some((d) => String(d) === oid)) return false;
        if (uid && deletedIds.some((d) => String(d) === uid)) return false;
        return true;
      });
    }

    // Keep localStorage synchronized with latest unified list
    try {
      localStorage.setItem("saloriya_admin_orders", JSON.stringify(list));
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
    if (isAuthenticated) {
      loadOrders();
      fetchProducts();
    }
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

  const pendingOrdersCount = orders.filter((o) => o.status === "pending").length;

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
                id="open-record-order-btn"
                className="button button-gold"
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
              <span className="tab-icon"></span>
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
