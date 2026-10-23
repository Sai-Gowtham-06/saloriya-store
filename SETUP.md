# SALORIYA Store — Setup Guide

This is a starter storefront + admin product manager. It is not yet a complete production checkout. The storefront supports catalogue loading and WhatsApp product enquiries. Prepaid checkout and a secure order-creation endpoint must be implemented before accepting online payments.

## 1. Install and run locally

1. Install Node.js LTS and VS Code.
2. Extract this project folder.
3. Open the folder in VS Code.
4. In Terminal, run `npm install`.
5. Copy `.env.example` to `.env.local`.
6. Replace the URL and publishable key with values from Supabase → Project Settings / API Keys.
7. Run `npm run dev` and open the local URL shown in the terminal.

After changing `.env.local`, restart the dev server.

## 2. Create Supabase tables

Open Supabase → SQL Editor and run the following SQL.

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  description text not null default '',
  category text not null,
  price_paise integer not null check (price_paise >= 0),
  image_urls text[] not null default '{}',
  colours text[] not null default '{}',
  stock integer not null default 0 check (stock >= 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  phone text not null,
  address jsonb not null,
  payment_method text not null check (payment_method in ('prepaid', 'cod')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  order_status text not null default 'pending'
    check (order_status in ('pending', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  total_paise integer not null check (total_paise >= 0),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  colour text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price_paise integer not null check (unit_price_paise >= 0)
);

create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.store_admins a
    where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to authenticated;

alter table public.products enable row level security;
alter table public.store_admins enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Read published products"
on public.products for select to anon, authenticated
using (is_published = true or (select public.is_store_admin()));

create policy "Admin manages products"
on public.products for all to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

create policy "Admin reads own membership"
on public.store_admins for select to authenticated
using (user_id = (select auth.uid()));

-- Full order management for authenticated store admins
create policy "Admin manages orders"
on public.orders for all to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

create policy "Admin manages order items"
on public.order_items for all to authenticated
using ((select public.is_store_admin()))
with check ((select public.is_store_admin()));

-- Customer express checkout insertion (allows storefront visitors to submit orders)
create policy "Customers can place orders"
on public.orders for insert to anon, authenticated
with check (true);

create policy "Customers can insert order items"
on public.order_items for insert to anon, authenticated
with check (true);
```

### Orders & Automated Stock Deduction
When you confirm an order in the **Admin Orders Dashboard** (`admin.html`), the system:
1. Checks current product stock in Supabase.
2. Decrements `products.stock` by the ordered quantities: `stock = Math.max(0, currentStock - qty)`.
3. Marks the order as `confirmed` with a live toast notification.
4. If a confirmed order is later cancelled, the admin panel automatically prompts you with the option to restore the stock back to the inventory!

## 3. Create an admin user

1. Supabase → Authentication → Users → Add user.
2. Create a strong administrator email/password.
3. Copy the new user's UUID.
4. Run this SQL, replacing the placeholder with the UUID:

```sql
insert into public.store_admins (user_id)
values ('PASTE-ADMIN-USER-UUID-HERE');
```

Do not share the admin password or database password.

## 4. Create the product image bucket

1. Supabase → Storage → New bucket.
2. Name it `product-images`.
3. Set the bucket to public only if you want published product photos to be publicly viewable.
4. Add Storage policies that allow authenticated store admins to upload and manage objects. Public visitors should have read-only access to this bucket.

The admin uploader expects the bucket name `product-images`. Restrict file sizes and types at the storage/policy level as well as in the UI.

## 5. Add products

Open `/admin.html` on your local site, sign in with your admin user, and fill in the form. Price is entered in rupees; the code stores paise in the database. Separate colour names with commas. Publish to make a product visible in the public catalogue.

Use a unique slug with lowercase letters, numbers and hyphens, e.g. `golden-floral-earrings`.

## 6. WhatsApp orders

The current storefront opens WhatsApp with the selected product, selected colour and displayed price. This is a product enquiry, not a confirmed order or payment. Confirm stock, shipping charges and final price with the customer before accepting payment.

## 7. Before production launch — REQUIRED

- Implement a server-side order-creation function (e.g. Supabase Edge Function) that recalculates price from database records, validates quantities and colours, checks stock and safely creates the order and line items in a transaction.
- Reserve/decrement stock atomically to prevent overselling. Add idempotency to checkout.
- Integrate a payment gateway such as Razorpay using server-side order creation, signature verification and verified webhooks. Never trust a browser success callback alone.
- Ensure only verified payment events can mark an order paid.
- Add admin order list/detail/status controls and customer order confirmation.
- Add shipping, returns, privacy, terms, contact and delivery policies.
- Test RLS as anonymous, regular authenticated and admin users.
- Configure rate limits, validation, backups and monitoring.

## 8. Deploy to Vercel / Netlify / Cloudflare Pages

1. Create a private GitHub repository and push the project.
2. Import the repository in Vercel (or Netlify).
3. The build command will automatically run `npm run build` which bundles both `index.html` and `admin.html` via `vite.config.js`.
4. Add your Supabase environment variables in the project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`)
5. Deploy!

## 9. Accessing the Admin Page After Deployment

Because the public admin link was removed from the customer footer to prevent customer curiosity, store owners can access the admin panel in any of the following 3 ways:

1. **Direct URL**:
   Simply navigate to `/admin.html` on your custom domain:
   ```
   https://yourdomain.com/admin.html
   ```
   (Bookmark this URL in your browser for quick access).

2. **Secret Keyboard Shortcut**:
   On any page of the website, press:
   - `Ctrl + Shift + A` (Windows/Linux) or `Cmd + Shift + A` (Mac)
   - Alternatively: `Alt + A`
   This will instantly navigate you to `/admin.html`.

3. **Secret Footer Logo Double-Click**:
   Scroll down to the footer and **double-click** the circular SALORIYA logo medallion. It will open `/admin.html` directly.

> **Security Note**: The `/admin.html` page is protected by Supabase authentication and Row Level Security (RLS). Even if someone discovers the URL, they cannot view, edit, or delete products or orders without your admin login credentials.

