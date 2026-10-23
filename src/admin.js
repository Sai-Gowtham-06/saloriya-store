import "./style.css";
import { supabase, isSupabaseConfigured } from "./supabase.js";

const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#login-form");
const loginMessage = document.querySelector("#login-message");
const productForm = document.querySelector("#product-form");
const productMessage = document.querySelector("#product-message");
const inventory = document.querySelector("#admin-products");
const formTitle = document.querySelector("#form-title");
const imagePreviews = document.querySelector("#image-previews");
const fields = productForm.elements;
const dropzone = document.querySelector("#file-dropzone");

// Unified image state: holds array of { type: 'existing'|'new', url?: string, previewUrl: string, file?: File, name?: string }
let imageList = [];

function clearImageList() {
  for (const item of imageList) {
    if (item.type === "new" && item.previewUrl) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    }
  }
  imageList = [];
  renderImagePreviews();
}

function renderImagePreviews() {
  if (!imagePreviews) return;
  if (!imageList.length) {
    imagePreviews.innerHTML = "";
    return;
  }
  imagePreviews.innerHTML = `
    <div class="previews-header">
      <span class="previews-count">${imageList.length} image${imageList.length === 1 ? "" : "s"} selected</span>
      <button type="button" class="text-button" id="clear-all-images">Remove all</button>
    </div>
    <div class="previews-grid">
      ${imageList.map((item, idx) => `
        <div class="image-preview-item" data-index="${idx}" title="${escapeHtml(item.name || `Image #${idx + 1}`)}">
          <img src="${escapeHtml(item.previewUrl)}" alt="Product Image #${idx + 1}" loading="lazy" />
          <div class="preview-actions">
            ${idx > 0 ? `<button type="button" class="preview-btn move-btn" data-move-left="${idx}" title="Move left">‹</button>` : ""}
            <button type="button" class="preview-btn remove-img" data-remove-img="${idx}" title="Remove image">×</button>
            ${idx < imageList.length - 1 ? `<button type="button" class="preview-btn move-btn" data-move-right="${idx}" title="Move right">›</button>` : ""}
          </div>
          <span class="img-tag">#${idx + 1}${item.type === "new" ? " • new" : ""}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function addFiles(files) {
  if (!files || !files.length) return;
  let addedCount = 0;
  const fileArray = Array.from(files);

  for (const file of fileArray) {
    if (!file.type.startsWith("image/")) {
      message(productMessage, `"${file.name}" is not an image file.`, true);
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      message(productMessage, `"${file.name}" exceeds 5 MB limit. Please compress it.`, true);
      continue;
    }
    const previewUrl = URL.createObjectURL(file);
    imageList.push({
      type: "new",
      file,
      previewUrl,
      name: file.name
    });
    addedCount++;
  }

  if (addedCount > 0) {
    message(productMessage, `${addedCount} image${addedCount > 1 ? "s" : ""} added to preview.`);
  }

  if (fields.images) {
    fields.images.value = "";
  }
  renderImagePreviews();
}

// File picker change listener
fields.images?.addEventListener("change", e => {
  addFiles(e.target.files);
});

// Dropzone drag & drop support
if (dropzone) {
  ["dragenter", "dragover"].forEach(eventName => {
    dropzone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "dragend"].forEach(eventName => {
    dropzone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer?.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  });
}

// Preview actions: remove, move left, move right, clear all
imagePreviews?.addEventListener("click", e => {
  const clearAll = e.target.closest("#clear-all-images");
  if (clearAll) {
    clearImageList();
    message(productMessage, "All image previews cleared.");
    return;
  }

  const removeBtn = e.target.closest("[data-remove-img]");
  if (removeBtn) {
    const idx = Number(removeBtn.dataset.removeImg);
    if (!Number.isNaN(idx) && idx >= 0 && idx < imageList.length) {
      const removed = imageList.splice(idx, 1)[0];
      if (removed.type === "new" && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      renderImagePreviews();
    }
    return;
  }

  const moveLeft = e.target.closest("[data-move-left]");
  if (moveLeft) {
    const idx = Number(moveLeft.dataset.moveLeft);
    if (!Number.isNaN(idx) && idx > 0 && idx < imageList.length) {
      const temp = imageList[idx];
      imageList[idx] = imageList[idx - 1];
      imageList[idx - 1] = temp;
      renderImagePreviews();
    }
    return;
  }

  const moveRight = e.target.closest("[data-move-right]");
  if (moveRight) {
    const idx = Number(moveRight.dataset.moveRight);
    if (!Number.isNaN(idx) && idx >= 0 && idx < imageList.length - 1) {
      const temp = imageList[idx];
      imageList[idx] = imageList[idx + 1];
      imageList[idx + 1] = temp;
      renderImagePreviews();
    }
    return;
  }
});

function money(paise) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format((paise || 0) / 100);
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function message(el, text, error = false) {
  el.textContent = text;
  el.classList.toggle("error", error);
}
function showSession(session) {
  const loggedIn = Boolean(session);
  loginPanel.hidden = loggedIn;
  dashboard.hidden = !loggedIn;
}

loginForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isSupabaseConfigured) return message(loginMessage, "Configure Supabase first. See SETUP.md.", true);
  const fd = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({ email: fd.get("email"), password: fd.get("password") });
  if (error) return message(loginMessage, error.message, true);
  message(loginMessage, "");
  await refreshSession();
});
document.querySelector("#signout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showSession(null);
});
function resetForm() {
  productForm.reset();
  fields.id.value = "";
  fields.stock.value = "1";
  formTitle.textContent = "Add a new piece";
  clearImageList();
  message(productMessage, "");
}
document.querySelector("#reset-form").addEventListener("click", resetForm);
document.querySelector("#refresh-products").addEventListener("click", loadProducts);

productForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isSupabaseConfigured) return message(productMessage, "Configure Supabase first.", true);
  const fd = new FormData(productForm);
  const name = String(fd.get("name") || "").trim();
  const slug = String(fd.get("slug") || "").trim().toLowerCase();
  const price = Number(fd.get("price"));
  const stock = Number(fd.get("stock"));
  if (!name || !slug || !Number.isFinite(price) || price < 0 || !Number.isInteger(stock) || stock < 0) {
    return message(productMessage, "Check the name, slug, price and stock fields.", true);
  }

  const existingId = String(fd.get("id") || "");
  const newFilesCount = imageList.filter(item => item.type === "new").length;
  let uploadCounter = 0;

  const finalImageUrls = [];
  for (const item of imageList) {
    if (item.type === "existing") {
      finalImageUrls.push(item.url);
    } else if (item.type === "new") {
      uploadCounter++;
      message(productMessage, `Uploading image ${uploadCounter} of ${newFilesCount}…`);
      const file = item.file;
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        return message(productMessage, `Image upload failed: ${uploadError.message}`, true);
      }

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      finalImageUrls.push(urlData.publicUrl);
    }
  }

  message(productMessage, "Saving product…");
  const record = {
    name,
    slug,
    description: String(fd.get("description") || "").trim(),
    category: String(fd.get("category")),
    price_paise: Math.round(price * 100),
    colours: String(fd.get("colours") || "").split(",").map(x => x.trim()).filter(Boolean),
    stock,
    image_urls: finalImageUrls,
    is_published: fields.published.checked,
    updated_at: new Date().toISOString()
  };

  const result = existingId
    ? await supabase.from("products").update(record).eq("id", existingId).select().single()
    : await supabase.from("products").insert(record).select().single();

  if (result.error) return message(productMessage, result.error.message, true);

  message(productMessage, "Product saved. The storefront will load the updated catalogue.");
  resetForm();
  await loadProducts();
  populateOrderProductDropdown();
  renderStockMonitor();
});

// State
let productsList = [];
let ordersList = [];
let orderItemsMap = new Map(); // orderId -> Array of items
let activeOrderFilter = "all";
let orderSearchQuery = "";

// Tab Navigation
const tabButtons = document.querySelectorAll(".admin-tab");
const tabViews = document.querySelectorAll(".admin-tab-view");

