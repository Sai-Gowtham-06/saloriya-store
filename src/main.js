import "./style.css";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const grid = document.querySelector("#product-grid");
const empty = document.querySelector("#empty-state");
const filters = document.querySelector("#filters");
const modal = document.querySelector("#product-modal");
const modalContent = document.querySelector("#product-modal-content");
document.querySelector("#year").textContent = new Date().getFullYear();

let products = [];
let activeCategory = "All";
let activeVariantType = "all"; // "all" | "with-colours" | "single-colour"
let activeColourFilter = "all";
let activePriceFilter = "all";
let inStockOnly = false;
let activeSort = "newest";
let currentModalProductId = null;

// Storefront UI Elements
const collectionTabs = document.querySelector("#collection-type-tabs");
const filterColour = document.querySelector("#filter-colour");
const filterPrice = document.querySelector("#filter-price");
const filterInstock = document.querySelector("#filter-instock");
const sortProducts = document.querySelector("#sort-products");
const resetFiltersBtn = document.querySelector("#reset-storefront-filters");
const resultsCountText = document.querySelector("#results-count-text");
const countAllPieces = document.querySelector("#count-all-pieces");
const countWithColours = document.querySelector("#count-with-colours");
const countSingleColour = document.querySelector("#count-single-colour");

function money(paise) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((paise || 0) / 100);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}

// Compress and resize images for fast client-side storage without quota limits
function compressImageForStorage(file, maxWidth = 1000, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Email notification dispatcher to Saloriyaofficial@gmail.com
function sendOrderEmailNotification({
  orderId,
  customerName,
  phone,
  address,
  productName,
  colour,
  quantity,
  totalAmount,
  paymentMethod,
  hasScreenshot
}) {
  try {
    const payload = {
      _subject: ` New Order Confirmed #${orderId} - SALORIYA Store`,
      _template: "table",
      _captcha: "false",
      "Order ID": `#${orderId}`,
      "Customer Name": customerName,
      "Customer Phone": phone,
      "Delivery Address": address,
      "Jewellery Item": productName,
      "Colour / Variant": colour || "Standard",
      "Quantity": String(quantity),
      "Total Amount": `${totalAmount} (Includes ₹50 Transport)`,
      "Payment Method": paymentMethod === "prepaid" ? "Online Prepaid (UPI Screenshot Uploaded)" : "Cash on Delivery (COD)",
      "Payment Screenshot": hasScreenshot ? "✅ Attached / Uploaded on Website (View in Admin Portal)" : "N/A (Cash on Delivery)",
      "Order Status": "CONFIRMED & INVENTORY STOCK DEDUCTED ✓",
      "Admin Portal": window.location.origin + "/admin.html"
    };

    fetch("https://formsubmit.co/ajax/Saloriyaofficial@gmail.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => console.log("Email notification sent to Saloriyaofficial@gmail.com:", data))
      .catch(err => console.warn("Email dispatch notice:", err));
  } catch (err) {
    console.warn("Could not dispatch email notification:", err);
  }
}

// Local orders storage helper
function saveLocalOrder(orderObj, itemObj) {
  try {
    const list = JSON.parse(localStorage.getItem("saloriya_local_orders") || "[]");
    orderObj.items = [itemObj];
    list.unshift(orderObj);
    localStorage.setItem("saloriya_local_orders", JSON.stringify(list.slice(0, 50)));
  } catch (e) {
    console.warn("Could not save to saloriya_local_orders:", e);
  }
}

function getColourImage(p, colourName = "", colourIndex = 0) {
  if (!p.image_urls || p.image_urls.length === 0) return null;
  const clean = colourName.trim().toLowerCase();
  if (clean) {
    const matched = p.image_urls.find(url => {
      try {
        const decoded = decodeURIComponent(url).toLowerCase();
        return decoded.includes(clean);
      } catch {
        return false;
      }
    });
    if (matched) return matched;
  }
  if (typeof colourIndex === "number" && colourIndex >= 0 && colourIndex < p.image_urls.length) {
    return p.image_urls[colourIndex];
  }
  return p.image_urls[0];
}

function productCard(p) {
  const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
  const initialColour = p.colours?.[0] || "";
  const image = getColourImage(p, initialColour, 0);

  // Variant badge
  const variantBadge = hasMultipleColours
    ? `<span class="card-variant-badge multi-colour">✨ ${p.colours.length} Colour Options</span>`
    : `<span class="card-variant-badge single-look">👑 Signature Single Edition</span>`;

  // Colour swatches if multiple colours
  const swatchesHtml = hasMultipleColours ? `
    <div class="card-colour-wrapper">
      <div class="card-colour-header">
        <span class="card-colour-label">Colour:</span>
        <span class="card-selected-colour-name">${escapeHtml(initialColour)}</span>
      </div>
      <div class="card-colour-swatches">
        ${p.colours.map((c, i) => `
          <button type="button" class="card-colour-swatch ${i === 0 ? 'active' : ''}" data-product="${p.id}" data-colour="${escapeHtml(c)}" data-index="${i}" title="${escapeHtml(c)}">
            ${escapeHtml(c)}
          </button>
        `).join("")}
      </div>
    </div>
  ` : "";

  const coloursDropdown = (p.colours || []).map((c, i) => `<option value="${escapeHtml(c)}" data-index="${i}">${escapeHtml(c)}</option>`).join("");

  return `<article class="product-card" data-product-id="${p.id}" data-selected-colour="${escapeHtml(initialColour || 'Standard')}">
    <div class="product-image" data-open-preview="${p.id}" title="Click to view details & photos">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<div class="image-placeholder"><span>S</span><small>READY TO WEAR</small></div>`}
      ${p.stock <= 0 ? '<span class="stock-tag out-of-stock">Out of stock</span>' : '<span class="stock-tag">Ready to wear</span>'}
      <div class="card-quick-preview-badge">Quick View </div>
    </div>
    <div class="product-info" data-open-preview="${p.id}">
      <div>
        ${variantBadge}
        <p class="product-category">${escapeHtml(p.category || "GOLD COVERING")}</p>
        <h3 class="product-title-link">${escapeHtml(p.name)}</h3>
      </div>
      <strong>${money(p.price_paise)}</strong>
    </div>
    ${p.description ? `<p class="product-description" data-open-preview="${p.id}">${escapeHtml(p.description)}</p>` : ""}
    ${swatchesHtml}
    ${p.colours?.length ? `<label class="colour-label" style="display:none;"><select class="colour-select" data-product="${p.id}">${coloursDropdown}</select></label>` : ""}
    <div class="card-action-row">
      <button type="button" class="card-buy-btn" data-buy="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
        <span>${p.stock <= 0 ? "Out of Stock" : "Order Now "}</span>
      </button>
      <button type="button" class="card-wa-btn" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""} title="Order on WhatsApp">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z"/>
        </svg>
        <span>WhatsApp </span>
      </button>
    </div>
  </article>`;
}

function populateColourDropdown() {
  if (!filterColour) return;
  const colourSet = new Set();
  products.forEach(p => {
    if (Array.isArray(p.colours)) {
      p.colours.forEach(c => {
        const trimmed = c.trim();
        if (trimmed) colourSet.add(trimmed);
      });
    }
  });

  const sortedColours = Array.from(colourSet).sort();
  filterColour.innerHTML = `
    <option value="all">All Colours</option>
    ${sortedColours.map(c => `<option value="${escapeHtml(c)}" ${activeColourFilter === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join("")}
  `;
}

function render() {
  const totalCount = products.length;

  // 1. Filter
  let shown = products.filter(p => {
    // Category filter
    if (activeCategory !== "All" && p.category !== activeCategory) return false;

    // Variant Type filter (No colours separate vs With colour options separate)
    const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
    if (activeVariantType === "with-colours" && !hasMultipleColours) return false;
    if (activeVariantType === "single-colour" && hasMultipleColours) return false;

    // Colour filter
    if (activeColourFilter !== "all") {
      if (!Array.isArray(p.colours) || !p.colours.some(c => c.toLowerCase().trim() === activeColourFilter.toLowerCase().trim())) {
        return false;
      }
    }

    // Price filter
    if (activePriceFilter === "under-50" && p.price_paise >= 5000) return false;
    if (activePriceFilter === "under-100" && p.price_paise >= 10000) return false;
    if (activePriceFilter === "under-399" && p.price_paise >= 39900) return false;
    if (activePriceFilter === "400-699" && (p.price_paise < 40000 || p.price_paise > 69900)) return false;
    if (activePriceFilter === "700-999" && (p.price_paise < 70000 || p.price_paise > 99900)) return false;
    if (activePriceFilter === "1000-plus" && p.price_paise < 100000) return false;

    // Stock filter
    if (inStockOnly && p.stock <= 0) return false;

    return true;
  });

  // 2. Sort
  shown.sort((a, b) => {
    if (activeSort === "newest") return new Date(b.created_at) - new Date(a.created_at);
    if (activeSort === "price-asc") return (a.price_paise || 0) - (b.price_paise || 0);
    if (activeSort === "price-desc") return (b.price_paise || 0) - (a.price_paise || 0);
    if (activeSort === "name-asc") return (a.name || "").localeCompare(b.name || "");
    return 0;
  });

  // When viewing "All Creations" with default sort and no narrow filter,
  // arrange so Multi-Colour options and Single Looks are sequenced in distinct harmony!
  if (activeVariantType === "all" && activeSort === "newest" && activeColourFilter === "all" && activePriceFilter === "all") {
    const multiColoursList = shown.filter(p => Array.isArray(p.colours) && p.colours.length > 1);
    const singleColourList = shown.filter(p => !Array.isArray(p.colours) || p.colours.length <= 1);
    shown = [...multiColoursList, ...singleColourList];
  }

  // Update UI Results Count & Reset Button
  const hasActiveFilters = activeCategory !== "All" || activeVariantType !== "all" || activeColourFilter !== "all" || activePriceFilter !== "all" || inStockOnly;
  if (resetFiltersBtn) {
    resetFiltersBtn.hidden = !hasActiveFilters;
  }
  if (resultsCountText) {
    resultsCountText.innerHTML = `Displaying <strong>${shown.length}</strong> of ${totalCount} pieces`;
  }

  grid.innerHTML = shown.map(productCard).join("");
  empty.hidden = shown.length > 0;
}

async function loadProducts() {
  if (!isSupabaseConfigured) {
    grid.innerHTML = `<div class="setup-note"><strong>Your storefront is ready for its database connection.</strong><p>Follow SETUP.md to add your Supabase project URL and publishable key, run the SQL setup, and add products through the admin page.</p><a href="/admin.html">Open admin dashboard </a></div>`;
    return;
  }
  const { data, error } = await supabase.from("products").select("*").eq("is_published", true).order("created_at", { ascending: false });
  if (error) {
    grid.innerHTML = `<div class="setup-note"><strong>We couldn't load the collection.</strong><p>${escapeHtml(error.message)}</p><p>Check the database schema and Row Level Security policies in SETUP.md.</p></div>`;
    return;
  }
  products = data || [];
  populateColourDropdown();
  render();

  // Check if page opened with product hash (e.g. #product-<id>)
  if (window.location.hash.startsWith("#product-")) {
    const hashId = window.location.hash.replace("#product-", "");
    if (hashId) {
      openProductModal(hashId);
    }
  }
}

// Category filter pills
filters?.addEventListener("click", e => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  filters.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === btn));
  render();
});

