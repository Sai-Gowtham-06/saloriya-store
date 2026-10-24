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
  const [promosCount, setPromosCount] = useState(3);

  const loadOrders = async () => {
    let list = [];
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        if (!error && Array.isArray(data)) {
          list = data;
        }
      } catch (e) {
        console.warn("Supabase orders query error:", e);
      }
    }

    if (!list.length) {
      try {
        const local = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
        if (Array.isArray(local)) list = local;
      } catch (e) {}
    }

    setOrders(list);
  };

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

  const handleLogout = () => {
    sessionStorage.removeItem("saloriya_admin_auth");
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
