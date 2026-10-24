// Utility functions for Storefront and Admin products

export function normalizeProduct(p, seedFallback = null) {
  let urls = [];
  if (Array.isArray(p.image_urls) && p.image_urls.length > 0) {
    urls = p.image_urls.filter((u) => u && u !== "/logo.png");
  }
  if (!urls.length && Array.isArray(p.images) && p.images.length > 0) {
    urls = p.images.filter((u) => u && u !== "/logo.png");
  }
  if (!urls.length && seedFallback && Array.isArray(seedFallback.image_urls) && seedFallback.image_urls.length > 0) {
    urls = seedFallback.image_urls;
  }
  return {
    ...p,
    image_urls: urls,
    images: urls,
    colours: Array.isArray(p.colours) ? p.colours : (seedFallback?.colours || [])
  };
}

export function getColourImage(p, colourName = "", colourIndex = 0) {
  if (!p) return "";
  const urls = (Array.isArray(p.image_urls) && p.image_urls.length > 0)
    ? p.image_urls
    : (Array.isArray(p.images) && p.images.length > 0 ? p.images : []);
  if (!urls.length) return "";

  const clean = (colourName || "").trim().toLowerCase();
  if (clean && clean !== "standard") {
    const matched = urls.find((url) => {
      try {
        const decoded = decodeURIComponent(url).toLowerCase();
        return decoded.includes(clean);
      } catch {
        return false;
      }
    });
    if (matched) return matched;
  }
  if (typeof colourIndex === "number" && colourIndex >= 0 && colourIndex < urls.length) {
    return urls[colourIndex];
  }
  return urls[0] || "";
}
