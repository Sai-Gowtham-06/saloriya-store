import React from "react";
import { useStore } from "../../context/StoreContext";
import ProductCard from "./ProductCard";

export default function ProductGrid() {
  const { filteredProducts, loading } = useStore();

  if (loading) {
    return (
      <div className="product-grid" id="product-grid">
        <p className="loading">Opening the jewellery box…</p>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <p className="empty-state" id="empty-state">
        No pieces match your selected filters. Try clearing some filters or message us on WhatsApp!
      </p>
    );
  }

  return (
    <div className="product-grid" id="product-grid">
      {filteredProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