function switchTab(tabName) {
  tabButtons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  tabViews.forEach(view => {
    view.classList.toggle("active", view.id === `view-${tabName}`);
  });

  if (tabName === "orders") {
    loadOrders();
  } else if (tabName === "inventory") {
    renderStockMonitor();
  }
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Product Studio UI elements
const productFormPanel = document.querySelector("#product-form-panel");
const toggleProductFormBtn = document.querySelector("#toggle-product-form-btn");
const closeFormBtn = document.querySelector("#close-form-btn");
const cancelEditBtn = document.querySelector("#cancel-edit-btn");

const adminProductSearch = document.querySelector("#admin-product-search");
const adminFilterStatus = document.querySelector("#admin-filter-status");
const adminFilterStock = document.querySelector("#admin-filter-stock");
const adminFilterCategory = document.querySelector("#admin-filter-category");
const adminFilterVariants = document.querySelector("#admin-filter-variants");
const adminSortProducts = document.querySelector("#admin-sort-products");
const adminProductsCount = document.querySelector("#admin-products-count");

// Product Filter State
let productSearchQuery = "";
let productFilterStatus = "all";
let productFilterStock = "all";
let productFilterCategory = "all";
let productFilterVariants = "all";
let productSortOption = "newest";

// Form toggle handlers
if (toggleProductFormBtn) {
  toggleProductFormBtn.addEventListener("click", () => {
    if (!productFormPanel) return;
    const isHidden = productFormPanel.hidden;
    if (isHidden) {
      resetForm();
      productFormPanel.hidden = false;
      formTitle.textContent = "Add a new piece";
      productFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      productFormPanel.hidden = true;
    }
  });
}

if (closeFormBtn) {
  closeFormBtn.addEventListener("click", () => {
    if (productFormPanel) productFormPanel.hidden = true;
    resetForm();
  });
}

if (cancelEditBtn) {
  cancelEditBtn.addEventListener("click", () => {
    if (productFormPanel) productFormPanel.hidden = true;
    resetForm();
  });
}

// Filter listeners
adminProductSearch?.addEventListener("input", e => {
  productSearchQuery = e.target.value.trim().toLowerCase();
  renderAdminProducts();
});
adminFilterStatus?.addEventListener("change", e => {
  productFilterStatus = e.target.value;
  renderAdminProducts();
});
adminFilterStock?.addEventListener("change", e => {
  productFilterStock = e.target.value;
  renderAdminProducts();
});
adminFilterCategory?.addEventListener("change", e => {
  productFilterCategory = e.target.value;
  renderAdminProducts();
});
adminFilterVariants?.addEventListener("change", e => {
  productFilterVariants = e.target.value;
  renderAdminProducts();
});
adminSortProducts?.addEventListener("change", e => {
  productSortOption = e.target.value;
  renderAdminProducts();
});

function renderAdminProducts() {
  if (!inventory) return;

  // 1. Filter
  let filtered = productsList.filter(p => {
    // Search query
    if (productSearchQuery) {
      const matchName = (p.name || "").toLowerCase().includes(productSearchQuery);
      const matchSlug = (p.slug || "").toLowerCase().includes(productSearchQuery);
      const matchCat = (p.category || "").toLowerCase().includes(productSearchQuery);
      const matchDesc = (p.description || "").toLowerCase().includes(productSearchQuery);
      if (!matchName && !matchSlug && !matchCat && !matchDesc) return false;
    }

    // Status filter
    if (productFilterStatus === "published" && !p.is_published) return false;
    if (productFilterStatus === "draft" && p.is_published) return false;

    // Stock filter
    if (productFilterStock === "in-stock" && p.stock <= 0) return false;
    if (productFilterStock === "low-stock" && (p.stock <= 0 || p.stock > 3)) return false;
    if (productFilterStock === "out-of-stock" && p.stock > 0) return false;

    // Category filter
    if (productFilterCategory !== "all" && p.category !== productFilterCategory) return false;

    // Variant filter
    const hasMultipleColours = Array.isArray(p.colours) && p.colours.length > 1;
    if (productFilterVariants === "with-colours" && !hasMultipleColours) return false;
    if (productFilterVariants === "single-colour" && hasMultipleColours) return false;

    return true;
  });

  // 2. Sort
  filtered.sort((a, b) => {
    if (productSortOption === "newest") return new Date(b.created_at) - new Date(a.created_at);
    if (productSortOption === "oldest") return new Date(a.created_at) - new Date(b.created_at);
    if (productSortOption === "price-asc") return (a.price_paise || 0) - (b.price_paise || 0);
    if (productSortOption === "price-desc") return (b.price_paise || 0) - (a.price_paise || 0);
    if (productSortOption === "stock-asc") return (a.stock || 0) - (b.stock || 0);
    if (productSortOption === "stock-desc") return (b.stock || 0) - (a.stock || 0);
    if (productSortOption === "name-asc") return (a.name || "").localeCompare(b.name || "");
    return 0;
  });

  // Update summary strip
  const totalCount = productsList.length;
  const publishedCount = productsList.filter(p => p.is_published).length;
  const draftCount = totalCount - publishedCount;
  if (adminProductsCount) {
    adminProductsCount.innerHTML = `Showing <strong>${filtered.length}</strong> of ${totalCount} pieces (${publishedCount} published · ${draftCount} in drafts)`;
  }

  // Render cards
  if (!filtered.length) {
    inventory.innerHTML = `
      <div class="empty-orders-box" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
        <p style="font-size: 28px; margin-bottom: 8px;">💎</p>
        <strong>No pieces match your filters</strong>
        <p class="hint">Try adjusting the search query, category, or status filter.</p>
      </div>
    `;
    return;
  }

  inventory.innerHTML = filtered.map(p => {
    const stockClass = p.stock <= 0 ? "out-of-stock" : p.stock <= 3 ? "low-stock" : "in-stock";
    const stockLabel = p.stock <= 0 ? "Out of stock (0)" : p.stock <= 3 ? `Low Stock (${p.stock} pcs)` : `In Stock (${p.stock} pcs)`;
    const thumbUrl = p.image_urls?.[0] || "";
    const hasColours = Array.isArray(p.colours) && p.colours.length > 1;
    const variantBadge = hasColours 
      ? `<span class="card-variant-badge multi-colour">✨ ${p.colours.length} Colours (${escapeHtml(p.colours.join(", "))})</span>`
      : `<span class="card-variant-badge single-look">👑 Single Signature Look</span>`;

    return `
      <article class="admin-product-card ${p.is_published ? '' : 'draft-card'}" data-card-id="${p.id}">
        <div class="admin-product-top">
          <div class="admin-product-thumb">
            ${thumbUrl ? `<img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(p.name)}" loading="lazy" />` : "S"}
          </div>
          <div class="admin-product-meta">
            <span class="category-tag">${escapeHtml(p.category || "Jewellery")}</span>
            <h3 class="product-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
            <span class="product-slug">/${escapeHtml(p.slug)}</span>
            <div class="admin-card-badges">
              <span class="badge-publish ${p.is_published ? 'published' : 'draft'}">
                ${p.is_published ? '✓ Live Published' : '○ Draft / Hidden'}
              </span>
              <span class="stock-qty-badge ${stockClass}">${stockLabel}</span>
            </div>
          </div>
        </div>

        <div>
          ${variantBadge}
        </div>

        <div class="admin-product-pricing-row">
          <span style="font-size: 11px; color: var(--muted); text-transform: uppercase; font-weight: 600;">Retail Price</span>
          <strong class="price-val">${money(p.price_paise)}</strong>
        </div>

        <div class="product-item-actions">
          <button type="button" class="btn-action btn-edit" data-edit="${p.id}" title="Edit piece details &amp; photos">
            <span class="btn-icon">✏️</span>
            <span>Edit</span>
          </button>
          <button type="button" class="btn-action ${p.is_published ? 'btn-unpublish' : 'btn-publish'}" data-toggle="${p.id}" data-published="${p.is_published}" title="${p.is_published ? 'Hide from live storefront' : 'Publish to live storefront'}">
            <span class="btn-icon">${p.is_published ? '👁️' : '🌐'}</span>
            <span>${p.is_published ? 'Unpublish' : 'Publish'}</span>
          </button>
          <button type="button" class="btn-action btn-delete" data-delete="${p.id}" data-name="${escapeHtml(p.name)}" title="Permanently delete piece">
            <span class="btn-icon">🗑️</span>
            <span>Delete</span>
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadProducts() {
  if (!isSupabaseConfigured) return;
  if (inventory) {
    inventory.innerHTML = `
      <div class="loading-box" style="grid-column: 1 / -1;">
        <div class="spinner"></div>
        <p>Loading pieces from database…</p>
      </div>
    `;
  }
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    if (inventory) {
      inventory.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p><p class="hint">Confirm that your account is listed in store_admins and the RLS policies are installed.</p>`;
    }
    return;
  }
  productsList = data || [];
  renderAdminProducts();
  populateOrderProductDropdown();
  renderStockMonitor();
}

inventory.addEventListener("click", async e => {
  const edit = e.target.closest("[data-edit]");
  const toggle = e.target.closest("[data-toggle]");
  const del = e.target.closest("[data-delete]");

  if (edit) {
    const { data, error } = await supabase.from("products").select("*").eq("id", edit.dataset.edit).single();
    if (error) return message(productMessage, error.message, true);
    fields.id.value = data.id;
    fields.name.value = data.name;
    fields.slug.value = data.slug;
    fields.description.value = data.description || "";
    fields.category.value = data.category;
    fields.price.value = (data.price_paise / 100).toFixed(2);
    fields.colours.value = (data.colours || []).join(", ");
    fields.stock.value = data.stock;
    fields.published.checked = data.is_published;
    fields.images.value = "";
    clearImageList();
    if (Array.isArray(data.image_urls)) {
      imageList = data.image_urls.map(url => ({
        type: "existing",
        url,
        previewUrl: url,
        name: url.split("/").pop() || "Product image"
      }));
    }
    renderImagePreviews();
    formTitle.textContent = `Edit: ${data.name}`;
    if (productFormPanel) {
      productFormPanel.hidden = false;
      productFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    switchTab("products");
  }

  if (toggle) {
    const publish = toggle.dataset.published !== "true";
    const prodId = toggle.dataset.toggle;
    const prod = productsList.find(x => x.id === prodId);
    const prodName = prod ? prod.name : "piece";
    message(productMessage, `${publish ? 'Publishing' : 'Unpublishing'} "${prodName}"…`);
    const { error } = await supabase.from("products").update({ is_published: publish, updated_at: new Date().toISOString() }).eq("id", prodId);
    if (error) {
      message(productMessage, error.message, true);
    } else {
      message(productMessage, `"${prodName}" is now ${publish ? 'Live on storefront ✓' : 'Hidden as draft'}.`);
    }
    await loadProducts();
  }

  if (del) {
    const id = del.dataset.delete;
    const name = del.dataset.name || "this product";
    if (!confirm(`Are you sure you want to permanently delete "${name}"?\n\nThis cannot be undone.`)) return;

    message(productMessage, `Deleting "${name}"…`);
    const { error: delError } = await supabase.from("products").delete().eq("id", id);
    if (delError) return message(productMessage, `Delete failed: ${delError.message}`, true);

    if (fields.id.value === id) {
      resetForm();
      if (productFormPanel) productFormPanel.hidden = true;
    }
    message(productMessage, `"${name}" was deleted successfully.`);
    await loadProducts();
  }
});

/* ==========================================================================
   ORDERS DASHBOARD CONTROLLER & LOGIC
   ========================================================================== */

const ordersContainer = document.querySelector("#orders-list-container");
const ordersMessage = document.querySelector("#orders-message");
const ordersSearchInput = document.querySelector("#orders-search");
const ordersFilterChips = document.querySelector("#orders-filter-chips");
const refreshOrdersBtn = document.querySelector("#refresh-orders");

async function loadOrders() {
  if (!isSupabaseConfigured) return;
  if (ordersContainer) {
    ordersContainer.innerHTML = `
      <div class="loading-box">
        <div class="spinner"></div>
        <p>Loading orders from database…</p>
      </div>
    `;
  }

  // 1. Fetch all orders
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.warn("Supabase orders query note:", ordersError.message);
    ordersList = [];
  } else {
    ordersList = orders || [];
  }

  // 2. Fetch line items for all orders in batch
  if (ordersList.length > 0) {
    const orderIds = ordersList.map(o => o.id);
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    orderItemsMap.clear();
    if (items) {
      for (const item of items) {
        if (!orderItemsMap.has(item.order_id)) {
          orderItemsMap.set(item.order_id, []);
        }
        orderItemsMap.get(item.order_id).push(item);
      }
    }
  } else {
    orderItemsMap.clear();
  }

  // 3. Merge locally cached orders (guarantees newly placed orders & payment proofs appear instantly)
  try {
    const localOrdersRaw = localStorage.getItem("saloriya_local_orders");
    if (localOrdersRaw) {
      const localOrders = JSON.parse(localOrdersRaw);
      for (const lo of localOrders) {
        if (!ordersList.some(o => o.id === lo.id)) {
          ordersList.unshift(lo);
        }
        if (lo.items && !orderItemsMap.has(lo.id)) {
          orderItemsMap.set(lo.id, lo.items);
        }
      }
    }
  } catch (e) {
    console.warn("Could not read local orders cache:", e);
  }

  updateMetrics();
  renderOrders();
}

function updateMetrics() {
  const totalCount = ordersList.length;
  const pendingCount = ordersList.filter(o => o.order_status === "pending").length;
  const confirmedCount = ordersList.filter(o => ["confirmed", "packed", "shipped"].includes(o.order_status)).length;
  const deliveredCount = ordersList.filter(o => o.order_status === "delivered").length;
  const cancelledCount = ordersList.filter(o => o.order_status === "cancelled").length;

  // Total sales: sum of total_paise for non-cancelled orders
  const revenuePaise = ordersList
    .filter(o => o.order_status !== "cancelled")
    .reduce((sum, o) => sum + (o.total_paise || 0), 0);

  // Update DOM elements
  const elTotal = document.querySelector("#metric-total-orders");
  const elPending = document.querySelector("#metric-pending-orders");
  const elConfirmed = document.querySelector("#metric-confirmed-orders");
  const elRevenue = document.querySelector("#metric-total-revenue");
  const pendingPulse = document.querySelector("#pending-pulse");
  const ordersBadge = document.querySelector("#orders-badge");

  if (elTotal) elTotal.textContent = totalCount;
  if (elPending) elPending.textContent = pendingCount;
  if (elConfirmed) elConfirmed.textContent = confirmedCount;
  if (elRevenue) elRevenue.textContent = money(revenuePaise);

  if (pendingPulse) pendingPulse.hidden = pendingCount === 0;

  if (ordersBadge) {
    if (pendingCount > 0) {
      ordersBadge.hidden = false;
      ordersBadge.textContent = `${pendingCount} pending`;
    } else if (totalCount > 0) {
      ordersBadge.hidden = false;
      ordersBadge.textContent = totalCount;
    } else {
      ordersBadge.hidden = true;
    }
  }

  // Filter chip counts
  const setChipCount = (id, count) => {
    const el = document.querySelector(id);
    if (el) el.textContent = count;
  };
  setChipCount("#count-all", totalCount);
  setChipCount("#count-pending", pendingCount);
  setChipCount("#count-confirmed", confirmedCount);
  setChipCount("#count-shipped", ordersList.filter(o => o.order_status === "shipped").length);
  setChipCount("#count-delivered", deliveredCount);
  setChipCount("#count-cancelled", cancelledCount);
}

function getFilteredOrders() {
  let list = ordersList;

  // Filter by status
  if (activeOrderFilter !== "all") {
    list = list.filter(o => o.order_status === activeOrderFilter);
  }

  // Search filter
  const q = orderSearchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(o => {
      const idMatch = (o.id || "").toLowerCase().includes(q);
      const nameMatch = (o.customer_name || "").toLowerCase().includes(q);
      const phoneMatch = (o.phone || "").toLowerCase().includes(q);
      const addressStr = typeof o.address === "object" ? JSON.stringify(o.address).toLowerCase() : String(o.address || "").toLowerCase();
      const addrMatch = addressStr.includes(q);

      // Check item products
      const items = orderItemsMap.get(o.id) || [];
      const itemMatch = items.some(it => (it.product_name || "").toLowerCase().includes(q) || (it.colour || "").toLowerCase().includes(q));

      return idMatch || nameMatch || phoneMatch || addrMatch || itemMatch;
    });
  }

  return list;
}

function renderOrders() {
  if (!ordersContainer) return;
  const filtered = getFilteredOrders();

  if (ordersList.length === 0) {
    ordersContainer.innerHTML = `
      <div class="empty-orders-box">
        <strong>No orders placed yet</strong>
        <p>When customers order on the website or via WhatsApp, their orders will appear right here.</p>
        <button class="button button-gold button-small" type="button" id="empty-record-order-btn">+ Record WhatsApp / Phone Order</button>
      </div>
    `;
    document.querySelector("#empty-record-order-btn")?.addEventListener("click", openRecordOrderModal);
    return;
  }

  if (filtered.length === 0) {
    ordersContainer.innerHTML = `
      <div class="empty-orders-box">
        <strong>No matching orders found</strong>
        <p>Try clearing your search query or selecting a different status filter.</p>
        <button class="button button-outline button-small" type="button" id="clear-orders-filter">Show all orders</button>
      </div>
    `;
    document.querySelector("#clear-orders-filter")?.addEventListener("click", () => {
      activeOrderFilter = "all";
      orderSearchQuery = "";
      if (ordersSearchInput) ordersSearchInput.value = "";
      ordersFilterChips?.querySelectorAll(".filter-chip").forEach(c => c.classList.toggle("active", c.dataset.status === "all"));
      renderOrders();
    });
    return;
  }

  ordersContainer.innerHTML = filtered.map(orderCard).join("");
}

function orderCard(order) {
  const items = orderItemsMap.get(order.id) || [];
  const shortId = (order.id || "").slice(0, 8).toUpperCase();
  const dateFormatted = order.created_at ? new Date(order.created_at).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }) : "Recent";

  // Address formatting
  let addressText = "";
  if (typeof order.address === "object" && order.address !== null) {
    const { street, city, state, pincode } = order.address;
    addressText = [street, city, state ? `${state} - ${pincode}` : pincode].filter(Boolean).join(", ");
  } else {
    addressText = String(order.address || "No address provided");
  }

  // Clean phone for WhatsApp link
  const cleanPhone = String(order.phone || "").replace(/\D/g, "");
  const waPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const waOrderMsg = encodeURIComponent(`Hello ${order.customer_name}! This is SALORIYA.\nYour order #${shortId} status is: ${order.order_status.toUpperCase()}.\nTotal: ${money(order.total_paise)}.\nThank you for choosing SALORIYA!`);
  const waUrl = `https://wa.me/${waPhone}?text=${waOrderMsg}`;

  // Status tag styling
  const statusClass = `status-tag-${order.order_status}`;
  const isPaid = order.payment_status === "paid";

  // Items HTML
  const itemsHtml = items.length ? items.map(item => {
    // Find matching product in current productsList
    const prod = productsList.find(p => p.id === item.product_id);
    const prodImage = prod?.image_urls?.[0] || "";
    const currentStock = prod ? Number(prod.stock) : null;

    let stockTag = "";
    if (currentStock !== null) {
      if (currentStock <= 0) {
        stockTag = `<span class="order-stock-indicator out-of-stock">❌ Out of stock (0 left)</span>`;
      } else if (currentStock <= 2) {
        stockTag = `<span class="order-stock-indicator low-stock">⚠️ Low stock: ${currentStock} left</span>`;
      } else {
        stockTag = `<span class="order-stock-indicator in-stock">✓ Current stock: ${currentStock}</span>`;
      }
    }

    const itemTotalPaise = (item.quantity || 1) * (item.unit_price_paise || 0);

    return `
      <div class="order-item-row" data-product-id="${item.product_id || ''}">
        <div class="order-item-thumb">
          ${prodImage ? `<img src="${escapeHtml(prodImage)}" alt="${escapeHtml(item.product_name)}" loading="lazy" />` : "S"}
        </div>
        <div class="order-item-details">
          <div class="order-item-title">${escapeHtml(item.product_name)}</div>
          <div class="order-item-meta">
            ${item.colour ? `<span class="item-colour-pill">Colour: ${escapeHtml(item.colour)}</span>` : ""}
            <span>Qty: <strong>${item.quantity}</strong></span>
            ${stockTag}
          </div>
        </div>
        <div class="order-item-pricing">
          <span class="order-item-qty">${money(item.unit_price_paise)} each</span>
          <span class="order-item-total">${money(itemTotalPaise)}</span>
        </div>
      </div>
    `;
  }).join("") : `<p class="hint">No item details recorded for this order.</p>`;

  // Action buttons depending on status
  let actionButtonsHtml = "";
  if (order.order_status === "pending") {
    const isAwaitingPayment = order.payment_method === "prepaid" && order.payment_status === "awaiting_verification";
    actionButtonsHtml = `
      <button type="button" class="button btn-confirm-order button-small" data-action="confirm" data-order-id="${order.id}">
        ${isAwaitingPayment ? '✓ Verify & Confirm (Deduct Stock)' : '✓ Confirm Order (Reduce Stock)'}
      </button>
      ${(order.payment_method === "prepaid" || order.address?.has_screenshot) ? `
        <button type="button" class="button button-outline button-small" data-action="view-screenshot" data-order-id="${order.id}" style="border-color:var(--wine);color:var(--wine);font-weight:600;">
          🖼️ Screenshot
        </button>
      ` : ''}
      <button type="button" class="button button-outline button-small" data-action="cancel" data-order-id="${order.id}">
        Cancel
      </button>
    `;
  } else if (order.order_status === "confirmed") {
    actionButtonsHtml = `
      ${(order.payment_method === "prepaid" || order.address?.has_screenshot) ? `
        <button type="button" class="button button-outline button-small" data-action="view-screenshot" data-order-id="${order.id}" style="border-color:var(--wine);color:var(--wine);font-weight:600;">
          🖼️ Screenshot
        </button>
      ` : ''}
      <button type="button" class="button button-dark button-small" data-action="ship" data-order-id="${order.id}">
        🚚 Mark as Shipped
      </button>
      <button type="button" class="button button-outline button-small" data-action="deliver" data-order-id="${order.id}">
        ✓ Mark Delivered
      </button>
      <button type="button" class="text-button delete-button" data-action="cancel-restore" data-order-id="${order.id}">
        Cancel (Restore Stock)
      </button>
    `;
  } else if (order.order_status === "shipped") {
    actionButtonsHtml = `
      ${(order.payment_method === "prepaid" || order.address?.has_screenshot) ? `
        <button type="button" class="button button-outline button-small" data-action="view-screenshot" data-order-id="${order.id}" style="border-color:var(--wine);color:var(--wine);font-weight:600;">
          🖼️ Screenshot
        </button>
      ` : ''}
      <button type="button" class="button button-dark button-small" data-action="deliver" data-order-id="${order.id}">
        ✓ Mark Delivered
      </button>
      <button type="button" class="text-button delete-button" data-action="cancel-restore" data-order-id="${order.id}">
        Cancel (Restore Stock)
      </button>
    `;
  } else if (order.order_status === "delivered") {
    actionButtonsHtml = `
      <span class="status-tag status-tag-delivered">Order Completed ✓</span>
      ${(order.payment_method === "prepaid" || order.address?.has_screenshot) ? `
        <button type="button" class="button button-outline button-small" data-action="view-screenshot" data-order-id="${order.id}" style="margin-left:6px;font-size:11px;">
          🖼️ Screenshot
        </button>
      ` : ''}
    `;
  } else if (order.order_status === "cancelled") {
    actionButtonsHtml = `
      <span class="status-tag status-tag-cancelled">Order Cancelled</span>
      <button type="button" class="text-button" data-action="reopen" data-order-id="${order.id}">Re-open as Pending</button>
    `;
  }

  return `
    <article class="order-card" data-order-id="${order.id}">
      <header class="order-card-header">
        <div class="order-header-left">
          <span class="order-id-badge" title="Click to copy full order ID" data-copy-id="${order.id}">
            #${shortId} 📋
          </span>
          <span class="order-date">${dateFormatted}</span>
        </div>
        <div class="order-badges-group">
          <span class="status-tag ${statusClass}">
            ● ${order.order_status}
          </span>
          <span class="payment-tag ${isPaid ? 'paid' : (order.payment_status === 'awaiting_verification' ? 'awaiting' : '')}" style="${order.payment_status === 'awaiting_verification' ? 'background:#fef3c7;color:#92400e;border:1px solid #f59e0b;' : ''}">
            ${order.payment_status === 'awaiting_verification' ? '⚠️ PENDING PAYMENT VERIFICATION' : `${order.payment_method?.toUpperCase()} · ${order.payment_status?.toUpperCase()}`}
          </span>
        </div>
      </header>

      <div class="order-card-body">
        <!-- Customer & Delivery Column -->
        <div class="order-customer-col">
          <span class="order-section-subtitle">Customer &amp; Shipping</span>
          <h4 class="order-customer-name">${escapeHtml(order.customer_name)}</h4>
          <div class="order-phone-row">
            <span class="order-phone-number">📞 ${escapeHtml(order.phone)}</span>
            <a href="${waUrl}" target="_blank" rel="noopener,noreferrer" class="order-whatsapp-link" title="Open WhatsApp chat with prefilled order details">
              WhatsApp ↗
            </a>
          </div>
          <div class="order-address-snippet">
            <strong>Delivery Address:</strong><br/>
            ${escapeHtml(addressText)}
            ${(order.payment_method === 'prepaid' || order.address?.has_screenshot || order.payment_status === 'awaiting_verification') ? `
              <div class="order-screenshot-banner" style="margin-top:8px;">
                <button type="button" class="button button-small btn-view-screenshot" data-action="view-screenshot" data-order-id="${order.id}" style="background:#861e38;color:#ffffff;border:none;padding:6px 12px;font-size:11.5px;font-weight:600;border-radius:6px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 6px rgba(134,30,56,0.2);">
                  🖼️ View Payment Screenshot
                </button>
              </div>
            ` : ""}
            ${order.address?.utr_ref ? `
              <div class="order-utr-badge" style="margin-top:6px;background:#fef3c7;border:1px dashed #d97706;padding:4px 8px;border-radius:4px;font-size:11px;color:#92400e;">
                <strong>⚡ Bank UPI UTR / Ref:</strong> <code style="font-weight:700;">${escapeHtml(order.address.utr_ref)}</code>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- Ordered Products Column (Which product was ordered) -->
        <div class="order-items-col">
          <span class="order-section-subtitle">Ordered Product Pieces (${items.length})</span>
          <div class="order-items-list">
            ${itemsHtml}
          </div>
        </div>
      </div>

      <footer class="order-card-footer">
        <div class="order-total-block">
          <span>Order Total:</span>
          <strong class="order-total-amount">${money(order.total_paise)}</strong>
        </div>

        <div class="order-actions-group">
          ${actionButtonsHtml}
          <select class="btn-status-change" data-status-select="${order.id}" title="Manually change status">
            <option value="" disabled selected>Change status…</option>
            <option value="pending" ${order.order_status === "pending" ? "disabled" : ""}>Pending</option>
            <option value="confirmed" ${order.order_status === "confirmed" ? "disabled" : ""}>Confirmed (Deduct Stock)</option>
            <option value="shipped" ${order.order_status === "shipped" ? "disabled" : ""}>Shipped</option>
            <option value="delivered" ${order.order_status === "delivered" ? "disabled" : ""}>Delivered</option>
            <option value="cancelled" ${order.order_status === "cancelled" ? "disabled" : ""}>Cancelled</option>
          </select>
          <button type="button" class="button btn-delete-order button-small" data-action="delete-order" data-order-id="${order.id}" title="Permanently delete this order record">
            🗑️ Delete
          </button>
        </div>
      </footer>
    </article>
  `;
}

// Order Actions Event Delegation
ordersContainer?.addEventListener("click", async e => {
  // Copy Order ID
  const copyBtn = e.target.closest("[data-copy-id]");
  if (copyBtn) {
    const fullId = copyBtn.dataset.copyId;
    navigator.clipboard?.writeText(fullId);
    const orig = copyBtn.textContent;
    copyBtn.textContent = "Copied! ✓";
    setTimeout(() => { copyBtn.textContent = orig; }, 1400);
    return;
  }

  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const action = actionBtn.dataset.action;
  const orderId = actionBtn.dataset.orderId;

  if (action === "view-screenshot") {
    openScreenshotModal(orderId);
  } else if (action === "confirm") {
    await confirmOrderAndReduceStock(orderId);
  } else if (action === "cancel") {
    await updateOrderStatus(orderId, "cancelled");
  } else if (action === "cancel-restore") {
    await cancelOrderWithStockRestore(orderId);
  } else if (action === "ship") {
    await updateOrderStatus(orderId, "shipped");
  } else if (action === "deliver") {
    await updateOrderStatus(orderId, "delivered");
  } else if (action === "reopen") {
    await updateOrderStatus(orderId, "pending");
  } else if (action === "delete-order") {
    await deleteOrderRecord(orderId, actionBtn);
  }
});

// Status change dropdown
ordersContainer?.addEventListener("change", async e => {
  const select = e.target.closest("[data-status-select]");
  if (!select || !select.value) return;

  const orderId = select.dataset.statusSelect;
  const newStatus = select.value;
  select.value = ""; // reset dropdown

  if (newStatus === "confirmed") {
    await confirmOrderAndReduceStock(orderId);
  } else if (newStatus === "cancelled") {
    await cancelOrderWithStockRestore(orderId);
  } else {
    await updateOrderStatus(orderId, newStatus);
  }
});

/* ==========================================================================
   ORDER CONFIRMATION & AUTOMATIC STOCK REDUCTION
   ========================================================================== */

async function confirmOrderAndReduceStock(orderId) {
  const order = ordersList.find(o => o.id === orderId);
  if (!order) return;

  if (order.order_status === "confirmed") {
    alert("This order has already been confirmed!");
    return;
  }

  const items = orderItemsMap.get(orderId) || [];
  if (!items.length) {
    alert("No items found in this order.");
    return;
  }

  // Pre-validate stock for each item
  const stockWarnings = [];
  for (const item of items) {
    if (item.product_id) {
      const prod = productsList.find(p => p.id === item.product_id);
      if (prod) {
        if (prod.stock < item.quantity) {
          stockWarnings.push(`• "${prod.name}" has only ${prod.stock} in stock, but this order is for ${item.quantity}. Confirming will set stock to 0.`);
        }
      }
    }
  }

  let confirmPrompt = `Confirm Order #${order.id.slice(0, 8).toUpperCase()}?\n\nThis will automatically REDUCE the stock for each product in your database according to the order items.`;
  if (stockWarnings.length > 0) {
    confirmPrompt = `⚠️ STOCK INVENTORY WARNING:\n\n${stockWarnings.join("\n")}\n\nDo you still want to proceed and confirm this order?`;
  }

  if (!confirm(confirmPrompt)) return;

  message(ordersMessage, "Confirming order and reducing product stock in database…");

  const stockReductionsSummary = [];

  // Deduct stock for each item
  for (const item of items) {
    if (item.product_id) {
      // Re-fetch current product from Supabase to prevent race conditions
      const { data: latestProd, error: fetchErr } = await supabase
        .from("products")
        .select("id, name, stock")
        .eq("id", item.product_id)
        .single();

      if (latestProd && !fetchErr) {
        const currentStock = Number(latestProd.stock) || 0;
        const qtyOrdered = Number(item.quantity) || 1;
        const newStock = Math.max(0, currentStock - qtyOrdered);

        const { error: stockUpdateErr } = await supabase
          .from("products")
          .update({
            stock: newStock,
            updated_at: new Date().toISOString()
          })
          .eq("id", item.product_id);

        if (stockUpdateErr) {
          console.error(`Failed to reduce stock for product ${item.product_id}:`, stockUpdateErr);
        } else {
          stockReductionsSummary.push(`${latestProd.name}: ${currentStock} → ${newStock} (${qtyOrdered} deducted)`);
        }
      }
    }
  }

  // Update order status in orders table (and mark payment_status as paid if prepaid)
  const updatePayload = {
    order_status: "confirmed"
  };
  if (order.payment_method === "prepaid") {
    updatePayload.payment_status = "paid";
  }

  const { error: orderStatusErr } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (orderStatusErr) {
    message(ordersMessage, `Failed to update order status: ${orderStatusErr.message}`, true);
    return;
  }

  message(ordersMessage, `✓ Order #${order.id.slice(0, 8).toUpperCase()} Confirmed! Stock updated: ${stockReductionsSummary.join(" | ") || "Stock reduced successfully."}`);

  // Refresh both products and orders
  await Promise.all([loadProducts(), loadOrders()]);
  renderStockMonitor();
}

async function cancelOrderWithStockRestore(orderId) {
  const order = ordersList.find(o => o.id === orderId);
  if (!order) return;

  const wasStockDeducted = ["confirmed", "packed", "shipped"].includes(order.order_status);
  const items = orderItemsMap.get(orderId) || [];

  let shouldRestoreStock = false;
  if (wasStockDeducted && items.length > 0) {
    shouldRestoreStock = confirm(
      `Cancel Order #${order.id.slice(0, 8).toUpperCase()}?\n\nThis order was previously confirmed and deducted stock.\n\nDo you want to RESTORE the stock back into inventory (+ quantity back to products)?`
    );
  } else {
    if (!confirm(`Are you sure you want to cancel order #${order.id.slice(0, 8).toUpperCase()}?`)) return;
  }

  message(ordersMessage, "Cancelling order…");

  if (shouldRestoreStock) {
    for (const item of items) {
      if (item.product_id) {
        const { data: latestProd } = await supabase
          .from("products")
          .select("id, name, stock")
          .eq("id", item.product_id)
          .single();

        if (latestProd) {
          const currentStock = Number(latestProd.stock) || 0;
          const qty = Number(item.quantity) || 1;
          const newStock = currentStock + qty;

          await supabase
            .from("products")
            .update({
              stock: newStock,
              updated_at: new Date().toISOString()
            })
            .eq("id", item.product_id);
        }
      }
    }
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: "cancelled" })
    .eq("id", orderId);

  if (error) {
    message(ordersMessage, `Cancel failed: ${error.message}`, true);
    return;
  }

  message(ordersMessage, `Order #${order.id.slice(0, 8).toUpperCase()} cancelled.${shouldRestoreStock ? " Product stock was restored back to inventory." : ""}`);
  await Promise.all([loadProducts(), loadOrders()]);
  renderStockMonitor();
}

function removeLocalOrder(orderId) {
  try {
    const list = JSON.parse(localStorage.getItem("saloriya_local_orders") || "[]");
    const filtered = list.filter(o => o.id !== orderId);
    localStorage.setItem("saloriya_local_orders", JSON.stringify(filtered));
  } catch (e) {
    // ignore
  }
}

function updateLocalOrderStatus(orderId, newStatus, newPaymentStatus) {
  try {
    const list = JSON.parse(localStorage.getItem("saloriya_local_orders") || "[]");
    const target = list.find(o => o.id === orderId);
    if (target) {
      if (newStatus) target.order_status = newStatus;
      if (newPaymentStatus) target.payment_status = newPaymentStatus;
      localStorage.setItem("saloriya_local_orders", JSON.stringify(list));
    }
  } catch (e) {
    // ignore
  }
}

async function updateOrderStatus(orderId, newStatus) {
  message(ordersMessage, `Updating status to ${newStatus}…`);
  updateLocalOrderStatus(orderId, newStatus);

  const { error } = await supabase
    .from("orders")
    .update({ order_status: newStatus })
    .eq("id", orderId);

  if (error) {
    console.warn("Update note:", error.message);
  }

  message(ordersMessage, `Order status changed to ${newStatus}.`);
  await loadOrders();
}

async function deleteOrderRecord(orderId, btnEl) {
  const shortId = (orderId || "").slice(0, 8).toUpperCase();
  const orderCardEl = document.querySelector(`.order-card[data-order-id="${orderId}"]`);
  const delBtn = btnEl || orderCardEl?.querySelector("[data-action='delete-order']");

  // Step 0: Two-step inline confirmation (Prevents popup blocker / browser prompt suppression)
  if (!delBtn?.dataset.confirmed) {
    if (delBtn) {
      delBtn.dataset.confirmed = "true";
      delBtn.textContent = "Confirm Delete? ⚠️";
      delBtn.style.background = "#fee2e2";
      delBtn.style.color = "#991b1b";
      delBtn.style.borderColor = "#f87171";
      setTimeout(() => {
        if (delBtn && delBtn.dataset.confirmed === "true") {
          delete delBtn.dataset.confirmed;
          delBtn.textContent = "🗑️ Delete";
          delBtn.style.background = "";
          delBtn.style.color = "";
          delBtn.style.borderColor = "";
        }
      }, 4000);
    }
    return;
  }

  // Confirmed!
  if (delBtn) {
    delBtn.disabled = true;
    delBtn.textContent = "Deleting…";
  }
  message(ordersMessage, `Deleting order #${shortId}…`);

  try {
    // Step 1: Attempt to delete associated order_items and order in Supabase
    try {
      await supabase.from("order_items").delete().eq("order_id", orderId);
      const { error: orderErr } = await supabase.from("orders").delete().eq("id", orderId);
      if (orderErr) {
        console.warn("Remote delete note:", orderErr.message);
      }
    } catch (apiErr) {
      console.warn("Remote delete API error:", apiErr);
    }

    // Step 2: Remove from local orders and screenshot storage
    removeLocalOrder(orderId);
    try {
      localStorage.removeItem(`saloriya_screenshot_${orderId}`);
    } catch {
      // ignore
    }

    // Step 3: Immediate local state update and DOM removal
    ordersList = ordersList.filter(o => o.id !== orderId);
    orderItemsMap.delete(orderId);
    orderCardEl?.remove();
    updateMetrics();
    renderOrders();

    message(ordersMessage, `✓ Order #${shortId} was permanently deleted.`);

    // Background refresh
    await loadOrders();
  } catch (err) {
    console.error("Unexpected delete error:", err);
    message(ordersMessage, `Delete error: ${err.message}`, true);
    if (delBtn) {
      delBtn.disabled = false;
      delBtn.textContent = "🗑️ Delete";
    }
  }
}

// Toolbar search & status filters
ordersSearchInput?.addEventListener("input", e => {
  orderSearchQuery = e.target.value;
  renderOrders();
});

ordersFilterChips?.addEventListener("click", e => {
  const chip = e.target.closest(".filter-chip");
  if (!chip) return;
  activeOrderFilter = chip.dataset.status;
  ordersFilterChips.querySelectorAll(".filter-chip").forEach(c => c.classList.toggle("active", c === chip));
  renderOrders();
});

refreshOrdersBtn?.addEventListener("click", async () => {
  message(ordersMessage, "Refreshing orders…");
  await Promise.all([loadProducts(), loadOrders()]);
  message(ordersMessage, "Orders refreshed.");
  setTimeout(() => message(ordersMessage, ""), 2500);
});

/* ==========================================================================
   ADMIN PAYMENT SCREENSHOT MODAL CONTROLLER
   ========================================================================== */

const adminScreenshotModal = document.querySelector("#admin-screenshot-modal");
const closeScreenshotModalBtn = document.querySelector("#close-screenshot-modal-btn");
const screenshotModalBackdrop = document.querySelector("#screenshot-modal-backdrop");
const screenshotModalTitle = document.querySelector("#screenshot-modal-title");
const screenshotModalImg = document.querySelector("#screenshot-modal-img");
const screenshotModalPlaceholder = document.querySelector("#screenshot-modal-placeholder");
const screenshotModalWaLink = document.querySelector("#screenshot-modal-wa-link");
const screenshotCustomerName = document.querySelector("#screenshot-customer-name");
const screenshotCustomerPhone = document.querySelector("#screenshot-customer-phone");
const screenshotOrderTotal = document.querySelector("#screenshot-order-total");
const screenshotModalVerifyBtn = document.querySelector("#screenshot-modal-verify-btn");
const adminAttachScreenshotInput = document.querySelector("#admin-attach-screenshot-input");

let currentScreenshotOrderId = null;

function openScreenshotModal(orderId) {
  if (!adminScreenshotModal) return;
  const order = ordersList.find(o => o.id === orderId);
  if (!order) return;

  currentScreenshotOrderId = orderId;
  const shortId = (order.id || "").slice(0, 8).toUpperCase();

  if (screenshotModalTitle) screenshotModalTitle.textContent = `Payment Proof · Order #${shortId}`;
  if (screenshotCustomerName) screenshotCustomerName.textContent = order.customer_name || "Customer";
  if (screenshotCustomerPhone) screenshotCustomerPhone.textContent = order.phone || "No phone";
  if (screenshotOrderTotal) screenshotOrderTotal.textContent = money(order.total_paise);

  const cleanPhone = String(order.phone || "").replace(/\D/g, "");
  const waPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
  const waMsg = encodeURIComponent(`Hello ${order.customer_name}! This is SALORIYA regarding your order #${shortId} (${money(order.total_paise)}).\nPlease share your payment receipt screenshot with us for verification.`);
  if (screenshotModalWaLink) screenshotModalWaLink.href = `https://wa.me/${waPhone}?text=${waMsg}`;

  // Retrieve customer payment screenshot (from address object in database or local storage fallback)
  const savedProof = order.address?.screenshot_data ||
    order.address?.screenshot_url ||
    localStorage.getItem(`saloriya_screenshot_${orderId}`) ||
    (order.id === localStorage.getItem("saloriya_latest_order_id") ? localStorage.getItem("saloriya_latest_screenshot") : null) ||
    localStorage.getItem("saloriya_latest_screenshot");

  if (savedProof) {
    if (screenshotModalImg) {
      screenshotModalImg.src = savedProof;
      screenshotModalImg.style.display = "block";
    }
    if (screenshotModalPlaceholder) screenshotModalPlaceholder.style.display = "none";
  } else {
    if (screenshotModalImg) {
      screenshotModalImg.src = "";
      screenshotModalImg.style.display = "none";
    }
    if (screenshotModalPlaceholder) screenshotModalPlaceholder.style.display = "block";
  }

  // Configure action button in screenshot modal
  if (screenshotModalVerifyBtn) {
    if (order.order_status === "pending") {
      screenshotModalVerifyBtn.style.display = "inline-flex";
      screenshotModalVerifyBtn.textContent = "✓ Confirm Order (Deduct Stock)";
      screenshotModalVerifyBtn.onclick = async () => {
        closeScreenshotModal();
        await confirmOrderAndReduceStock(orderId);
      };
    } else if (order.order_status === "confirmed") {
      screenshotModalVerifyBtn.style.display = "inline-flex";
      screenshotModalVerifyBtn.textContent = "🚚 Mark as Shipped";
      screenshotModalVerifyBtn.onclick = async () => {
        closeScreenshotModal();
        await updateOrderStatus(orderId, "shipped");
      };
    } else {
      screenshotModalVerifyBtn.style.display = "none";
    }
  }

  adminScreenshotModal.hidden = false;
}

function closeScreenshotModal() {
  if (!adminScreenshotModal) return;
  adminScreenshotModal.hidden = true;
  if (screenshotModalImg) screenshotModalImg.src = "";
  currentScreenshotOrderId = null;
}

closeScreenshotModalBtn?.addEventListener("click", closeScreenshotModal);
screenshotModalBackdrop?.addEventListener("click", closeScreenshotModal);
window.addEventListener("keydown", e => {
  if (e.key === "Escape" && adminScreenshotModal && !adminScreenshotModal.hidden) {
    closeScreenshotModal();
  }
});

adminAttachScreenshotInput?.addEventListener("change", e => {
  const file = e.target.files?.[0];
  if (!file || !currentScreenshotOrderId) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    try {
      localStorage.setItem(`saloriya_screenshot_${currentScreenshotOrderId}`, dataUrl);
    } catch (err) {
      console.warn("Could not save to localStorage:", err);
    }
    if (screenshotModalImg) {
      screenshotModalImg.src = dataUrl;
      screenshotModalImg.style.display = "block";
    }
    if (screenshotModalPlaceholder) screenshotModalPlaceholder.style.display = "none";
  };
  reader.readAsDataURL(file);
  e.target.value = "";
});

/* ==========================================================================
   RECORD / CREATE NEW ORDER MODAL CONTROLLER
   ========================================================================== */

const recordOrderModal = document.querySelector("#record-order-modal");
const openRecordOrderBtn = document.querySelector("#open-record-order-btn");
const openRecordOrderBtnToolbar = document.querySelector("#record-order-btn-toolbar");
const recordOrderForm = document.querySelector("#record-order-form");
const recordOrderMessage = document.querySelector("#record-order-message");

const orderProductSelect = document.querySelector("#order-form-product");
const orderColourSelect = document.querySelector("#order-form-colour");
const orderQtyInput = document.querySelector("#order-form-qty");
const orderPriceInput = document.querySelector("#order-form-price");
const orderLiveStockSpan = document.querySelector("#order-product-live-stock");
const orderCalcTotalSpan = document.querySelector("#order-calc-total");

function openRecordOrderModal() {
  if (!recordOrderModal) return;
  recordOrderModal.hidden = false;
  populateOrderProductDropdown();
  message(recordOrderMessage, "");
}

function closeRecordOrderModal() {
  if (!recordOrderModal) return;
  recordOrderModal.hidden = true;
  recordOrderForm?.reset();
  message(recordOrderMessage, "");
}

openRecordOrderBtn?.addEventListener("click", openRecordOrderModal);
openRecordOrderBtnToolbar?.addEventListener("click", openRecordOrderModal);

document.querySelectorAll("[data-close-order-modal]").forEach(btn => {
  btn.addEventListener("click", closeRecordOrderModal);
});

function populateOrderProductDropdown() {
  if (!orderProductSelect) return;
  const currentVal = orderProductSelect.value;
  orderProductSelect.innerHTML = `<option value="">-- Choose jewellery piece --</option>` +
    productsList.map(p => `
      <option value="${p.id}" data-price="${(p.price_paise / 100).toFixed(2)}" data-stock="${p.stock}">
        ${escapeHtml(p.name)} (Stock: ${p.stock} · ₹${(p.price_paise / 100).toFixed(2)})
      </option>
    `).join("");

  if (currentVal) orderProductSelect.value = currentVal;
}

function updateOrderModalCalculations() {
  const selectedOption = orderProductSelect?.selectedOptions[0];
  const prod = productsList.find(p => p.id === orderProductSelect?.value);

  if (!prod) {
    if (orderLiveStockSpan) orderLiveStockSpan.textContent = "—";
    if (orderCalcTotalSpan) orderCalcTotalSpan.textContent = "₹0";
    return;
  }

  // Update colour dropdown
  const colours = prod.colours || [];
  if (orderColourSelect) {
    if (colours.length > 0) {
      orderColourSelect.innerHTML = colours.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
    } else {
      orderColourSelect.innerHTML = `<option value="Standard">Standard</option>`;
    }
  }

  // Unit price default
  if (orderPriceInput && (!orderPriceInput.value || orderPriceInput.dataset.autoFilled !== "false")) {
    orderPriceInput.value = (prod.price_paise / 100).toFixed(2);
  }

  // Stock indicator
  if (orderLiveStockSpan) {
    const isOut = prod.stock <= 0;
    orderLiveStockSpan.innerHTML = isOut
      ? `<span style="color:#c62828">Out of stock (0)</span>`
      : `<span style="color:#2e7d32">${prod.stock} units available</span>`;
  }

  // Calculate total
  const qty = Number(orderQtyInput?.value) || 1;
  const unitPrice = Number(orderPriceInput?.value) || (prod.price_paise / 100);
  const total = qty * unitPrice;
  if (orderCalcTotalSpan) {
    orderCalcTotalSpan.textContent = money(Math.round(total * 100));
  }
}

orderProductSelect?.addEventListener("change", () => {
  if (orderPriceInput) delete orderPriceInput.dataset.autoFilled;
  updateOrderModalCalculations();
});
orderQtyInput?.addEventListener("input", updateOrderModalCalculations);
orderPriceInput?.addEventListener("input", () => {
  if (orderPriceInput) orderPriceInput.dataset.autoFilled = "false";
  updateOrderModalCalculations();
});

recordOrderForm?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!isSupabaseConfigured) return;

  const fd = new FormData(recordOrderForm);
  const productId = fd.get("productId");
  const colour = String(fd.get("colour") || "Standard").trim();
  const quantity = Number(fd.get("quantity")) || 1;
  const unitPrice = Number(fd.get("unitPrice")) || 0;
  const customerName = String(fd.get("customerName") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  const street = String(fd.get("street") || "").trim();
  const city = String(fd.get("city") || "").trim();
  const state = String(fd.get("state") || "Tamil Nadu").trim();
  const pincode = String(fd.get("pincode") || "").trim();
  const paymentMethod = String(fd.get("paymentMethod") || "cod");
  const paymentStatus = String(fd.get("paymentStatus") || "pending");
  const orderStatus = String(fd.get("orderStatus") || "confirmed");

  const prod = productsList.find(p => p.id === productId);
  if (!prod) {
    return message(recordOrderMessage, "Please select a product from the list.", true);
  }

  if (quantity <= 0) {
    return message(recordOrderMessage, "Quantity must be at least 1.", true);
  }

  const unitPricePaise = Math.round(unitPrice * 100);
  const totalPaise = unitPricePaise * quantity;

  message(recordOrderMessage, "Creating order in database…");

  // 1. Insert Order
  const { data: newOrder, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_name: customerName,
      phone,
      address: {
        street,
        city,
        state,
        pincode
      },
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      order_status: orderStatus,
      total_paise: totalPaise
    })
    .select()
    .single();

  if (orderErr) {
    return message(recordOrderMessage, `Failed to create order: ${orderErr.message}`, true);
  }

  // 2. Insert Order Item
  const { error: itemErr } = await supabase
    .from("order_items")
    .insert({
      order_id: newOrder.id,
      product_id: prod.id,
      product_name: prod.name,
      colour,
      quantity,
      unit_price_paise: unitPricePaise
    });

  if (itemErr) {
    console.error("Order item insertion error:", itemErr);
  }

  // 3. If initial status is "confirmed", reduce stock immediately!
  let stockMsg = "";
  if (orderStatus === "confirmed") {
    const currentStock = Number(prod.stock) || 0;
    const newStock = Math.max(0, currentStock - quantity);

    const { error: stockErr } = await supabase
      .from("products")
      .update({
        stock: newStock,
        updated_at: new Date().toISOString()
      })
      .eq("id", prod.id);

    if (stockErr) {
      console.error("Stock update error:", stockErr);
      stockMsg = " (Warning: failed to reduce stock)";
    } else {
      stockMsg = ` (Stock reduced from ${currentStock} to ${newStock})`;
    }
  }

  message(recordOrderMessage, `✓ Order created successfully!${stockMsg}`);

  setTimeout(() => {
    closeRecordOrderModal();
  }, 1200);

  await Promise.all([loadProducts(), loadOrders()]);
  renderStockMonitor();
});

