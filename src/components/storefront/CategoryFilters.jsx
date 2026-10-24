import React from "react";
import { useStore } from "../../context/StoreContext";

const CATEGORIES = [
  { id: "All", label: "All Categories" },
  { id: "Combos", label: "Chain & Earring Combos" },
  { id: "Earrings", label: "Earrings" },
  { id: "Bracelets", label: "Bracelets & Bangles" },
  { id: "Jhumkas", label: "Jhumkas" },
  { id: "Studs", label: "Studs" },
  { id: "Chains", label: "Chains & Necklaces" }
];

export default function CategoryFilters() {
  const { activeCategory, setActiveCategory } = useStore();

  return (
    <div className="filters" id="filters">
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          className={`filter ${activeCategory === cat.id ? "active" : ""}`}
          onClick={() => setActiveCategory(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}
