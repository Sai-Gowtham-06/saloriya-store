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
let currentModalProductId = null;

function money(paise) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format((paise || 0) / 100);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
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
  const initialColour = p.colours?.[0] || "";
  const image = getColourImage(p, initialColour, 0);
  const colours = (p.colours || []).map((c, i) => `<option value="${escapeHtml(c)}" data-index="${i}">${escapeHtml(c)}</option>`).join("");
  
  return `<article class="product-card" data-product-id="${p.id}">
    <div class="product-image" data-open-preview="${p.id}" title="Click to view details & photos">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(p.name)}" loading="lazy">` : `<div class="image-placeholder"><span>S</span><small>READY TO WEAR</small></div>`}
      ${p.stock <= 0 ? '<span class="stock-tag out-of-stock">Out of stock</span>' : '<span class="stock-tag">Ready to wear</span>'}
      <div class="card-quick-preview-badge">Quick View ↗</div>
    </div>
    <div class="product-info" data-open-preview="${p.id}">
      <div>
        <p class="product-category">${escapeHtml(p.category || "GOLD COVERING")}</p>
        <h3 class="product-title-link">${escapeHtml(p.name)}</h3>
      </div>
      <strong>${money(p.price_paise)}</strong>
    </div>
    ${p.description ? `<p class="product-description" data-open-preview="${p.id}">${escapeHtml(p.description)}</p>` : ""}
    ${p.colours?.length ? `<label class="colour-label">Choose a colour<select class="colour-select" data-product="${p.id}">${colours}</select></label>` : ""}
    <button class="add-button" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${p.stock <= 0 ? "Currently unavailable" : "Order on WhatsApp ↗"}</button>
  </article>`;
}

function render() {
  const shown = products.filter(p => activeCategory === "All" || p.category === activeCategory);
  grid.innerHTML = shown.map(productCard).join("");
  empty.hidden = shown.length > 0;
}

async function loadProducts() {
  if (!isSupabaseConfigured) {
    grid.innerHTML = `<div class="setup-note"><strong>Your storefront is ready for its database connection.</strong><p>Follow SETUP.md to add your Supabase project URL and publishable key, run the SQL setup, and add products through the admin page.</p><a href="/admin.html">Open admin dashboard ↗</a></div>`;
    return;
  }
  const { data, error } = await supabase.from("products").select("*").eq("is_published", true).order("created_at", { ascending: false });
  if (error) {
    grid.innerHTML = `<div class="setup-note"><strong>We couldn't load the collection.</strong><p>${escapeHtml(error.message)}</p><p>Check the database schema and Row Level Security policies in SETUP.md.</p></div>`;
    return;
  }
  products = data || [];
  render();

  // Check if page opened with product hash (e.g. #product-<id>)
  if (window.location.hash.startsWith("#product-")) {
    const hashId = window.location.hash.replace("#product-", "");
    if (hashId) {
      openProductModal(hashId);
    }
  }
}

filters.addEventListener("click", e => {
  const btn = e.target.closest("[data-category]");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  filters.querySelectorAll(".filter").forEach(b => b.classList.toggle("active", b === btn));
  render();
});

grid.addEventListener("change", e => {
  if (e.target.matches(".colour-select")) {
    const select = e.target;
    select.dataset.selectedColour = select.value;
    const card = select.closest(".product-card");
    if (!card) return;

    const p = products.find(item => item.id === select.dataset.product);
    if (!p) return;

    const targetImage = getColourImage(p, select.value, select.selectedIndex);
    if (!targetImage) return;

    let img = card.querySelector(".product-image img");
    if (!img) {
      const container = card.querySelector(".product-image");
      const placeholder = container?.querySelector(".image-placeholder");
      if (placeholder) placeholder.remove();
      img = document.createElement("img");
      img.alt = p.name;
      img.loading = "lazy";
      container?.prepend(img);
    }

    if (img && img.src !== targetImage) {
      img.style.transition = "opacity 0.25s ease";
      img.style.opacity = "0.4";
      img.src = targetImage;
      img.onload = () => { img.style.opacity = "1"; };
      setTimeout(() => { img.style.opacity = "1"; }, 300);
    }
  }
});