// Collection variant type tabs (Separates with colours vs without colours)
collectionTabs?.addEventListener("click", e => {
  const btn = e.target.closest("[data-variant-type]");
  if (!btn) return;
  activeVariantType = btn.dataset.variantType;
  collectionTabs.querySelectorAll(".collection-tab").forEach(b => b.classList.toggle("active", b === btn));
  render();
});

// Refine & Sort Toolbar listeners
filterColour?.addEventListener("change", e => {
  activeColourFilter = e.target.value;
  render();
});

filterPrice?.addEventListener("change", e => {
  activePriceFilter = e.target.value;
  render();
});

filterInstock?.addEventListener("change", e => {
  inStockOnly = e.target.checked;
  render();
});

sortProducts?.addEventListener("change", e => {
  activeSort = e.target.value;
  render();
});

resetFiltersBtn?.addEventListener("click", () => {
  activeCategory = "All";
  activeVariantType = "all";
  activeColourFilter = "all";
  activePriceFilter = "all";
  inStockOnly = false;
  activeSort = "newest";

  if (filters) {
    filters.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b.dataset.category === "All"));
  }
  if (collectionTabs) {
    collectionTabs.querySelectorAll(".collection-tab").forEach(b => b.classList.toggle("active", b.dataset.variantType === "all"));
  }
  if (filterColour) filterColour.value = "all";
  if (filterPrice) filterPrice.value = "all";
  if (filterInstock) filterInstock.checked = false;
  if (sortProducts) sortProducts.value = "newest";

  render();
});

// Grid click: handles Buy Now, WhatsApp quick buy, colour swatch clicks, OR opens full modal
grid.addEventListener("click", e => {
  // 1. Swatch click on card: changes product image & sets active colour
  const swatch = e.target.closest(".card-colour-swatch");
  if (swatch) {
    e.stopPropagation();
    const card = swatch.closest(".product-card");
    if (!card) return;
    const p = products.find(x => x.id === swatch.dataset.product);
    if (!p) return;

    const chosenColour = swatch.dataset.colour;
    const colourIndex = Number(swatch.dataset.index);

    // Update active swatch
    card.querySelectorAll(".card-colour-swatch").forEach(s => s.classList.remove("active"));
    swatch.classList.add("active");

    // Update card dataset and hidden select
    card.dataset.selectedColour = chosenColour;
    const nameLabel = card.querySelector(".card-selected-colour-name");
    if (nameLabel) nameLabel.textContent = chosenColour;
    const select = card.querySelector(".colour-select");
    if (select) {
      select.value = chosenColour;
      select.dataset.selectedColour = chosenColour;
    }

    // Switch image smoothly
    const targetImage = getColourImage(p, chosenColour, colourIndex);
    if (targetImage) {
      const img = card.querySelector(".product-image img");
      if (img && img.src !== targetImage) {
        img.style.transition = "opacity 0.25s ease";
        img.style.opacity = "0.4";
        img.src = targetImage;
        img.onload = () => { img.style.opacity = "1"; };
        setTimeout(() => { img.style.opacity = "1"; }, 300);
      }
    }
    return;
  }

  // 2. Buy Now button on the card:
  const buyBtn = e.target.closest("[data-buy]");
  if (buyBtn) {
    const p = products.find(item => item.id === buyBtn.dataset.buy);
    if (!p) return;
    const card = buyBtn.closest(".product-card");
    const colour = card?.dataset?.selectedColour || p.colours?.[0] || "Standard";
    openCheckoutModal(p.id, colour);
    return;
  }

  // 3. WhatsApp buy button on the card:
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) {
    const p = products.find(item => item.id === addBtn.dataset.add);
    if (!p) return;
    const card = addBtn.closest(".product-card");
    const colour = card?.dataset?.selectedColour || p.colours?.[0] || "Standard";
    const categoryStr = p.category ? ` [${p.category}]` : "";
    const message = encodeURIComponent(`Hello SALORIYA! I'd like to order:\nProduct: ${p.name}${categoryStr}\nColour: ${colour}\nPrice shown: ${money(p.price_paise)}\nPlease confirm availability and delivery details.`);
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
    return;
  }

  // If clicking inside colour select or label, do not open modal
  if (e.target.closest(".colour-select") || e.target.closest(".colour-label")) {
    return;
  }

  // 4. If clicking on image, title, card or quick view badge: open Amazon / Flipkart style preview modal
  const card = e.target.closest(".product-card");
  if (card) {
    const currentColour = card.dataset.selectedColour || "";
    openProductModal(card.dataset.productId, currentColour);
  }
});

