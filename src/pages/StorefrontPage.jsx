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
import StorySection from "../components/storefront/StorySection";
import ContactSection from "../components/storefront/ContactSection";
import SiteFooter from "../components/storefront/SiteFooter";
import FloatingWhatsApp from "../components/storefront/FloatingWhatsApp";

export default function StorefrontPage() {
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
      <FloatingWhatsApp />
    </>
  );
}