/* ==========================================================================
   LIVE STOCK & INVENTORY MONITOR TABLE
   ========================================================================== */

const stockTableWrap = document.querySelector("#inventory-stock-table-wrap");
const refreshStockTableBtn = document.querySelector("#refresh-stock-table");

function renderStockMonitor() {
  if (!stockTableWrap) return;
  if (!productsList.length) {
    stockTableWrap.innerHTML = "<p class='hint'>No products available. Add pieces in the Product Studio.</p>";
    return;
  }

  stockTableWrap.innerHTML = `
    <table class="stock-table">
      <thead>
        <tr>
          <th>Jewellery Piece</th>
          <th>Category</th>
          <th>Price</th>
          <th>Colours</th>
          <th>Current Stock</th>
          <th>Status</th>
          <th>Quick Restock</th>
        </tr>
      </thead>
      <tbody>
        ${productsList.map(p => {
          const stockClass = p.stock <= 0 ? "out-of-stock" : p.stock <= 3 ? "low-stock" : "in-stock";
          const stockLabel = p.stock <= 0 ? "Out of stock" : p.stock <= 3 ? "Low stock" : "In stock";
          const thumb = p.image_urls?.[0] || "";

          return `
            <tr data-product-row="${p.id}">
              <td>
                <div class="stock-item-cell">
                  ${thumb ? `<img src="${escapeHtml(thumb)}" alt="" class="stock-table-thumb" />` : `<div class="stock-table-thumb" style="display:grid;place-items:center;color:var(--wine);font-family:serif;font-size:18px;">S</div>`}
                  <div>
                    <strong>${escapeHtml(p.name)}</strong>
                    <div style="font-size:10px;color:var(--muted);">${p.slug}</div>
                  </div>
                </div>
              </td>
              <td>${escapeHtml(p.category)}</td>
              <td><strong>${money(p.price_paise)}</strong></td>
              <td><span style="font-size:11px;">${(p.colours || []).join(", ") || "—"}</span></td>
              <td>
                <span class="stock-qty-badge ${stockClass}">
                  ${p.stock} units
                </span>
              </td>
              <td>
                <span style="font-size:11px;font-weight:600;color:${p.is_published ? '#15803d' : '#82636c'};">
                  ${p.is_published ? "● Published" : "○ Draft"}
                </span>
              </td>
              <td>
                <div class="quick-restock-cell">
                  <input type="number" class="quick-restock-input" min="0" step="1" value="${p.stock}" data-restock-input="${p.id}" />
                  <button type="button" class="quick-restock-btn" data-restock-btn="${p.id}" title="Save new stock count">Save</button>
                </div>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

stockTableWrap?.addEventListener("click", async e => {
  const btn = e.target.closest("[data-restock-btn]");
  if (!btn) return;
  const productId = btn.dataset.restockBtn;
  const input = stockTableWrap.querySelector(`[data-restock-input="${productId}"]`);
  if (!input) return;

  const newStock = Number(input.value);
  if (!Number.isInteger(newStock) || newStock < 0) {
    alert("Please enter a valid stock quantity (0 or greater).");
    return;
  }

  btn.textContent = "…";
  const { error } = await supabase
    .from("products")
    .update({ stock: newStock, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) {
    alert(`Failed to update stock: ${error.message}`);
    btn.textContent = "Save";
    return;
  }

  btn.textContent = "Saved ✓";
  setTimeout(() => { btn.textContent = "Save"; }, 1500);
  await loadProducts();
});

refreshStockTableBtn?.addEventListener("click", async () => {
  await loadProducts();
});

// Initialization
async function refreshSession() {
  if (!isSupabaseConfigured) {
    showSession(null);
    message(loginMessage, "Add your Supabase URL and publishable key in .env.local, then restart the dev server.", true);
    return;
  }
  const { data } = await supabase.auth.getSession();
  showSession(data.session);
  if (data.session) {
    await Promise.all([loadProducts(), loadOrders()]);
    renderStockMonitor();
  }
}

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    showSession(session);
    if (session) {
      loadProducts();
      loadOrders();
    }
  });
}

refreshSession();