/* Amazon / Flipkart Style Product Detail Modal Functionality */
function openProductModal(productId, defaultColour = "") {
  const p = products.find(x => x.id === productId);
  if (!p || !modal || !modalContent) return;

  currentModalProductId = productId;
  let selectedColour = defaultColour || p.colours?.[0] || "";
  const allImages = (p.image_urls && p.image_urls.length > 0) ? p.image_urls : [];
  let activeImage = getColourImage(p, selectedColour, 0) || (allImages[0] || "");

  const categoryName = p.category || "GOLD COVERING";
  const stockStatus = p.stock <= 0 
    ? '<span class="modal-stock-badge out-of-stock">Currently Out of Stock</span>'
    : '<span class="modal-stock-badge in-stock">✓ Ready to Wear / In Stock</span>';

  // Colour pills markup
  const colourPills = (p.colours || []).map((c, i) => {
    const isSelected = c.toLowerCase() === selectedColour.toLowerCase();
    return `<button type="button" class="modal-colour-pill ${isSelected ? 'active' : ''}" data-colour="${escapeHtml(c)}" data-index="${i}">${escapeHtml(c)}</button>`;
  }).join("");

  // Thumbnail images markup with index for two-way synchronization
  const thumbsHtml = allImages.length > 1 ? allImages.map((url, i) => {
    const isActive = url === activeImage;
    return `<button type="button" class="modal-thumb ${isActive ? 'active' : ''}" data-thumb-url="${escapeHtml(url)}" data-thumb-index="${i}" aria-label="View photo ${i+1}">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(p.name)} - photo ${i+1}" />
    </button>`;
  }).join("") : "";

  modalContent.innerHTML = `
    <div class="modal-grid">
      <!-- Left Column: Gallery & Interactive Zoom Lens -->
      <div class="modal-gallery">
        <div class="modal-main-image-wrap" id="modal-image-wrap" title="Hover to inspect fine details">
          ${activeImage 
            ? `<img id="modal-main-img" class="modal-main-img" src="${escapeHtml(activeImage)}" alt="${escapeHtml(p.name)}" />`
            : `<div class="image-placeholder"><span>S</span><small>READY TO WEAR</small></div>`
          }
          <div class="modal-zoom-hint"><span>🔍 Hover to Zoom</span></div>
        </div>
        ${thumbsHtml ? `<div class="modal-thumbs" id="modal-thumbs">${thumbsHtml}</div>` : ""}
      </div>

      <!-- Right Column: Flipkart / Amazon Style Details -->
      <div class="modal-details">
        <div class="modal-breadcrumb">
          <span>SALORIYA</span> &rsaquo; <span>JEWELLERY</span> &rsaquo; <span class="modal-category">${escapeHtml(categoryName)}</span>
        </div>

        <h2 class="modal-title">${escapeHtml(p.name)}</h2>

        <div class="modal-rating-row">
          <div class="modal-stars">★★★★★</div>
          <span class="modal-rating-text">4.9 / 5 · Handcrafted Polish</span>
          <span class="modal-verified-pill">✦ Boutique Quality</span>
        </div>

        <div class="modal-price-box">
          <div class="modal-price-line">
            <span class="modal-price">${money(p.price_paise)}</span>
            <span class="modal-tax-tag">Inclusive of all taxes</span>
          </div>
          ${stockStatus}
          <div class="modal-tagline">✨ Direct artisan craft · Tarnish-resistant coating · Instant dispatch</div>
        </div>

        ${(p.colours && p.colours.length > 0) ? `
          <div class="modal-option-block">
            <label class="modal-option-label">Select Colour / Variant: <strong id="modal-chosen-colour">${escapeHtml(selectedColour)}</strong></label>
            <div class="modal-colour-pills" id="modal-colour-pills">${colourPills}</div>
          </div>
        ` : ""}

        <!-- Product Highlights (Amazon / Flipkart Spec List) -->
        <div class="modal-highlights">
          <h4 class="modal-section-title">Product Highlights</h4>
          <ul class="modal-spec-list">
            <li><strong>Craft &amp; Style:</strong> Premium 1-Gram Gold Covering &amp; Readymade Jewellery</li>
            <li><strong>Coating:</strong> Long-lasting micro-gold finish with protective tarnish barrier</li>
            <li><strong>Skin Comfort:</strong> 100% Nickel-free, lead-free &amp; hypoallergenic daily wear</li>
            <li><strong>Packaging:</strong> Safely secured in protective jewellery-grade box</li>
            <li><strong>Occasion:</strong> Perfect for festive, wedding, temple &amp; everyday elegance</li>
          </ul>
        </div>

        <!-- Description -->
        <div class="modal-description-section">
          <h4 class="modal-section-title">About this piece</h4>
          <p class="modal-description-text">${escapeHtml(p.description || "Designed with meticulous attention to detail, this SALORIYA piece captures the authentic grandeur of heirloom gold jewellery in a lightweight, ready-to-wear silhouette.")}</p>
        </div>

        <!-- Order & Enquiries Actions -->
        <div class="modal-actions">
          <button type="button" class="modal-buy-direct-btn" id="modal-buy-button" ${p.stock <= 0 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <span>${p.stock <= 0 ? "Unavailable" : "Order Now "}</span>
          </button>
          <button type="button" class="modal-wa-btn" id="modal-order-button" ${p.stock <= 0 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z"/>
            </svg>
            <span>WhatsApp </span>
          </button>
        </div>
        <button type="button" class="modal-query-link" id="modal-query-btn">
          Need custom sizing or have questions? Chat with our stylist 
        </button>

        <!-- Trust Bar -->
        <div class="modal-trust-bar">
          <div class="trust-item"><span></span> Authentic Finish</div>
          <div class="trust-item"><span></span> Direct Dispatch</div>
          <div class="trust-item"><span></span> Verified Quality</div>
        </div>
      </div>
    </div>
  `;

  // Setup Image Zoom Lens (Like Amazon/Flipkart inspect view)
  const imageWrap = modalContent.querySelector("#modal-image-wrap");
  const mainImg = modalContent.querySelector("#modal-main-img");
  if (imageWrap && mainImg) {
    imageWrap.addEventListener("mousemove", e => {
      const rect = imageWrap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      mainImg.style.transformOrigin = `${x.toFixed(1)}% ${y.toFixed(1)}%`;
      mainImg.style.transform = "scale(1.9)";
    });
    imageWrap.addEventListener("mouseleave", () => {
      mainImg.style.transformOrigin = "center center";
      mainImg.style.transform = "scale(1)";
    });
  }

  // Setup Thumbnail Clicks with TWO-WAY COLOUR HIGHLIGHTING
  const thumbsContainer = modalContent.querySelector("#modal-thumbs");
  const colourPillsContainer = modalContent.querySelector("#modal-colour-pills");
  const chosenColourLabel = modalContent.querySelector("#modal-chosen-colour");

  if (thumbsContainer) {
    thumbsContainer.addEventListener("click", e => {
      const btn = e.target.closest("[data-thumb-url]");
      if (!btn || !mainImg) return;
      const clickedUrl = btn.dataset.thumbUrl;
      const thumbIndex = Number(btn.dataset.thumbIndex);

      // 1. Highlight active thumbnail
      thumbsContainer.querySelectorAll(".modal-thumb").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");

      // 2. Smoothly switch main photo
      mainImg.style.transition = "opacity 0.2s ease";
      mainImg.style.opacity = "0.4";
      mainImg.src = clickedUrl;
      mainImg.onload = () => { mainImg.style.opacity = "1"; };
      setTimeout(() => { mainImg.style.opacity = "1"; }, 250);

      // 3. TWO-WAY SYNC: Determine matching colour for this image and update highlight & name!
      if (p.colours && p.colours.length > 0) {
        let matchedColour = null;
        const decodedUrl = decodeURIComponent(clickedUrl).toLowerCase();

        // 3a. Match URL substring with colour name
        for (const c of p.colours) {
          if (decodedUrl.includes(c.toLowerCase().trim())) {
            matchedColour = c;
            break;
          }
        }

        // 3b. Fallback to index mapping (1st photo for 1st colour, etc.)
        if (!matchedColour && !Number.isNaN(thumbIndex) && thumbIndex >= 0 && thumbIndex < p.colours.length) {
          matchedColour = p.colours[thumbIndex];
        }

        // 3c. Update the colour selection and highlight in the modal!
        if (matchedColour) {
          selectedColour = matchedColour;
          if (chosenColourLabel) {
            chosenColourLabel.textContent = selectedColour;
          }
          if (colourPillsContainer) {
            colourPillsContainer.querySelectorAll(".modal-colour-pill").forEach(pill => {
              const isMatch = pill.dataset.colour.toLowerCase().trim() === selectedColour.toLowerCase().trim();
              pill.classList.toggle("active", isMatch);
            });
          }

          // Also sync storefront card in background
          const card = grid.querySelector(`.product-card[data-product-id="${CSS.escape(p.id)}"]`);
          if (card) {
            card.dataset.selectedColour = selectedColour;
            card.querySelectorAll(".card-colour-swatch").forEach(sw => {
              sw.classList.toggle("active", sw.dataset.colour.toLowerCase().trim() === selectedColour.toLowerCase().trim());
            });
          }
        }
      }
    });
  }

  // Setup Colour Variant Clicks (Switches colour & matching image)
  if (colourPillsContainer) {
    colourPillsContainer.addEventListener("click", e => {
      const pill = e.target.closest("[data-colour]");
      if (!pill) return;
      colourPillsContainer.querySelectorAll(".modal-colour-pill").forEach(b => b.classList.remove("active"));
      pill.classList.add("active");
      selectedColour = pill.dataset.colour;
      if (chosenColourLabel) chosenColourLabel.textContent = selectedColour;

      // Sync matching image for that colour
      const targetImage = getColourImage(p, selectedColour, Number(pill.dataset.index));
      if (targetImage && mainImg && mainImg.src !== targetImage) {
        mainImg.style.transition = "opacity 0.2s ease";
        mainImg.style.opacity = "0.4";
        mainImg.src = targetImage;
        mainImg.onload = () => { mainImg.style.opacity = "1"; };
        setTimeout(() => { mainImg.style.opacity = "1"; }, 250);

        // Highlight matching thumbnail if present
        if (thumbsContainer) {
          thumbsContainer.querySelectorAll(".modal-thumb").forEach(t => {
            t.classList.toggle("active", t.dataset.thumbUrl === targetImage);
          });
        }
      }

      // Also sync the storefront card dropdown in background
      const card = grid.querySelector(`.product-card[data-product-id="${CSS.escape(p.id)}"]`);
      if (card) {
        card.dataset.selectedColour = selectedColour;
        card.querySelectorAll(".card-colour-swatch").forEach(sw => {
          sw.classList.toggle("active", sw.dataset.colour.toLowerCase().trim() === selectedColour.toLowerCase().trim());
        });
      }
    });
  }

  // Setup Direct Checkout Buy Now Button from Modal
  const buyDirectBtn = modalContent.querySelector("#modal-buy-button");
  if (buyDirectBtn) {
    buyDirectBtn.addEventListener("click", () => {
      closeProductModal();
      openCheckoutModal(productId, selectedColour);
    });
  }

  // Setup WhatsApp Order from Modal
  const orderBtn = modalContent.querySelector("#modal-order-button");
  if (orderBtn) {
    orderBtn.addEventListener("click", () => {
      const categoryStr = p.category ? ` [${p.category}]` : "";
      const message = encodeURIComponent(`Hello SALORIYA! I'd like to order from your website:\nProduct: ${p.name}${categoryStr}\nColour/Style: ${selectedColour || "Standard"}\nPrice shown: ${money(p.price_paise)}\nPlease confirm availability and payment/delivery details.`);
      window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
    });
  }

  // Setup Custom Query from Modal
  const queryBtn = modalContent.querySelector("#modal-query-btn");
  if (queryBtn) {
    queryBtn.addEventListener("click", () => {
      const categoryStr = p.category ? ` [${p.category}]` : "";
      const message = encodeURIComponent(`Hello SALORIYA! I have a question about ${p.name}${categoryStr}:\nCould you please help me with sizing/custom options?`);
      window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
    });
  }

  // Display Modal & Lock Body Scroll
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  currentModalProductId = null;
}

/* ==========================================================================
   CUSTOMER EXPRESS CHECKOUT MODAL & ORDER PLACEMENT
   ========================================================================== */

const checkoutModal = document.querySelector("#checkout-modal");
const checkoutContent = document.querySelector("#checkout-modal-content");

