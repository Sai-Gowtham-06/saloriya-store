export function getColourStock(product, colourName = "") {
  if (!product) return 0;
  const colours = Array.isArray(product.colours) ? product.colours : [];
  const cleanColour = (colourName || "").trim().toLowerCase();

  // If no colours or single look, return overall stock
  if (!colours.length || cleanColour === "standard") {
    if (product.colour_stocks && typeof product.colour_stocks === "object" && product.colour_stocks["Standard"] !== undefined) {
      return Math.max(0, parseInt(product.colour_stocks["Standard"], 10) || 0);
    }
    return Math.max(0, parseInt(product.stock, 10) || 0);
  }

  // If colour_stocks dictionary is present
  if (product.colour_stocks && typeof product.colour_stocks === "object") {
    // 1. Direct or case-insensitive match
    for (const [k, v] of Object.entries(product.colour_stocks)) {
      if (k.trim().toLowerCase() === cleanColour) {
        return Math.max(0, parseInt(v, 10) || 0);
      }
    }
    // If colour is in product.colours but missing from colour_stocks map
    const hasColour = colours.some((c) => c && c.trim().toLowerCase() === cleanColour);
    if (hasColour) {
      return 0;
    }
  }

  // Fallback if colour_stocks was never defined on product
  if (colours.length <= 1) {
    return Math.max(0, parseInt(product.stock, 10) || 0);
  }
  return Math.max(0, parseInt(product.stock, 10) || 0);
}

export function getTotalStock(product) {
  if (!product) return 0;
  if (product.colour_stocks && typeof product.colour_stocks === "object") {
    const values = Object.values(product.colour_stocks);
    if (values.length > 0) {
      return values.reduce((sum, v) => sum + (Math.max(0, parseInt(v, 10) || 0)), 0);
    }
  }
  return Math.max(0, parseInt(product.stock, 10) || 0);
}

export function isColourOutOfStock(product, colourName = "") {
  if (!product) return true;
  return getColourStock(product, colourName) <= 0;
}

export function isProductOutOfStock(product) {
  if (!product) return true;
  const colours = Array.isArray(product.colours) ? product.colours.filter((c) => c && c.trim()) : [];
  if (colours.length > 0 && product.colour_stocks && typeof product.colour_stocks === "object" && Object.keys(product.colour_stocks).length > 0) {
    return colours.every((c) => isColourOutOfStock(product, c));
  }
  return getTotalStock(product) <= 0;
}

export function normalizeProduct(p, seedFallback = null) {
  let urls = [];
  if (Array.isArray(p.image_urls) && p.image_urls.length > 0) {
    const nonLogo = p.image_urls.filter((u) => u && u !== "/logo.png");
    urls = nonLogo.length > 0 ? nonLogo : p.image_urls.filter(Boolean);
  }
  if (!urls.length && Array.isArray(p.images) && p.images.length > 0) {
    const nonLogo = p.images.filter((u) => u && u !== "/logo.png");
    urls = nonLogo.length > 0 ? nonLogo : p.images.filter(Boolean);
  }
  if (!urls.length && seedFallback && Array.isArray(seedFallback.image_urls) && seedFallback.image_urls.length > 0) {
    urls = seedFallback.image_urls;
  }
  const colours = Array.isArray(p.colours) ? p.colours : (seedFallback?.colours || []);

  // Normalize per-colour stocks
  let colour_stocks = {};
  if (p.colour_stocks && typeof p.colour_stocks === "object" && !Array.isArray(p.colour_stocks)) {
    colour_stocks = { ...p.colour_stocks };
  } else if (seedFallback?.colour_stocks && typeof seedFallback.colour_stocks === "object" && !Array.isArray(seedFallback.colour_stocks)) {
    colour_stocks = { ...seedFallback.colour_stocks };
  } else if (colours.length > 0) {
    const currentStock = Math.max(0, parseInt(p.stock ?? seedFallback?.stock ?? 5, 10));
    if (colours.length === 1) {
      colour_stocks = { [colours[0]]: currentStock };
    } else {
      const baseStock = Math.floor(currentStock / colours.length);
      const remainder = currentStock % colours.length;
      colours.forEach((c, idx) => {
        colour_stocks[c] = baseStock + (idx < remainder ? 1 : 0);
      });
    }
  }

  // Ensure every active colour has an entry in colour_stocks
  if (colours.length > 0) {
    colours.forEach((c) => {
      if (colour_stocks[c] === undefined) {
        colour_stocks[c] = 0;
      } else {
        colour_stocks[c] = Math.max(0, parseInt(colour_stocks[c], 10) || 0);
      }
    });
  }

  const effectiveStock = Object.keys(colour_stocks).length > 0
    ? Object.values(colour_stocks).reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0)
    : Math.max(0, parseInt(p.stock ?? seedFallback?.stock ?? 0, 10));

  return {
    ...p,
    image_urls: urls,
    images: urls,
    colours,
    colour_stocks,
    stock: effectiveStock
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
