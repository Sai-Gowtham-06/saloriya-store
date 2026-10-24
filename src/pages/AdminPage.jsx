import React, { useState, useEffect } from "react";
import AdminHeader from "../components/admin/AdminHeader";
import AdminAuthGate from "../components/admin/AdminAuthGate";
import AdminMetrics from "../components/admin/AdminMetrics";
import AdminOrders from "../components/admin/AdminOrders";
import AdminProductForm from "../components/admin/AdminProductForm";
import AdminInventoryList from "../components/admin/AdminInventoryList";
import AdminPromoManager from "../components/admin/AdminPromoManager";
import { useStore } from "../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../supabase.js";

export default function AdminPage() {
  const { products, fetchProducts } = useStore();
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("saloriya_admin_auth") === "true";
  });

  const [orders, setOrders] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

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
      <>
        <AdminHeader isAuthenticated={false} />
        <AdminAuthGate onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <>
      <AdminHeader isAuthenticated={true} onLogout={handleLogout} />
      <div className="admin-wrap">
        <div className="admin-title">
          <div>
            <span className="eyebrow">SALORIYA MANAGEMENT SYSTEM</span>
            <h1>Operations Console</h1>
          </div>
        </div>

        <AdminMetrics orders={orders} />
        <AdminOrders orders={orders} onOrderUpdated={loadOrders} />

        <div className="admin-columns">
          <AdminProductForm
            editingProduct={editingProduct}
            onSaved={() => {
              setEditingProduct(null);
              fetchProducts();
            }}
            onCancel={() => setEditingProduct(null)}
          />
          <AdminInventoryList
            products={products}
            onEdit={(prod) => {
              setEditingProduct(prod);
              window.scrollTo({ top: 600, behavior: "smooth" });
            }}
            onProductChanged={fetchProducts}
          />
        </div>

        <AdminPromoManager />
      </div>
    </>
  );
}