function openCheckoutModal(productId, initialColour = "") {
  const p = products.find(x => x.id === productId);
  if (!p || !checkoutModal || !checkoutContent) return;

  let chosenColour = initialColour || p.colours?.[0] || "Standard";
  let qty = 1;
  const maxStock = Math.max(1, p.stock || 1);
  const imgUrl = getColourImage(p, chosenColour, 0) || p.image_urls?.[0] || "";

  const TRANSPORT_FEE_PAISE = 5000; // Flat ₹50.00 Delivery & Transport Fee

  // Secure Phone OTP Verification State
  let isPhoneVerified = false;
  let verifiedPhone = "";
  let phoneVerificationToken = "";
  let otpCooldown = 0;
  let otpTimerInterval = null;

  // Promo Code State for Free Delivery
  let appliedPromo = null; // { code: "FREEDELIVERY", discountType: "free_delivery", discountPaise: 5000 }

  function renderCheckout() {
    const subtotalPaise = p.price_paise * qty;
    const deliveryFeePaise = appliedPromo ? 0 : TRANSPORT_FEE_PAISE;
    const totalPaise = subtotalPaise + deliveryFeePaise;

    checkoutContent.innerHTML = `
      <div class="checkout-header">
        <p class="eyebrow">EXPRESS CHECKOUT</p>
        <h3>Complete Your Order</h3>
      </div>

      <div class="checkout-product-summary">
        <div class="checkout-thumb">
          ${imgUrl ? `<img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" />` : "S"}
        </div>
        <div class="checkout-product-details">
          <span class="checkout-product-title">${escapeHtml(p.name)}</span>
          <span class="checkout-product-variant">Colour: <strong>${escapeHtml(chosenColour)}</strong></span>
          <span class="modal-price" style="font-size:16px;">${money(p.price_paise)} each</span>
          <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
            <label style="font-size:11px;color:var(--muted);font-weight:600;">Quantity:</label>
            <div class="checkout-qty-stepper">
              <button type="button" id="chk-qty-minus" ${qty <= 1 ? "disabled" : ""}>−</button>
              <span id="chk-qty-val">${qty}</span>
              <button type="button" id="chk-qty-plus" ${qty >= maxStock ? "disabled" : ""}>+</button>
            </div>
            ${p.stock <= 3 ? `<small style="color:#d97706;font-size:10px;">Only ${p.stock} left in stock</small>` : ""}
          </div>
        </div>
      </div>

      <form id="storefront-checkout-form" class="admin-form" style="display:flex;flex-direction:column;gap:12px;">
        <div class="form-row">
          <label>Full Name *
            <input name="customerName" required placeholder="e.g. Ananya Krishnan" />
          </label>
          <label>Mobile Phone (10 Digits) *
            <div class="phone-input-group">
              <span class="phone-prefix-tag">+91</span>
              <input 
                type="tel" 
                name="phone" 
                id="checkout-phone" 
                required 
                maxlength="10" 
                inputmode="numeric" 
                pattern="[6-9][0-9]{9}" 
                placeholder="10-digit mobile number" 
                autocomplete="tel"
                value="${verifiedPhone || ''}"
                ${isPhoneVerified ? 'readonly' : ''}
              />
              ${isPhoneVerified ? `
                <span class="phone-verified-pill">✓ Verified</span>
                <button type="button" id="btn-change-phone" class="phone-change-btn">Change</button>
              ` : `
                <button type="button" id="btn-send-otp-trigger" class="btn-verify-trigger">
                  Verify ⚡
                </button>
              `}
            </div>
            <!-- Anti-bot honeypot field -->
            <input type="text" name="honeypot" id="checkout-honeypot" style="display:none !important;" tabindex="-1" autocomplete="off" />
          </label>
        </div>

        <!-- Drop-in Phone OTP Verification Panel -->
        <div id="otp-verification-panel" class="otp-box-anim" style="display:none;">
          <div class="otp-panel-header">
            <strong class="otp-panel-title">
              🔒 Mobile Number Verification
            </strong>
            <span id="otp-timer-display" class="otp-timer-pill"></span>
          </div>
          <p class="otp-panel-desc">
            We sent a 6-digit confirmation code to <strong id="otp-phone-display" style="color:var(--ink);"></strong> to confirm your order and prevent fake bookings.
          </p>
          <div class="otp-panel-inputs-row">
            <input 
              type="text" 
              id="otp-input-code" 
              maxlength="6" 
              inputmode="numeric" 
              placeholder="••••••" 
              class="otp-digit-input"
            />
            <button type="button" id="btn-verify-otp-submit" class="btn-otp-verify">
              Verify Code ✓
            </button>
            <button type="button" id="btn-resend-otp" class="btn-otp-resend" disabled>
              Resend OTP
            </button>
          </div>
          <p id="otp-status-msg" class="otp-status-text"></p>
        </div>

        <label>Shipping / Delivery Address *
          <textarea name="street" rows="2" required placeholder="House/Flat No, Street, Landmark"></textarea>
        </label>

        <div class="form-row form-row-city-state-pin">
          <label>City *
            <input name="city" required placeholder="Chennai" />
          </label>
          <label>State *
            <input name="state" required value="Tamil Nadu" />
          </label>
          <label>PIN Code *
            <input name="pincode" required placeholder="600001" maxlength="6" pattern="[0-9]{6}" />
          </label>
        </div>

        <div class="form-row">
          <label>Payment Method
            <select name="paymentMethod" id="checkout-payment-method" required>
              <option value="cod">Cash on Delivery (COD)</option>
              <option value="prepaid">Instant Online Payment (UPI / QR / GPay / PhonePe)</option>
            </select>
          </label>
          <div style="display:flex;flex-direction:column;justify-content:center;font-size:11px;color:var(--muted);padding-top:14px;" id="checkout-payment-hint">
            <span>✓ Pay securely upon courier delivery</span>
            <span>✓ Verified boutique tamper-proof packaging</span>
          </div>
        </div>

        <!-- Promo Code Input / Applied Voucher -->
        <div class="checkout-promo-box">
          ${appliedPromo ? `
            <div class="checkout-promo-applied">
              <div class="checkout-promo-applied-left">
                <span class="checkout-promo-icon">🏷️</span>
                <div class="checkout-promo-meta">
                  <div class="checkout-promo-code-title">
                    <strong>${escapeHtml(appliedPromo.code)}</strong>
                    <span class="checkout-promo-badge">PROMO APPLIED</span>
                  </div>
                  <div class="checkout-promo-benefit">✓ Free Delivery Waived (₹50.00 saved!)</div>
                </div>
              </div>
              <button type="button" id="btn-remove-promo" class="checkout-promo-remove-btn" title="Remove promo code">
                Remove
              </button>
            </div>
          ` : `
            <label class="checkout-promo-label">Have a Promo Code for Free Delivery?</label>
            <div class="checkout-promo-input-row">
              <div class="checkout-promo-input-wrap">
                <span class="checkout-promo-prefix-icon">🏷️</span>
                <input 
                  type="text" 
                  id="promo-code-input" 
                  placeholder="Enter promo code" 
                  autocomplete="off"
                  spellcheck="false"
                />
              </div>
              <button type="button" id="btn-apply-promo" class="checkout-promo-apply-btn">
                Apply
              </button>
            </div>
            <p id="promo-code-msg" class="checkout-promo-feedback"></p>
          `}
        </div>

        <div class="checkout-price-breakdown">
          <div class="checkout-line">
            <span>Item Subtotal (${qty} piece${qty > 1 ? 's' : ''}):</span>
            <strong>${money(subtotalPaise)}</strong>
          </div>
          <div class="checkout-line">
            <span>Insured Courier &amp; Transport Fee:</span>
            ${appliedPromo ? `
              <div>
                <span style="text-decoration:line-through;color:var(--muted);font-size:11px;margin-right:6px;">₹50.00</span>
                <strong style="color:#15803d;font-weight:700;">FREE ✓</strong>
              </div>
            ` : `
              <strong style="color:var(--wine-dark);font-weight:700;">+ ₹50.00</strong>
            `}
          </div>
          <div class="checkout-total-line">
            <span>Total Payable:</span>
            <span>${money(totalPaise)}</span>
          </div>
        </div>

        <button type="submit" id="checkout-submit-btn" class="button button-gold" style="padding:14px;font-size:13px;width:100%;letter-spacing:0.5px;">
          Confirm &amp; Place Order (${money(totalPaise)}) 
        </button>

        <p class="form-message" id="checkout-message" role="status"></p>
      </form>
    `;

    // Dynamic payment method label/hint update
    const paymentMethodSelect = checkoutContent.querySelector("#checkout-payment-method");
    const paymentHint = checkoutContent.querySelector("#checkout-payment-hint");
    const submitBtn = checkoutContent.querySelector("#checkout-submit-btn");

    paymentMethodSelect?.addEventListener("change", () => {
      if (paymentMethodSelect.value === "prepaid") {
        paymentHint.innerHTML = `
          <span style="color:var(--wine);font-weight:600;">⚡ Instant Online Payment: Scan UPI QR or Pay via GPay/PhonePe</span>
          <span>✓ Order placed ONLY after authentic UTR &amp; payment verification</span>
        `;
        submitBtn.textContent = `Proceed to Online Payment (${money(totalPaise)}) 💳`;
      } else {
        paymentHint.innerHTML = `
          <span>✓ Pay securely upon courier delivery</span>
          <span>✓ Verified boutique tamper-proof packaging</span>
        `;
        submitBtn.textContent = `Confirm &amp; Place Order (${money(totalPaise)}) `;
      }
    });

    // Bind quantity buttons
    checkoutContent.querySelector("#chk-qty-minus")?.addEventListener("click", () => {
      if (qty > 1) {
        qty--;
        renderCheckout();
      }
    });

    checkoutContent.querySelector("#chk-qty-plus")?.addEventListener("click", () => {
      if (qty < maxStock) {
        qty++;
        renderCheckout();
      }
    });

    // Form and status elements
    const form = checkoutContent.querySelector("#storefront-checkout-form");
    const msg = checkoutContent.querySelector("#checkout-message");

    // Phone input restriction: strictly 10 digits
    const phoneInput = checkoutContent.querySelector("#checkout-phone");
    phoneInput?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
    });

    // Promo Code Application
    const promoInput = checkoutContent.querySelector("#promo-code-input");
    const applyPromoBtn = checkoutContent.querySelector("#btn-apply-promo");
    const promoMsg = checkoutContent.querySelector("#promo-code-msg");
    const removePromoBtn = checkoutContent.querySelector("#btn-remove-promo");

    applyPromoBtn?.addEventListener("click", async () => {
      const code = (promoInput?.value || "").trim().toUpperCase();
      if (!code) {
        if (promoMsg) {
          promoMsg.textContent = "Please enter a promo code.";
          promoMsg.style.color = "#dc2626";
          promoMsg.style.display = "block";
        }
        return;
      }

      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = "Checking…";

      let matchedPromo = null;

      // 1. Check Supabase promo_codes table
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase
            .from("promo_codes")
            .select("*")
            .ilike("code", code)
            .eq("is_active", true)
            .limit(1);
          if (!error && Array.isArray(data) && data.length > 0) {
            matchedPromo = {
              ...data[0],
              amount: parseFloat(data[0].discount_value ?? data[0].amount ?? 50)
            };
          }
        } catch (e) {
          console.warn("Supabase promo check fallback:", e);
        }
      }

      // 2. Check local storage
      if (!matchedPromo) {
        try {
          const localPromos = JSON.parse(localStorage.getItem("saloriya_admin_promo_codes") || "[]");
          const item = localPromos.find(p => p.code.toUpperCase() === code && p.is_active);
          if (item) {
            matchedPromo = {
              ...item,
              amount: parseFloat(item.discount_value ?? item.amount ?? 50)
            };
          }
        } catch (e) {
          // ignore
        }
      }

      // 3. Fallback for default FREEDELIVERY if not deleted
      const deletedCodes = (() => {
        try {
          return JSON.parse(localStorage.getItem("saloriya_deleted_promo_codes") || "[]");
        } catch (e) {
          return [];
        }
      })();

      if (!matchedPromo && code === "FREEDELIVERY" && !deletedCodes.includes("FREEDELIVERY")) {
        matchedPromo = {
          code: "FREEDELIVERY",
          discount_type: "free_delivery",
          discount_value: 50,
          amount: 50,
          description: "Free Delivery"
        };
      }

      if (deletedCodes.includes(code)) {
        matchedPromo = null;
      }

      if (matchedPromo) {
        const val = parseFloat(matchedPromo.discount_value ?? matchedPromo.amount ?? 50);
        const dtype = String(matchedPromo.discount_type || "").toLowerCase().trim();
        let discountPaise = 5000;
        let dType = "fixed_amount";
        if (dtype === "free_delivery" || dtype.includes("free") || dtype.includes("delivery")) {
          dType = "free_delivery";
          discountPaise = 5000;
        } else if (dtype === "percentage" || dtype.includes("percent")) {
          dType = "percentage";
          discountPaise = Math.round(subtotalPaise * (val / 100));
        } else {
          dType = "fixed_amount";
          discountPaise = Math.round(val * 100);
        }

        appliedPromo = {
          code: matchedPromo.code.toUpperCase(),
          discountType: dType,
          discountPaise: discountPaise,
          amount: val,
          description: matchedPromo.description || "Promo Discount"
        };
        renderCheckout();
      } else {
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = "Apply";
        if (promoMsg) {
          promoMsg.textContent = `Promo code "${code}" is invalid or inactive.`;
          promoMsg.style.color = "#dc2626";
          promoMsg.style.display = "block";
        }
      }
    });

    promoInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applyPromoBtn?.click();
      }
    });

    phoneInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !isPhoneVerified) {
        e.preventDefault();
        btnSendOtpTrigger?.click();
      }
    });

    removePromoBtn?.addEventListener("click", () => {
      appliedPromo = null;
      renderCheckout();
    });

    // OTP Elements
    const otpPanel = checkoutContent.querySelector("#otp-verification-panel");
    const otpInput = checkoutContent.querySelector("#otp-input-code");
    const otpTimerDisplay = checkoutContent.querySelector("#otp-timer-display");
    const otpStatusMsg = checkoutContent.querySelector("#otp-status-msg");
    const otpPhoneDisplay = checkoutContent.querySelector("#otp-phone-display");
    const btnSendOtpTrigger = checkoutContent.querySelector("#btn-send-otp-trigger");
    const btnVerifyOtpSubmit = checkoutContent.querySelector("#btn-verify-otp-submit");
    const btnResendOtp = checkoutContent.querySelector("#btn-resend-otp");
    const btnChangePhone = checkoutContent.querySelector("#btn-change-phone");

    // Restrict OTP input to 6 digits numeric and Enter key to verify
    otpInput?.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6);
    });
    otpInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        btnVerifyOtpSubmit?.click();
      }
    });

    // Change phone button handler
    btnChangePhone?.addEventListener("click", () => {
      isPhoneVerified = false;
      verifiedPhone = "";
      phoneVerificationToken = "";
      if (otpTimerInterval) clearInterval(otpTimerInterval);
      renderCheckout();
    });

    // Countdown Timer Helper
    function startOtpCountdown(seconds = 60) {
      if (otpTimerInterval) clearInterval(otpTimerInterval);
      otpCooldown = seconds;
      if (btnResendOtp) btnResendOtp.disabled = true;

      const updateTimer = () => {
        if (otpCooldown <= 0) {
          clearInterval(otpTimerInterval);
          if (otpTimerDisplay) otpTimerDisplay.textContent = "";
          if (btnResendOtp) btnResendOtp.disabled = false;
        } else {
          const mins = String(Math.floor(otpCooldown / 60)).padStart(2, "0");
          const secs = String(otpCooldown % 60).padStart(2, "0");
          if (otpTimerDisplay) otpTimerDisplay.textContent = `Resend in ${mins}:${secs}`;
          otpCooldown--;
        }
      };
      updateTimer();
      otpTimerInterval = setInterval(updateTimer, 1000);
    }

    let lastPhoneOtpSessionToken = "";

    // Send OTP function
    async function triggerSendOtp() {
      const rawPhone = phoneInput?.value || "";
      const cleanPhone = rawPhone.replace(/\D/g, "").slice(0, 10);
      const honeypot = checkoutContent.querySelector("#checkout-honeypot")?.value || "";

      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        if (msg) {
          msg.textContent = "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).";
          msg.classList.add("error");
        }
        phoneInput?.focus();
        return false;
      }

      if (btnSendOtpTrigger) {
        btnSendOtpTrigger.disabled = true;
        btnSendOtpTrigger.textContent = "Sending…";
      }
      if (otpStatusMsg) {
        otpStatusMsg.textContent = "Sending OTP to your phone…";
        otpStatusMsg.style.color = "var(--muted)";
      }

      try {
        const res = await fetch("/api/otp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: cleanPhone, honeypot })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to send OTP.");
        }

        lastPhoneOtpSessionToken = data.sessionToken || "";

        if (otpPanel) {
          otpPanel.style.display = "block";
          setTimeout(() => {
            otpPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }, 50);
        }
        if (otpPhoneDisplay) otpPhoneDisplay.textContent = `+91 ${cleanPhone}`;

        if (data.testOtp) {
          if (otpInput) otpInput.value = data.testOtp;
          if (otpStatusMsg) {
            if (data.smsSent) {
              otpStatusMsg.innerHTML = `✓ 6-digit verification code sent to +91 ${cleanPhone} via SMS. (Test auto-fill: <strong>${data.testOtp}</strong>)`;
              otpStatusMsg.style.color = "#166534";
            } else {
              otpStatusMsg.innerHTML = `
                <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:8px 10px;color:#92400e;font-size:12px;line-height:1.45;margin-bottom:6px;">
                  ⚡ <strong>Fast2SMS Account Notice:</strong> ${escapeHtml(data.gatewayError || "Fast2SMS website verification is pending on fast2sms.com")}.<br>
                  For instant testing, your OTP code is: <strong style="font-size:15px;color:#b45309;letter-spacing:2px;">${escapeHtml(data.testOtp)}</strong> (Auto-filled below).
                </div>
              `;
            }
          }
        } else {
          if (otpStatusMsg) {
            otpStatusMsg.textContent = `✓ 6-digit verification code sent to +91 ${cleanPhone}. Please check your SMS messages.`;
            otpStatusMsg.style.color = "#166534";
          }
        }

        startOtpCountdown(data.cooldown || 60);
        otpInput?.focus();
        if (btnSendOtpTrigger) btnSendOtpTrigger.textContent = "Sent ✓";
        return true;
      } catch (err) {
        console.warn("OTP send error:", err);
        if (otpStatusMsg) {
          otpStatusMsg.textContent = err.message || "Failed to send OTP. Please check your phone number.";
          otpStatusMsg.style.color = "#dc2626";
        }
        if (btnSendOtpTrigger) {
          btnSendOtpTrigger.disabled = false;
          btnSendOtpTrigger.textContent = "Verify ⚡";
        }
        return false;
      }
    }

    // Verify OTP function
    async function triggerVerifyOtp() {
      const rawPhone = phoneInput?.value || "";
      const cleanPhone = rawPhone.replace(/\D/g, "").slice(0, 10);
      const otpCode = (otpInput?.value || "").trim();

      if (!/^\d{6}$/.test(otpCode)) {
        if (otpStatusMsg) {
          otpStatusMsg.textContent = "Please enter the complete 6-digit numeric OTP.";
          otpStatusMsg.style.color = "#dc2626";
        }
        otpInput?.focus();
        return;
      }

      if (btnVerifyOtpSubmit) {
        btnVerifyOtpSubmit.disabled = true;
        btnVerifyOtpSubmit.textContent = "Verifying…";
      }

      try {
        const res = await fetch("/api/otp/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: cleanPhone,
            otp: otpCode,
            sessionToken: lastPhoneOtpSessionToken
          })
        });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Incorrect OTP. Please try again.");
        }

        // Verified successfully!
        isPhoneVerified = true;
        verifiedPhone = cleanPhone;
        phoneVerificationToken = data.token || `verified_${Date.now()}`;
        if (otpTimerInterval) clearInterval(otpTimerInterval);

        renderCheckout();
      } catch (err) {
        console.warn("OTP verify error:", err);
        if (otpStatusMsg) {
          otpStatusMsg.textContent = err.message || "Invalid OTP code. Please check and try again.";
          otpStatusMsg.style.color = "#dc2626";
        }
        if (btnVerifyOtpSubmit) {
          btnVerifyOtpSubmit.disabled = false;
          btnVerifyOtpSubmit.textContent = "Verify Code ✓";
        }
      }
    }

    btnSendOtpTrigger?.addEventListener("click", triggerSendOtp);
    btnResendOtp?.addEventListener("click", triggerSendOtp);
    btnVerifyOtpSubmit?.addEventListener("click", triggerVerifyOtp);

    // Form submission
    form?.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const customerName = String(fd.get("customerName") || "").trim();
      const phoneRaw = String(fd.get("phone") || "").trim();
      const phone = phoneRaw.replace(/\D/g, "").slice(0, 10);
      const street = String(fd.get("street") || "").trim();
      const city = String(fd.get("city") || "").trim();
      const state = String(fd.get("state") || "Tamil Nadu").trim();
      const pincode = String(fd.get("pincode") || "").trim();
      const paymentMethod = String(fd.get("paymentMethod") || "cod");

      // Phone Validation: Must be strictly 10 digits
      if (!/^[6-9]\d{9}$/.test(phone)) {
        msg.textContent = "Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).";
        msg.classList.add("error");
        phoneInput?.focus();
        return;
      }

      // Mandatory OTP Verification Check
      if (!isPhoneVerified) {
        msg.textContent = "⚠️ Please verify your 10-digit mobile number with the OTP code before placing your order.";
        msg.classList.add("error");
        await triggerSendOtp();
        return;
      }

      const orderData = { 
        customerName, 
        phone, 
        street, 
        city, 
        state, 
        pincode, 
        subtotalPaise, 
        totalPaise, 
        qty, 
        chosenColour, 
        phoneVerificationToken,
        promoCode: appliedPromo ? appliedPromo.code : null,
        discountPaise: appliedPromo ? 5000 : 0
      };

      // IF ONLINE / PREPAID: DO NOT PLACE ORDER YET!
      // Customer must complete payment and enter genuine 12-digit UTR first!
      if (paymentMethod === "prepaid") {
        showOnlinePaymentPortal(orderData);
        return;
      }

      // COD order: Admin confirmation is ONLY for online payment. COD is confirmed directly upon placing order and stock is deducted immediately!
      msg.textContent = "Placing your COD order…";
      msg.classList.remove("error");

      const orderIdKey = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `cod_${Date.now()}`;
      const shortId = orderIdKey.slice(0, 8).toUpperCase();

      // Deduct stock immediately for COD order
      try {
        const currentStock = Number(p.stock) || 0;
        const newStock = Math.max(0, currentStock - qty);
        p.stock = newStock;
        await supabase
          .from("products")
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq("id", p.id);
      } catch (stockErr) {
        console.warn("Stock deduction warning for COD order:", stockErr);
      }

      try {
        const { error: orderErr } = await supabase
          .from("orders")
          .insert({
            id: orderIdKey,
            customer_name: customerName,
            phone,
            address: { 
              street, 
              city, 
              state, 
              pincode, 
              transport_fee_paise: deliveryFeePaise, 
              phone_verified: true,
              promo_code: appliedPromo ? appliedPromo.code : null,
              discount_paise: appliedPromo ? 5000 : 0
            },
            payment_method: "cod",
            payment_status: "pending",
            order_status: "confirmed",
            total_paise: totalPaise,
            promo_code: appliedPromo ? appliedPromo.code : null
          });

        if (orderErr) {
          console.warn("Direct order insert note (RLS):", orderErr.message);
        } else {
          // Insert line item in Supabase
          try {
            await supabase
              .from("order_items")
              .insert({
                order_id: orderIdKey,
                product_id: p.id,
                product_name: p.name,
                colour: chosenColour,
                quantity: qty,
                unit_price_paise: p.price_paise
              });
          } catch (itemErr) {
            console.warn("order_items insert warning:", itemErr);
          }
        }

        saveLocalOrder({
          id: orderIdKey,
          customer_name: customerName,
          phone,
          address: { street, city, state, pincode, transport_fee_paise: TRANSPORT_FEE_PAISE, phone_verified: true },
          payment_method: "cod",
          payment_status: "pending",
          order_status: "confirmed",
          total_paise: totalPaise,
          created_at: new Date().toISOString()
        }, {
          order_id: orderIdKey,
          product_id: p.id,
          product_name: p.name,
          colour: chosenColour,
          quantity: qty,
          unit_price_paise: p.price_paise
        });

        // Dispatch Email Notification to Saloriyaofficial@gmail.com
        sendOrderEmailNotification({
          orderId: shortId,
          customerName,
          phone,
          address: `${street}, ${city}, ${state} - ${pincode}`,
          productName: p.name,
          colour: chosenColour,
          quantity: qty,
          totalAmount: money(totalPaise),
          paymentMethod: "cod",
          hasScreenshot: false
        });

        showOrderSuccessScreen(orderIdKey, p, chosenColour, qty, totalPaise, customerName, phone, `${street}, ${city}, ${state} - ${pincode}`, "cod", "confirmed");
      } catch (err) {
        console.error("Order error:", err);
        msg.textContent = "Something went wrong. Please order via WhatsApp.";
        msg.classList.add("error");
      }
    });
  }

  // Luxury Online Payment Gateway Interface with Reliable Multi-App Mobile Redirection
  function showOnlinePaymentPortal(orderData) {
    const amountInRupees = (orderData.totalPaise / 100).toFixed(2);
    const upiId = "gambusaigowtham-3@oksbi";
    const payeeName = "SALORIYA";
    const note = "SALORIYA Jewellery Order";
    const qrCodeUrl = "/upi-qr.jpg";

    // Device detection for optimal deep-linking protocol
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isMobile = isAndroid || isIOS || window.innerWidth <= 768;

    // Standard NPCI-compliant UPI parameters
    const upiParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountInRupees}&cu=INR&tn=${encodeURIComponent(note)}`;

    // Android Chrome requires explicit Android Intent format with package target to directly launch Paytm, PhonePe, or GPay
    // iOS Safari requires registered native app URL schemes
    const upiUniversal = isAndroid
      ? `intent://pay?${upiParams}#Intent;scheme=upi;end;`
      : `upi://pay?${upiParams}`;
    const upiGPay = isAndroid
      ? `intent://pay?${upiParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end;`
      : `tez://upi/pay?${upiParams}`;
    const upiPhonePe = isAndroid
      ? `intent://pay?${upiParams}#Intent;scheme=upi;package=com.phonepe.app;end;`
      : `phonepe://pay?${upiParams}`;
    const upiPaytm = isAndroid
      ? `intent://pay?${upiParams}#Intent;scheme=upi;package=net.one97.paytm;end;`
      : `paytmmp://pay?${upiParams}`;

    checkoutContent.innerHTML = `
      <div class="online-payment-portal">
        <div class="payment-header">
          <p class="eyebrow" style="color:var(--wine);">SALORIYA INSTANT SECURE UPI</p>
          <h3 style="font-family:'Playfair Display',serif;font-size:24px;margin:4px 0 8px;">Scan &amp; Pay to Place Order</h3>
          <p style="font-size:12px;color:var(--muted);margin:0 0 16px;">
            Please complete payment in your UPI app and upload your payment confirmation screenshot.
          </p>
        </div>

        <div class="payment-amount-card">
          <span>Total Payable Amount</span>
          <strong class="payment-amount-val">${money(orderData.totalPaise)}</strong>
          <small>
            Item: ${money(orderData.subtotalPaise)} + Transport: ${orderData.promoCode ? `<strong style="color:#15803d;">FREE (Promo: ${escapeHtml(orderData.promoCode)})</strong>` : '₹50.00'}
          </small>
        </div>

        <!-- Mobile UPI App Redirection Area -->
        <div class="upi-app-selection-strip" style="margin:14px 0;background:#fff8f5;border:1px solid var(--gold);border-radius:10px;padding:14px;text-align:center;">
          <p style="font-size:11.5px;font-weight:700;color:var(--wine);margin:0 0 10px;text-transform:uppercase;letter-spacing:0.5px;">
            📱 Pay Directly via Installed UPI App on Mobile
          </p>
          
          <!-- Universal Launch Button: opens device's native app chooser -->
          <a href="${upiUniversal}" id="btn-pay-universal" class="button button-gold payment-universal-btn" style="width:100%;padding:14px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;border-radius:6px;box-sizing:border-box;margin-bottom:10px;">
            ⚡ Open Installed UPI App on Mobile 
          </a>

          <!-- Individual Direct Shortcuts for Top UPI Apps with Original Logos -->
          <div class="upi-apps-row">
            <a href="${upiGPay}" class="upi-direct-app-btn gpay-link" title="Pay with Google Pay">
              <img src="/gpay-icon.svg" alt="Google Pay" class="upi-app-logo" />
              <span>GPay</span>
            </a>
            <a href="${upiPhonePe}" class="upi-direct-app-btn phonepe-link" title="Pay with PhonePe">
              <img src="/phonepe-icon.svg" alt="PhonePe" class="upi-app-logo" />
              <span>PhonePe</span>
            </a>
            <a href="${upiPaytm}" class="upi-direct-app-btn paytm-link" title="Pay with Paytm">
              <img src="/paytm-icon.svg" alt="Paytm" class="upi-app-logo paytm-logo-img" />
              <span>Paytm</span>
            </a>
            <a href="${upiUniversal}" class="upi-direct-app-btn cred-link" title="Pay with Other UPI App">
              <img src="/upi-logo.svg" alt="Other UPI" class="upi-app-logo upi-badge-img" />
              <span>Other UPI</span>
            </a>
          </div>

          <p id="upi-intent-fallback-hint" style="font-size:10.5px;color:var(--muted);margin:0;line-height:1.4;">
            💡 If you're on desktop or the app doesn't open automatically, please scan the QR code below or copy the UPI ID.
          </p>
        </div>

        <div class="payment-qr-wrap" style="display:flex;flex-direction:column;align-items:center;margin:14px 0;">
          <div style="background:#ffffff;padding:8px;border-radius:12px;border:1.5px solid var(--gold);box-shadow:0 4px 16px rgba(134,30,56,0.12);display:inline-block;">
            <img src="${qrCodeUrl}" alt="SALORIYA Google Pay QR Code" class="payment-qr-img" width="220" height="220" style="display:block;border-radius:8px;object-fit:contain;background:#202124;" />
          </div>
          <div class="payment-qr-badge" style="margin-top:8px;">✦ Scan with Google Pay / PhonePe / Paytm / Any UPI App</div>
        </div>

        <div class="payment-upi-details" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;margin:14px 0;">
          <div class="payment-upi-id-box" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;padding:10px 14px;border-radius:8px;background:#ffffff;border:1px solid var(--line);margin:0 auto;width:100%;box-sizing:border-box;">
            <span class="upi-label" style="font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;display:block;">UPI ID:</span>
            <div style="display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;width:100%;">
              <code class="upi-code" id="upi-id-text" style="font-size:13.5px;font-weight:700;color:var(--wine);letter-spacing:0.3px;font-family:monospace;word-break:break-all;">${upiId}</code>
              <button type="button" class="btn-copy-upi" id="btn-copy-upi" title="Copy UPI ID" style="padding:4px 12px;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;">Copy</button>
            </div>
          </div>
        </div>


        <div class="payment-verify-form">
          <div class="payment-screenshot-card" style="background:#fff7f3;border:1.5px dashed var(--wine);border-radius:10px;padding:16px;text-align:center;margin-bottom:14px;">
            <label style="display:block;font-size:12px;font-weight:700;color:var(--wine);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">
              📸 Upload Payment Screenshot *
            </label>
            <p style="font-size:11.5px;color:var(--muted);margin:0 0 10px;line-height:1.4;">
              After completing the UPI payment of <strong>${money(orderData.totalPaise)}</strong>, please upload your transaction confirmation receipt screenshot:
            </p>

            <input type="file" id="upi-screenshot-input" accept="image/*" style="display:none;" />
            
            <div id="dropzone-screenshot" style="cursor:pointer;border:1px dashed #d1b490;background:#ffffff;border-radius:8px;padding:14px;transition:all 0.2s ease;">
              <div id="prompt-screenshot">
                <span style="font-size:30px;display:block;margin-bottom:4px;">🖼️</span>
                <strong style="display:block;font-size:12.5px;color:var(--ink);margin-bottom:2px;">Tap here to select payment screenshot</strong>
                <span style="font-size:11px;color:var(--muted);">Supports Google Pay, PhonePe, Paytm, or bank transfer images</span>
              </div>
              <div id="preview-screenshot-wrap" style="display:none;">
                <img id="preview-screenshot-img" src="" alt="Payment Screenshot Preview" style="max-height:160px;max-width:100%;border-radius:6px;object-fit:contain;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:block;margin:0 auto 8px;" />
                <div style="display:flex;align-items:center;justify-content:center;gap:10px;font-size:11.5px;">
                  <span id="preview-screenshot-name" style="font-weight:600;color:var(--ink);"></span>
                  <button type="button" id="btn-change-screenshot" class="text-button" style="color:var(--wine);text-decoration:underline;cursor:pointer;font-weight:600;">Change / Remove</button>
                </div>
              </div>
            </div>
            <div style="font-size:10.5px;color:var(--muted);text-align:left;margin-top:8px;">
              ⚠️ Please ensure the transaction amount (${money(orderData.totalPaise)}) and date/time are clearly visible.
            </div>
          </div>

          <button type="button" id="btn-verify-pay" class="button button-gold" style="width:100%;padding:14px;font-size:13px;font-weight:700;letter-spacing:0.5px;">
            I Have Paid — Upload Screenshot &amp; Confirm Order (${money(orderData.totalPaise)}) ✓
          </button>
          <button type="button" id="btn-cancel-pay" class="button button-outline" style="width:100%;margin-top:8px;padding:10px;font-size:12px;">
            ← Back / Change to Cash on Delivery
          </button>
        </div>

        <p class="form-message" id="payment-verify-message" role="status" style="margin-top:12px;"></p>
      </div>
    `;

    // Direct Mobile UPI App Redirection Handlers
    const launchUpiApp = (e, url, appName) => {
      if (!isMobile) {
        e.preventDefault();
        const qrWrap = checkoutContent.querySelector(".payment-qr-wrap");
        if (qrWrap) qrWrap.scrollIntoView({ behavior: "smooth", block: "center" });
        const hint = checkoutContent.querySelector("#upi-intent-fallback-hint");
        if (hint) {
          hint.innerHTML = `<span style="color:var(--wine);font-weight:700;">📱 Desktop Browser Detected:</span> Please scan the QR code below with <strong>${appName}</strong> on your mobile phone, or copy the UPI ID.`;
        }
        return;
      }

      // On mobile devices, allow the native anchor navigation or explicitly set window.location
      window.location.href = url;
    };

    checkoutContent.querySelector("#btn-pay-universal")?.addEventListener("click", (e) => {
      launchUpiApp(e, upiUniversal, "Any UPI App");
    });
    checkoutContent.querySelector(".gpay-link")?.addEventListener("click", (e) => {
      launchUpiApp(e, upiGPay, "Google Pay");
    });
    checkoutContent.querySelector(".phonepe-link")?.addEventListener("click", (e) => {
      launchUpiApp(e, upiPhonePe, "PhonePe");
    });
    checkoutContent.querySelector(".paytm-link")?.addEventListener("click", (e) => {
      launchUpiApp(e, upiPaytm, "Paytm");
    });
    checkoutContent.querySelector(".cred-link")?.addEventListener("click", (e) => {
      launchUpiApp(e, upiUniversal, "Other UPI App");
    });

    // Copy UPI button
    const copyBtn = checkoutContent.querySelector("#btn-copy-upi");
    copyBtn?.addEventListener("click", () => {
      navigator.clipboard?.writeText(upiId);
      copyBtn.textContent = "Copied! ✓";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });

    // Back button
    checkoutContent.querySelector("#btn-cancel-pay")?.addEventListener("click", () => {
      renderCheckout();
    });

    // Screenshot file handling
    let uploadedScreenshotBase64 = null;
    const fileInput = checkoutContent.querySelector("#upi-screenshot-input");
    const dropzone = checkoutContent.querySelector("#dropzone-screenshot");
    const promptWrap = checkoutContent.querySelector("#prompt-screenshot");
    const previewWrap = checkoutContent.querySelector("#preview-screenshot-wrap");
    const previewImg = checkoutContent.querySelector("#preview-screenshot-img");
    const previewName = checkoutContent.querySelector("#preview-screenshot-name");
    const changeBtn = checkoutContent.querySelector("#btn-change-screenshot");
    const verifyBtn = checkoutContent.querySelector("#btn-verify-pay");
    const verifyMsg = checkoutContent.querySelector("#payment-verify-message");

    dropzone?.addEventListener("click", (e) => {
      if (e.target === changeBtn) return;
      fileInput?.click();
    });

    changeBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      uploadedScreenshotBase64 = null;
      if (fileInput) fileInput.value = "";
      if (previewWrap) previewWrap.style.display = "none";
      if (promptWrap) promptWrap.style.display = "block";
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        alert("Please upload a valid image file (JPG, PNG, or WEBP).");
        return;
      }

      if (promptWrap) {
        promptWrap.innerHTML = `
          <span style="font-size:24px;display:block;margin-bottom:4px;">⏳</span>
          <strong style="font-size:12px;color:var(--wine);">Processing &amp; optimizing screenshot…</strong>
        `;
      }

      try {
        uploadedScreenshotBase64 = await compressImageForStorage(file, 900, 0.72);
      } catch (e) {
        const reader = new FileReader();
        reader.onload = () => {
          uploadedScreenshotBase64 = reader.result;
          if (previewImg) previewImg.src = uploadedScreenshotBase64;
          if (previewName) previewName.textContent = file.name || "Screenshot selected ✓";
          if (promptWrap) promptWrap.style.display = "none";
          if (previewWrap) previewWrap.style.display = "block";
          if (verifyMsg) verifyMsg.textContent = "";
        };
        reader.readAsDataURL(file);
        return;
      }

      if (previewImg) previewImg.src = uploadedScreenshotBase64;
      if (previewName) previewName.textContent = file.name || "Screenshot selected ✓";
      if (promptWrap) promptWrap.style.display = "none";
      if (previewWrap) previewWrap.style.display = "block";
      if (verifyMsg) verifyMsg.textContent = "";
    });

    // Submit Payment Proof & Confirm Order button (Instantly confirms order and reduces stock)
    verifyBtn?.addEventListener("click", async () => {
      // Screenshot validation: Must have uploaded screenshot proof!
      if (!uploadedScreenshotBase64) {
        verifyMsg.textContent = "Please upload your payment screenshot before submitting. Orders cannot be confirmed without payment proof.";
        verifyMsg.classList.add("error");
        fileInput?.click();
        return;
      }

      verifyBtn.disabled = true;
      verifyBtn.textContent = "Submitting payment proof…";
      verifyMsg.textContent = "Saving payment details and submitting order for admin confirmation…";
      verifyMsg.classList.remove("error");

      await new Promise(r => setTimeout(r, 400));

      const finalOrderId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `prepaid_${Date.now()}`;
      const addressFormatted = `${orderData.street}, ${orderData.city}, ${orderData.state} - ${orderData.pincode}`;

      try {
        // Online Payment: Order placed directly into Supabase as pending, awaiting admin verification of payment screenshot
        // Admin will verify screenshot in Admin Console and confirm order to deduct product stock!
        try {
          const { error: orderErr } = await supabase
            .from("orders")
            .insert({
              id: finalOrderId,
              customer_name: orderData.customerName,
              phone: orderData.phone,
              address: {
                street: orderData.street,
                city: orderData.city,
                state: orderData.state,
                pincode: orderData.pincode,
                has_screenshot: true,
                screenshot_data: uploadedScreenshotBase64,
                transport_fee_paise: orderData.promoCode ? 0 : TRANSPORT_FEE_PAISE,
                promo_code: orderData.promoCode || null,
                discount_paise: orderData.discountPaise || 0
              },
              payment_method: "prepaid",
              payment_status: "awaiting_verification",
              order_status: "pending",
              total_paise: orderData.totalPaise,
              promo_code: orderData.promoCode || null
            });

          if (orderErr) {
            console.warn("Direct order insert note (RLS):", orderErr.message);
          } else {
            // Insert line item in Supabase
            try {
              await supabase
                .from("order_items")
                .insert({
                  order_id: finalOrderId,
                  product_id: p.id,
                  product_name: p.name,
                  colour: orderData.chosenColour,
                  quantity: orderData.qty,
                  unit_price_paise: p.price_paise
                });
            } catch (itemErr) {
              console.warn("order_items insert error:", itemErr);
            }
          }
        } catch (orderDbErr) {
          console.warn("Supabase order insert caught error:", orderDbErr);
        }

        const shortId = finalOrderId.slice(0, 8).toUpperCase();

        // 3. Save screenshot and local order record in localStorage for instant admin dashboard viewing (without database storage)
        try {
          localStorage.setItem(`saloriya_screenshot_${finalOrderId}`, uploadedScreenshotBase64);
          localStorage.setItem("saloriya_latest_screenshot", uploadedScreenshotBase64);
          localStorage.setItem("saloriya_latest_order_id", finalOrderId);

          const list = JSON.parse(localStorage.getItem("saloriya_local_orders") || "[]");
          const localOrder = {
            id: finalOrderId,
            customer_name: orderData.customerName,
            phone: orderData.phone,
            address: {
              street: orderData.street,
              city: orderData.city,
              state: orderData.state,
              pincode: orderData.pincode,
              has_screenshot: true,
              transport_fee_paise: TRANSPORT_FEE_PAISE
            },
            payment_method: "prepaid",
            payment_status: "awaiting_verification",
            order_status: "pending",
            total_paise: orderData.totalPaise,
            created_at: new Date().toISOString(),
            items: [{
              order_id: finalOrderId,
              product_id: p.id,
              product_name: p.name,
              colour: orderData.chosenColour,
              quantity: orderData.qty,
              unit_price_paise: p.price_paise
            }]
          };
          const existingIdx = list.findIndex(o => o.id === finalOrderId);
          if (existingIdx >= 0) {
            list[existingIdx] = localOrder;
          } else {
            list.unshift(localOrder);
          }
          localStorage.setItem("saloriya_local_orders", JSON.stringify(list.slice(0, 50)));
        } catch (storageErr) {
          console.warn("Could not cache order in localStorage:", storageErr);
        }

        // 4. Dispatch Email Notification to Saloriyaofficial@gmail.com
        sendOrderEmailNotification({
          orderId: shortId,
          customerName: orderData.customerName,
          phone: orderData.phone,
          address: addressFormatted,
          productName: p.name,
          colour: orderData.chosenColour,
          quantity: orderData.qty,
          totalAmount: money(orderData.totalPaise),
          paymentMethod: "prepaid",
          hasScreenshot: true
        });

        // 5. Show order success screen (Admin confirmation is required for online payment)
        showOrderSuccessScreen(
          finalOrderId,
          p,
          orderData.chosenColour,
          orderData.qty,
          orderData.totalPaise,
          orderData.customerName,
          orderData.phone,
          addressFormatted,
          "prepaid",
          "pending"
        );
      } catch (err) {
        console.error("Payment confirmation error:", err);
        verifyMsg.textContent = "Could not record payment details. Please share your screenshot on WhatsApp.";
        verifyMsg.classList.add("error");
        verifyBtn.disabled = false;
        verifyBtn.textContent = `Try Again / Confirm (${money(orderData.totalPaise)})`;
      }
    });
  }

  function showOrderSuccessScreen(orderId, p, colour, quantity, totalPaise, name, phone, address, paymentMethod = "cod", paymentStatus = "confirmed") {
    const shortId = orderId ? `#ORD-${orderId.slice(0, 8).toUpperCase()}` : "#ORD-DIRECT";
    const paymentLabel = paymentMethod === "prepaid" 
      ? "Online UPI (Screenshot Submitted · Awaiting Admin Verification ⏳)" 
      : "Cash on Delivery (COD · Confirmed ✓)";

    const waText = encodeURIComponent(`Hello SALORIYA! I just placed an order:\nOrder ID: ${shortId}\nProduct: ${p.name}\nColour: ${colour}\nQuantity: ${quantity}\nTotal Amount: ${money(totalPaise)} (includes ₹50 Transport)\nPayment: ${paymentLabel}\nName: ${name}\nPhone: ${phone}\nAddress: ${address}${paymentMethod === 'prepaid' ? '\n(Payment screenshot attached / uploaded on site)' : ''}`);
    const waUrl = `https://wa.me/918680824598?text=${waText}`;

    checkoutContent.innerHTML = `
      <div class="order-success-screen" style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 16px;width:100%;max-width:520px;margin:0 auto;box-sizing:border-box;">
        <div class="order-success-icon" style="background:#dcfce7;color:#166534;border:2px solid #22c55e;margin:0 auto 14px;width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:26px;">
          ✓
        </div>
        <p class="eyebrow" style="color:#166534;text-align:center;width:100%;margin:0 auto 8px;font-weight:700;letter-spacing:1.2px;font-size:12.5px;display:block;">
          ORDER PLACED SUCCESSFULLY
        </p>
        <h3 style="font-family:'Playfair Display',serif;font-size:25px;margin:4px auto 8px;text-align:center;width:100%;color:var(--ink);">Thank you, ${escapeHtml(name)}!</h3>
        <p style="color:var(--muted);font-size:12.5px;max-width:440px;margin:0 auto 16px;text-align:center;line-height:1.5;">
          ${paymentMethod === 'prepaid'
            ? 'Your payment screenshot has been uploaded. Our admin team will verify the payment and confirm your order for dispatch.'
            : 'Your jewellery order has been confirmed and our team will prepare your piece for immediate dispatch.'
          }
        </p>
        <div class="order-success-id" style="margin:0 auto 16px;text-align:center;display:inline-block;">${shortId}</div>
        <div style="background:#faf4f0;border:1px solid var(--line);border-radius:10px;padding:16px;text-align:left;font-size:12px;line-height:1.6;margin-bottom:16px;width:100%;box-sizing:border-box;">
          <strong>Item:</strong> ${escapeHtml(p.name)} (${escapeHtml(colour)}) × ${quantity}<br/>
          <strong>Total Amount:</strong> ${money(totalPaise)} <span style="color:var(--muted);font-size:10.5px;">(includes ₹50 transport fee)</span><br/>
          <strong>Delivery to:</strong> ${escapeHtml(address)}<br/>
          <strong>Payment Mode:</strong> ${escapeHtml(paymentLabel)}<br/>
          <small style="color:#166534;font-weight:600;display:block;margin-top:8px;text-align:center;">✉️ Notification automatically sent to store email (Saloriyaofficial@gmail.com)</small>
        </div>

        <a href="${waUrl}" target="_blank" rel="noopener,noreferrer" class="modal-wa-btn" style="margin-bottom:10px;width:100%;justify-content:center;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2ZM12.05 20.16C10.57 20.16 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.16 12.05 20.16ZM16.57 14.33C16.32 14.2 15.1 13.6 14.87 13.52C14.64 13.43 14.48 13.39 14.31 13.64C14.15 13.88 13.68 14.44 13.53 14.6C13.39 14.77 13.25 14.79 13 14.66C12.75 14.54 11.95 14.28 11 13.43C10.26 12.77 9.76 11.95 9.61 11.7C9.47 11.45 9.6 11.32 9.72 11.2C9.83 11.09 9.97 10.91 10.1 10.76C10.22 10.61 10.26 10.5 10.34 10.34C10.42 10.17 10.38 10.03 10.32 9.91C10.26 9.78 9.76 8.56 9.56 8.06C9.36 7.58 9.16 7.64 9.01 7.63C8.87 7.62 8.71 7.62 8.54 7.62C8.38 7.62 8.11 7.68 7.89 7.93C7.66 8.17 7.03 8.76 7.03 9.97C7.03 11.18 7.91 12.35 8.03 12.51C8.16 12.68 9.77 15.16 12.24 16.22C12.82 16.47 13.28 16.63 13.64 16.74C14.23 16.93 14.76 16.9 15.19 16.84C15.67 16.77 16.66 16.24 16.87 15.66C17.07 15.07 17.07 14.57 17.01 14.47C16.95 14.37 16.81 14.45 16.57 14.33Z"/>
          </svg>
          Send Order Details on WhatsApp 
        </a>
        <button type="button" class="button button-outline" data-close-checkout style="width:100%;">
          Continue Shopping
        </button>
      </div>
    `;

    checkoutContent.querySelector("[data-close-checkout]")?.addEventListener("click", closeCheckoutModal);
  }

  renderCheckout();
  checkoutModal.hidden = false;
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCheckoutModal() {
  if (!checkoutModal) return;
  checkoutModal.hidden = true;
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

checkoutModal?.addEventListener("click", e => {
  if (e.target.hasAttribute("data-close-checkout") || e.target.closest("[data-close-checkout]")) {
    closeCheckoutModal();
  }
});

// Modal close triggers
modal.addEventListener("click", e => {
  if (e.target.hasAttribute("data-close-modal") || e.target.closest("[data-close-modal]")) {
    closeProductModal();
  }
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape" && !modal.hidden) {
    closeProductModal();
  }
});

