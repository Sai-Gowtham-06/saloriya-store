import React from "react";
import { useStore } from "../../context/StoreContext";

export default function StorefrontToolbar() {
  const {
    availableColours,
    activeColourFilter,
    setActiveColourFilter,
    activePriceFilter,
    setActivePriceFilter,
    inStockOnly,
    setInStockOnly,
    activeSort,
    setActiveSort,
    resetFilters,
    filteredProducts
  } = useStore();

  const isFiltered =
    activeColourFilter !== "all" ||
    activePriceFilter !== "all" ||
    inStockOnly ||
    activeSort !== "newest";

  return (
    <>
      <div className="storefront-toolbar" id="storefront-toolbar">
        <div className="toolbar-filters-group">
          {/* Colour Filter */}
          <div className="toolbar-select-wrap">
            <label htmlFor="filter-colour" className="toolbar-label">
              Colour:
            </label>
            <select
              id="filter-colour"
              className="toolbar-select"
              value={activeColourFilter}
              onChange={(e) => setActiveColourFilter(e.target.value)}
            >
              <option value="all">All Colours</option>
              {availableColours.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Price Range Filter */}
          <div className="toolbar-select-wrap">
            <label htmlFor="filter-price" className="toolbar-label">
              Price:
            </label>
            <select
              id="filter-price"
              className="toolbar-select"
              value={activePriceFilter}
              onChange={(e) => setActivePriceFilter(e.target.value)}
            >
              <option value="all">All Prices</option>
              <option value="under-50">Under ₹50</option>
              <option value="under-100">Under ₹100</option>
              <option value="under-399">Under ₹399</option>
              <option value="400-699">₹400 – ₹699</option>
              <option value="700-999">₹700 – ₹999</option>
              <option value="1000-plus">₹1,000 &amp; Above</option>
            </select>
          </div>

          {/* In Stock Only */}
          <label className="toolbar-checkbox-label">
            <input
              type="checkbox"
              id="filter-instock"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            <span>In Stock Only</span>
          </label>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              id="reset-storefront-filters"
              className="toolbar-reset-btn"
              onClick={resetFilters}
            >
              ✕ Reset Filters
            </button>
          )}
        </div>

        {/* Sort Group */}
        <div className="toolbar-sort-group">
          <label htmlFor="sort-products" className="toolbar-label">
            Sort By:
          </label>
          <select
            id="sort-products"
            className="toolbar-select toolbar-sort-select"
            value={activeSort}
            onChange={(e) => setActiveSort(e.target.value)}
          >
            <option value="newest">Featured · Newest</option>
            <option value="price-asc">Price: Low to High (₹ → ₹₹₹)</option>
            <option value="price-desc">Price: High to Low (₹₹₹ → ₹)</option>
            <option value="name-asc">Product Name (A – Z)</option>
          </select>
        </div>
      </div>

      <div className="results-meta-bar">
        <span className="results-count-text">
          Displaying {filteredProducts.length} piece{filteredProducts.length === 1 ? "" : "s"}
        </span>
      </div>
    </>
  );
}
