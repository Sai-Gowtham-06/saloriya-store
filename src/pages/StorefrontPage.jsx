import React from "react";
import AnnouncementBar from "../components/storefront/AnnouncementBar";
import SiteHeader from "../components/storefront/SiteHeader";
import HeroSection from "../components/storefront/HeroSection";
import LuxuryMarquee from "../components/storefront/LuxuryMarquee";
import CollectionTabs from "../components/storefront/CollectionTabs";
import CategoryFilters from "../components/storefront/CategoryFilters";
import StorefrontToolbar from "../components/storefront/StorefrontToolbar";
import ProductGrid from "../components/storefront/ProductGrid";
import ProductPreviewModal from "../components/storefront/ProductPreviewModal";
import CheckoutModal from "../components/storefront/CheckoutModal";
import CartDrawer from "../components/storefront/CartDrawer";
import StorySection from "../components/storefront/StorySection";
import ContactSection from "../components/storefront/ContactSection";
import SiteFooter from "../components/storefront/SiteFooter";
import FloatingWhatsApp from "../components/storefront/FloatingWhatsApp";
import { useStore } from "../context/StoreContext";

export default function StorefrontPage() {
  const { cartCount, openCart, cartToast, formatMoney, cartSubtotalPaise } = useStore();
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main>
        <HeroSection />
        <LuxuryMarquee />
        <section className="shop-section" id="shop">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE SALORIYA EDIT</p>
              <h2>
                Find your <em>look.</em>
              </h2>
            </div>
            <p className="section-note">Premium covering, combos &amp; daily wear.</p>
          </div>

          <CollectionTabs />
          <CategoryFilters />
          <StorefrontToolbar />
          <ProductGrid />
        </section>

        <StorySection />
        <ContactSection />
      </main>

      <SiteFooter />
      <ProductPreviewModal />
      <CheckoutModal />
      <CartDrawer />
      <FloatingWhatsApp />

      {/* Floating Shopping Bag Pill */}
      {cartCount > 0 && (
        <button
          type="button"
          className="floating-cart-pill"
          onClick={openCart}
          aria-label={`View shopping bag with ${cartCount} items`}
        >
          <span className="floating-cart-icon">👜</span>
          <span className="floating-cart-text">
            <strong>{cartCount} {cartCount === 1 ? "Piece" : "Pieces"}</strong>
            <small>• {formatMoney(cartSubtotalPaise)}</small>
          </span>
          <span className="floating-cart-arrow">View Bag →</span>
        </button>
      )}

      {/* Cart Toast Notification */}
      {cartToast && (
        <div className="cart-toast-banner" role="status" onClick={openCart}>
          <span className="cart-toast-icon">✓</span>
          <span className="cart-toast-msg">{cartToast}</span>
          <span className="cart-toast-cta">View Bag →</span>
        </div>
      )}
    </>
  );
}