// Grid click: handles WhatsApp quick buy OR opens full Flipkart/Amazon style preview modal
grid.addEventListener("click", e => {
  // If clicked WhatsApp buy button on the card:
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) {
    const p = products.find(item => item.id === addBtn.dataset.add);
    if (!p) return;
    const select = grid.querySelector(`.colour-select[data-product="${CSS.escape(p.id)}"]`);
    const colour = select?.value || p.colours?.[0] || "Standard";
    const categoryStr = p.category ? ` [${p.category}]` : "";
    const message = encodeURIComponent(`Hello SALORIYA! I'd like to order:\nProduct: ${p.name}${categoryStr}\nColour: ${colour}\nPrice shown: ${money(p.price_paise)}\nPlease confirm availability and delivery details.`);
    window.open(`https://wa.me/918680824598?text=${message}`, "_blank", "noopener,noreferrer");
    return;
  }

  // If clicking inside the colour select dropdown or label, do not open modal
  if (e.target.closest(".colour-select") || e.target.closest(".colour-label")) {
    return;
  }

  // If clicking on image, title, card or quick view badge: open Amazon / Flipkart style preview modal
  const card = e.target.closest(".product-card");
  if (card) {
    const select = card.querySelector(".colour-select");
    const currentColour = select?.value || "";
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

  // Thumbnail images markup
  const thumbsHtml = allImages.length > 1 ? allImages.map((url, i) => {
    const isActive = url === activeImage;
    return `<button type="button" class="modal-thumb ${isActive ? 'active' : ''}" data-thumb-url="${escapeHtml(url)}" aria-label="View angle ${i+1}">
      <img src="${escapeHtml(url)}" alt="${escapeHtml(p.name)} - angle ${i+1}" />
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
            <li><strong>Craft & Style:</strong> Premium 1-Gram Gold Covering & Readymade Jewellery</li>
            <li><strong>Coating:</strong> Long-lasting micro-gold finish with protective tarnish barrier</li>
            <li><strong>Skin Comfort:</strong> 100% Nickel-free, lead-free & hypoallergenic daily wear</li>
            <li><strong>Packaging:</strong> Safely secured in protective jewellery-grade box</li>
            <li><strong>Occasion:</strong> Perfect for festive, wedding, temple & everyday elegance</li>
          </ul>
        </div>

        <!-- Description -->
        <div class="modal-description-section">
          <h4 class="modal-section-title">About this piece</h4>
          <p class="modal-description-text">${escapeHtml(p.description || "Designed with meticulous attention to detail, this SALORIYA piece captures the authentic grandeur of heirloom gold jewellery in a lightweight, ready-to-wear silhouette.")}</p>
        </div>

        <!-- Order & Enquiries Actions -->
        <div class="modal-actions">
          <button type="button" class="modal-order-btn" id="modal-order-button" ${p.stock <= 0 ? "disabled" : ""}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
            ${p.stock <= 0 ? "Currently Unavailable" : "Order on WhatsApp ↗"}
          </button>
          <button type="button" class="modal-query-link" id="modal-query-btn">
            Need custom sizing or have questions? Chat with our stylist ↗
          </button>
        </div>

        <!-- Trust Bar -->
        <div class="modal-trust-bar">
          <div class="trust-item"><span>💎</span> Authentic Finish</div>
          <div class="trust-item"><span>📦</span> Direct Dispatch</div>
          <div class="trust-item"><span>🛡️</span> Verified Quality</div>
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

  // Setup Thumbnail Clicks
  const thumbsContainer = modalContent.querySelector("#modal-thumbs");
  if (thumbsContainer) {
    thumbsContainer.addEventListener("click", e => {
      const btn = e.target.closest("[data-thumb-url]");
      if (!btn || !mainImg) return;
      thumbsContainer.querySelectorAll(".modal-thumb").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      mainImg.style.transition = "opacity 0.2s ease";
      mainImg.style.opacity = "0.4";
      mainImg.src = btn.dataset.thumbUrl;
      mainImg.onload = () => { mainImg.style.opacity = "1"; };
      setTimeout(() => { mainImg.style.opacity = "1"; }, 250);
    });
  }

  // Setup Colour Variant Clicks (Switches colour & matching image)
  const colourPillsContainer = modalContent.querySelector("#modal-colour-pills");
  const chosenColourLabel = modalContent.querySelector("#modal-chosen-colour");
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
        const select = card.querySelector(".colour-select");
        if (select && select.value !== selectedColour) {
          select.value = selectedColour;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
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
