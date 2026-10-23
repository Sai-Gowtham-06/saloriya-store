# SALORIYA Ecommerce Frontend

A responsive, static HTML/CSS/JavaScript storefront with an ivory, blush-pink and gold visual theme.

## Run locally
1. Extract `saloriya-store.zip`.
2. Open `index.html` in a browser. For the best experience, use VS Code with the Live Server extension.
3. The six uploaded product photos are in `assets/products/`.

## Before publishing
1. Open `script.js`.
2. Replace `WHATSAPP_NUMBER = "919876543210"` with your business WhatsApp number in international format, digits only. Example format for India: `91` + 10-digit mobile number.
3. Confirm product names, colours and ₹60 prices in the `products` array.
4. The newsletter is a demo only; connect it to an email service if you want to collect signups.
5. This is a frontend demo. It does not process payments, calculate shipping, manage inventory, or store orders in a backend. Cart contents are saved locally in the visitor's browser.

## Included
- Responsive mobile and desktop layout
- Product grid using the provided product photos
- Search by name/colour/description
- Colour filter and sorting
- Add-to-cart, quantity controls, remove item, subtotal
- WhatsApp order message with item list and subtotal
- Mobile navigation and shopping drawer
- Local-storage cart persistence

## Files
- `index.html` — page structure
- `styles.css` — theme and responsive layout
- `script.js` — products, filters, cart, WhatsApp ordering
- `assets/products/` — uploaded product photos
