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

let currentImageUrls = [];

function renderImagePreviews() {
  if (!imagePreviews) return;
  if (!currentImageUrls.length) {
    imagePreviews.innerHTML = "";
    return;
  }
  imagePreviews.innerHTML = currentImageUrls.map((url, idx) => `
    <div class="image-preview-item">
      <img src="${escapeHtml(url)}" alt="Image #${idx + 1}">
      <button type="button" class="remove-img" data-remove-img="${idx}" title="Remove image">×</button>
      <span class="img-tag">#${idx + 1}</span>
    </div>
  `).join("");
}

imagePreviews?.addEventListener("click", e => {
  const btn = e.target.closest("[data-remove-img]");
  if (!btn) return;
  const idx = Number(btn.dataset.removeImg);
  if (!Number.isNaN(idx)) {
    currentImageUrls.splice(idx, 1);
    renderImagePreviews();
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
  currentImageUrls = [];
  renderImagePreviews();
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
  message(productMessage, "Saving product…");
  const existingId = String(fd.get("id") || "");
  const files = [...(fields.images.files || [])];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return message(productMessage, `${file.name} is not an image.`, true);
    if (file.size > 5 * 1024 * 1024) return message(productMessage, `${file.name} exceeds 5 MB. Please compress it first.`, true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) return message(productMessage, `Image upload failed: ${uploadError.message}`, true);
    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
    currentImageUrls.push(urlData.publicUrl);
  }
  const record = {
    name, slug, description: String(fd.get("description") || "").trim(),
    category: String(fd.get("category")), price_paise: Math.round(price * 100),
    colours: String(fd.get("colours") || "").split(",").map(x => x.trim()).filter(Boolean),
    stock, image_urls: currentImageUrls, is_published: fields.published.checked,
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
    currentImageUrls = [...(data.image_urls || [])];
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
