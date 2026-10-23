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
async function refreshSession() {
  if (!isSupabaseConfigured) {
    showSession(null);
    message(loginMessage, "Add your Supabase URL and publishable key in .env.local, then restart the dev server.", true);
    return;
  }
  const { data } = await supabase.auth.getSession();
  showSession(data.session);
  if (data.session) await loadProducts();
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
});

async function loadProducts() {
  if (!isSupabaseConfigured) return;
  inventory.textContent = "Loading products…";
  const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  if (error) {
    inventory.innerHTML = `<p class="form-message error">${escapeHtml(error.message)}</p><p class="hint">Confirm that your account is listed in store_admins and the RLS policies are installed.</p>`;
    return;
  }
  if (!data?.length) {
    inventory.innerHTML = "<p class='hint'>No products yet. Add your first piece using the form.</p>";
    return;
  }
  inventory.innerHTML = data.map(p => `<article class="inventory-item">
    <div class="inventory-thumb">${p.image_urls?.[0] ? `<img src="${escapeHtml(p.image_urls[0])}" alt="">` : "S"}</div>
    <div class="inventory-details"><strong>${escapeHtml(p.name)}</strong><span>${money(p.price_paise)} · Stock ${p.stock}</span><span>${p.is_published ? "Published" : "Draft"} · ${escapeHtml(p.category)}</span>
    <div class="inventory-actions">
      <button class="text-button" data-edit="${p.id}">Edit</button>
      <button class="text-button" data-toggle="${p.id}" data-published="${p.is_published}">${p.is_published ? "Unpublish" : "Publish"}</button>
      <button class="text-button delete-button" data-delete="${p.id}" data-name="${escapeHtml(p.name)}">Delete</button>
    </div></div>
  </article>`).join("");
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
    formTitle.textContent = "Edit this piece";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (toggle) {
    const publish = toggle.dataset.published !== "true";
    const { error } = await supabase.from("products").update({ is_published: publish, updated_at: new Date().toISOString() }).eq("id", toggle.dataset.toggle);
    if (error) message(productMessage, error.message, true);
    await loadProducts();
  }
  if (del) {
    const id = del.dataset.delete;
    const name = del.dataset.name || "this product";
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return;

    message(productMessage, `Deleting "${name}"…`);
    const { error: delError } = await supabase.from("products").delete().eq("id", id);
    if (delError) return message(productMessage, `Delete failed: ${delError.message}`, true);

    if (fields.id.value === id) {
      resetForm();
    }
    message(productMessage, `"${name}" was deleted successfully.`);
    await loadProducts();
  }
});
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => showSession(session));
}
refreshSession();