// Delicate luxury micro-tilt on product cards (damped to < 0.85 deg for an ultra-refined tactile feel)
let currentHoveredCard = null;

grid.addEventListener("pointermove", e => {
  const card = e.target.closest(".product-card");
  if (currentHoveredCard && currentHoveredCard !== card) {
    currentHoveredCard.style.transform = "";
  }
  currentHoveredCard = card;
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const normX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
  const normY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

  const rotateX = Math.max(-0.85, Math.min(0.85, normY * -0.85));
  const rotateY = Math.max(-0.85, Math.min(0.85, normX * 0.85));

  card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`;
});

grid.addEventListener("pointerleave", () => {
  if (currentHoveredCard) {
    currentHoveredCard.style.transform = "";
    currentHoveredCard = null;
  }
});

// Discreet admin access for store owner (Ctrl+Shift+A, Alt+A, or double-click footer logo)
window.addEventListener("keydown", e => {
  if ((e.ctrlKey && e.shiftKey && (e.key === "A" || e.key === "a")) || (e.altKey && (e.key === "A" || e.key === "a"))) {
    e.preventDefault();
    window.location.href = "/admin.html";
  }
});

const footerLogo = document.querySelector("#footer-brand-logo");
if (footerLogo) {
  footerLogo.addEventListener("dblclick", e => {
    e.preventDefault();
    window.location.href = "/admin.html";
  });
}

loadProducts();
