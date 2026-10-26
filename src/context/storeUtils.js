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

export function hasProductColours(product) {
  if (!product) return false;
  const colours = Array.isArray(product.colours) ? product.colours : [];
  return colours.some((c) => c && c.trim() && c.trim().toLowerCase() !== "standard");
}

export function sortProductsByColourAvailability(productList) {
  if (!Array.isArray(productList)) return [];
  const withColours = [];
  const withoutColours = [];

  productList.forEach((p) => {
    if (hasProductColours(p)) {
      withColours.push(p);
    } else {
      withoutColours.push(p);
    }
  });

  return [...withColours, ...withoutColours];
}

export function getColourForImage(product, imageUrl = "", imageIndex = 0) {
  if (!product) return "";
  const colours = Array.isArray(product.colours) ? product.colours : [];
  if (!colours.length) return "";

  // 1. If imageUrl has a colour name in its filename/URL
  if (imageUrl) {
    let cleanUrl = "";
    try {
      cleanUrl = decodeURIComponent(imageUrl).toLowerCase();
    } catch {
      cleanUrl = imageUrl.toLowerCase();
    }
    // Sort colours by length descending so longer compound names match first (e.g. "sky blue" before "blue")
    const sortedColours = [...colours].sort((a, b) => b.length - a.length);
    const matched = sortedColours.find((c) => {
      const cleanColour = (c || "").trim().toLowerCase();
      if (!cleanColour || cleanColour === "standard") return false;
      return cleanUrl.includes(cleanColour);
    });
    if (matched) return matched;

    // Check common jewellery stone colour aliases
    if (cleanUrl.includes("ruby") && colours.some((c) => c.toLowerCase() === "red")) {
      return colours.find((c) => c.toLowerCase() === "red");
    }
    if (cleanUrl.includes("emerald") && colours.some((c) => c.toLowerCase() === "green")) {
      return colours.find((c) => c.toLowerCase() === "green");
    }
    if (cleanUrl.includes("teal") && colours.some((c) => c.toLowerCase().includes("blue"))) {
      return colours.find((c) => c.toLowerCase().includes("blue"));
    }
    if (cleanUrl.includes("amethyst") && colours.some((c) => c.toLowerCase().includes("violet") || c.toLowerCase().includes("purple"))) {
      return colours.find((c) => c.toLowerCase().includes("violet") || c.toLowerCase().includes("purple"));
    }
  }

  // 2. Direct index mapping if within bounds
  if (typeof imageIndex === "number" && imageIndex >= 0 && imageIndex < colours.length) {
    return colours[imageIndex];
  }

  // 3. Fallback
  return colours[0] || "";
}
