import React from "react";
import { useStore } from "../../context/StoreContext";

export default function CollectionTabs() {
  const { activeVariantType, setActiveVariantType } = useStore();

  return (
    <div className="collection-type-tabs" id="collection-type-tabs" aria-label="Collection Variants">
      <button
        type="button"
        className={`collection-tab ${activeVariantType === "all" ? "active" : ""}`}
        onClick={() => setActiveVariantType("all")}
      >
        <span className="tab-label">All Creations</span>
      </button>
      <button
        type="button"
        className={`collection-tab ${activeVariantType === "with-colours" ? "active" : ""}`}
        onClick={() => setActiveVariantType("with-colours")}
      >
        <span className="tab-label">✨ Multi-Colour Editions</span>
      </button>
      <button
        type="button"
        className={`collection-tab ${activeVariantType === "single-colour" ? "active" : ""}`}
        onClick={() => setActiveVariantType("single-colour")}
      >
        <span className="tab-label">👑 Signature Single Looks</span>
      </button>
    </div>
  );
}
