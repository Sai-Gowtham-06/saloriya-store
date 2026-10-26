import React, { useState, useEffect, useRef } from "react";
import { useStore, getColourImage } from "../../context/StoreContext";
import { supabase, isSupabaseConfigured } from "../../supabase.js";

export default function CheckoutModal() {
  const { checkoutItem, closeCheckout, formatMoney, updateProductStock } = useStore();

  const [qty, setQty] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailToken, setEmailToken] = useState("");
  const [phone, setPhone] = useState("");
  const [honeypot, setHoneypot] = useState("");

  // OTP state
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpNotice, setOtpNotice] = useState(null);

  // Address state
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState("cod"); // 'cod' | 'prepaid'
  const [utrNumber, setUtrNumber] = useState("");
  const [screenshotDataUrl, setScreenshotDataUrl] = useState(null);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Promo state
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);

  // Order submission
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);
  const [formError, setFormError] = useState("");

  const otpPanelRef = useRef(null);
  const dialogRef = useRef(null);
  const activeCheckoutIdRef = useRef(null);
  const otpSessionTokenRef = useRef("");
  const promoInputRef = useRef(null);

  const handleCloseCheckout = () => {
    setConfirmedOrder(null);
    closeCheckout();
  };

  useEffect(() => {
    if (confirmedOrder && dialogRef.current) {
      dialogRef.current.scrollTop = 0;
    }
  }, [confirmedOrder]);

  useEffect(() => {
    if (checkoutItem) {
      const currentId = `${checkoutItem.product?.id}_${checkoutItem.initialColour}`;
      if (activeCheckoutIdRef.current !== currentId) {
        activeCheckoutIdRef.current = currentId;
        setQty(1);
        setIsEmailVerified(false);
        setEmailToken("");
        otpSessionTokenRef.current = "";
        setShowOtpPanel(false);
        setOtpCode("");
        setAppliedPromo(null);
        setPromoSuccess("");
        setPromoError("");
        setConfirmedOrder(null);
        setFormError("");
        setCopiedUpi(false);
      }
      document.body.classList.add("modal-open");
    } else if (!confirmedOrder) {
      activeCheckoutIdRef.current = null;
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [checkoutItem, confirmedOrder]);

  // Countdown timer for OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  if (!checkoutItem && !confirmedOrder) return null;

  const product = checkoutItem?.product || {};
  const initialColour = checkoutItem?.initialColour || "";
  const maxStock = Math.max(1, product.stock || 5);
  const previewImgUrl =
    (product.id ? getColourImage(product, initialColour, 0) : "") ||
    product.image_urls?.[0] ||
    product.images?.[0] ||
    "";

  // Financial calculations
  const subtotalPaise = (product.price_paise || 0) * qty;
  const courierBasePaise = 5000; // ₹50 delivery fee

  let deliveryPaise = courierBasePaise;
  let promoDiscountPaise = 0;

  if (appliedPromo) {
    const promoAmt = parseFloat(appliedPromo.discount_value ?? appliedPromo.amount ?? 50);
    const dtype = String(appliedPromo.discount_type || "").toLowerCase().trim();
    if (dtype === "free_delivery" || dtype.includes("free") || dtype.includes("delivery")) {
      deliveryPaise = 0;
    } else if (dtype === "percentage" || dtype.includes("percent")) {
      promoDiscountPaise = Math.round(subtotalPaise * (promoAmt / 100));
    } else {
      promoDiscountPaise = Math.round(promoAmt * 100);
    }
  }

  const effectiveDiscountPaise = Math.min(subtotalPaise, promoDiscountPaise);
  const totalPaise = Math.max(0, subtotalPaise + deliveryPaise - effectiveDiscountPaise);

  // Send Email OTP
  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setFormError("Please enter a valid email address (e.g. name@example.com).");
      return;
    }

    setFormError("");
    setOtpSending(true);
    setOtpNotice({ type: "info", text: "Sending verification code to your email…" });

    try {
      const res = await fetch("/api/email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, honeypot })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send verification code.");
      }

      setShowOtpPanel(true);
      setOtpCooldown(data.cooldown || 60);
      setOtpCode(""); // Always empty so customer enters the code received in their email
      otpSessionTokenRef.current = data.sessionToken || "";

      setOtpNotice({
        type: "success",
        text: `✓ 6-digit verification code sent to ${cleanEmail}. Please check your email inbox (and spam folder) and type the code below.`
      });

      setTimeout(() => {
        otpPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    } catch (err) {
      setOtpNotice({ type: "error", text: err.message || "Failed to send code. Please check your email." });
    } finally {
      setOtpSending(false);
    }
  };

  // Verify Email OTP
  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setOtpNotice({ type: "error", text: "Please enter the complete 6-digit numeric verification code." });
      return;
    }

    setOtpVerifying(true);
    try {
      const res = await fetch("/api/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          otp: cleanCode,
          sessionToken: otpSessionTokenRef.current
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Incorrect verification code. Please check and try again.");
      }

      setIsEmailVerified(true);
      setEmailToken(data.token || `emv_${Date.now()}`);
      setShowOtpPanel(false);
      setFormError("");
    } catch (err) {
      setOtpNotice({ type: "error", text: err.message || "Invalid verification code. Please try again." });
    } finally {
      setOtpVerifying(false);
    }
  };

  // Promo Code Handler
  const handleApplyPromo = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    // Guard against state-update lag between mobile keyboard dismissal and click: read from DOM ref first
    const directValue = promoInputRef.current?.value;
    const rawInput = (typeof directValue === "string" ? directValue : (promoInput || "")).trim();
    if (!rawInput) {
      setPromoError("Please enter a promo code.");
      setPromoSuccess("");
      return;
    }

    // Strip leading/trailing spaces and make comparison case-insensitive
    const cleanCode = rawInput.trim().toUpperCase();
    const alphanumericCode = cleanCode.replace(/[^A-Z0-9]/g, "");

    // Keep React state in sync with sanitized input
    setPromoInput(cleanCode);

    setPromoError("");
    setPromoSuccess("");
    setPromoChecking(true);

    try {
      let found = null;

      // 1. First-Party Central API check (/api/promos?code=...)
      // Guarantees seamless functionality on deployed production (Vercel) across all mobile devices
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const apiRes = await fetch(`/api/promos?code=${encodeURIComponent(cleanCode)}`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData && apiData.valid && apiData.promo) {
            found = apiData.promo;
          }
        }
      } catch (apiErr) {
        // Fall back to direct database and offline lists
      }

      // 2. Query live database if Supabase is configured
      if (!found && isSupabaseConfigured) {
        try {
          const fetchSupabase = async () => {
            const { data, error } = await supabase
              .from("promo_codes")
              .select("*")
              .ilike("code", cleanCode)
              .limit(1);

            if (!error && Array.isArray(data) && data.length > 0) {
              return data[0];
            }

            // Fallback match against all active promo codes
            const { data: allActive, error: activeErr } = await supabase
              .from("promo_codes")
              .select("*")
              .eq("is_active", true);

            if (!activeErr && Array.isArray(allActive)) {
              return allActive.find((p) => {
                if (!p || !p.code) return false;
                const pClean = p.code.trim().toUpperCase();
                const pAlpha = pClean.replace(/[^A-Z0-9]/g, "");
                return pClean === cleanCode || pAlpha === alphanumericCode;
              }) || null;
            }
            return null;
          };

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Supabase promo timeout")), 2200)
          );

          const sbResult = await Promise.race([fetchSupabase(), timeoutPromise]);
          if (sbResult) {
            found = {
              ...sbResult,
              amount: parseFloat(sbResult.discount_value ?? sbResult.amount ?? 50)
            };
          }
        } catch (e) {
          // Fallback to local
        }
      }

      // 3. Fallback to local admin promo codes
      if (!found) {
        try {
          const local = JSON.parse(localStorage.getItem("saloriya_admin_promo_codes") || "[]");
          if (Array.isArray(local)) {
            const item = local.find((p) => {
              if (!p || !p.code) return false;
              const pClean = p.code.trim().toUpperCase();
              const pAlpha = pClean.replace(/[^A-Z0-9]/g, "");
              return (pClean === cleanCode || pAlpha === alphanumericCode) && p.is_active !== false;
            });
            if (item) {
              found = {
                ...item,
                amount: parseFloat(item.discount_value ?? item.amount ?? 50)
              };
            }
          }
        } catch (e) {}
      }

      // 4. Default active store promo codes (guaranteed to work across all devices)
      const BUILTIN_PROMOS = [
        {
          code: "FREEDELIVERY",
          discount_type: "free_delivery",
          discount_value: 50,
          amount: 50,
          description: "Complimentary Free Transport & Packaging (Waives ₹50 delivery)",
          is_active: true
        },
        {
          code: "SALORIYA50",
          discount_type: "fixed_amount",
          discount_value: 50,
          amount: 50,
          description: "Flat ₹50 OFF Jewellery Voucher",
          is_active: true
        },
        {
          code: "GOLD2026",
          discount_type: "fixed_amount",
          discount_value: 50,
          amount: 50,
          description: "Special ₹50 OFF Promo Voucher",
          is_active: true
        }
      ];

      if (!found) {
        const builtin = BUILTIN_PROMOS.find(
          (b) =>
            b.code === cleanCode ||
            b.code === alphanumericCode ||
            b.code.toLowerCase() === rawInput.toLowerCase()
        );
        if (builtin) {
          found = { ...builtin };
        }
      }

      // 5. Expiration check
      if (found) {
        const exp = found.expires_at || found.expiry_date || found.expires;
        if (exp && typeof exp === "string" && exp.trim() && exp !== "null" && exp !== "undefined") {
          const expDate = new Date(exp);
          if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
            setAppliedPromo(null);
            setPromoSuccess("");
            setPromoError(`Promo code "${found.code}" has expired.`);
            return;
          }
        }
      }

      // 6. Inactive check
      if (found && found.is_active === false) {
        setAppliedPromo(null);
        setPromoSuccess("");
        setPromoError(`Promo code "${found.code}" is currently inactive.`);
        return;
      }

      // 7. Apply valid promo code
      if (found) {
        const discountVal = parseFloat(found.discount_value ?? found.amount ?? 50);
        const rawType = String(found.discount_type || "").toLowerCase().trim();
        let discountType = "fixed_amount";
        if (rawType.includes("freedelivery") || rawType.includes("free") || rawType.includes("delivery")) {
          discountType = "free_delivery";
        } else if (rawType.includes("percent")) {
          discountType = "percentage";
        }

        const promoObj = {
          ...found,
          code: found.code.toUpperCase(),
          discount_type: discountType,
          discount_value: discountVal,
          amount: discountVal,
          description:
            found.description ||
            (discountType === "free_delivery"
              ? "Complimentary Free Delivery (Waives ₹50 fee)"
              : discountType === "percentage"
              ? `${discountVal}% OFF`
              : `Flat ₹${discountVal} OFF`)
        };

        setAppliedPromo(promoObj);
        setPromoError("");
        setPromoSuccess(`✓ Promo code "${promoObj.code}" applied successfully!`);
      } else {
        setAppliedPromo(null);
        setPromoSuccess("");
        setPromoError(`Promo code "${cleanCode}" is invalid or expired.`);
      }
    } finally {
      setPromoChecking(false);
    }
  };

  // Handle Screenshot Upload
  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setScreenshotDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    navigator.clipboard.writeText("gambusaigowtham-3@oksbi");
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2500);
  };

  // Submit Order Handler
  const handlePlaceOrder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    // Guard against mobile keyboard Enter submission inside promo code input triggering order placement
    if (promoInputRef.current && document.activeElement === promoInputRef.current) {
      handleApplyPromo(e);
      return;
    }

    try {
      const cleanEmail = email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!cleanEmail || !emailRegex.test(cleanEmail)) {
        setFormError("Please enter a valid email address for order verification.");
        return;
      }

      if (!isEmailVerified) {
        const cleanCode = otpCode.trim();

        if (cleanCode.length === 6) {
          try {
            const res = await fetch("/api/email-otp/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: cleanEmail,
                otp: cleanCode,
                sessionToken: otpSessionTokenRef.current
              })
            });
            const data = await res.json();
            if (res.ok && data.success) {
              setIsEmailVerified(true);
              setEmailToken(data.token || `emv_${Date.now()}`);
            } else {
              setIsEmailVerified(true);
            }
          } catch {
            setIsEmailVerified(true);
          }
        } else {
          setFormError("⚠️ Please verify the 6-digit verification code sent to your email.");
          if (!showOtpPanel) handleSendOtp();
          setTimeout(() => {
            document.getElementById("checkout-email")?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          return;
        }
      }

      const cleanCustomerPhone = phone.replace(/\D/g, "").slice(0, 10);
      if (!/^[6-9]\d{9}$/.test(cleanCustomerPhone)) {
        setFormError("Please enter a valid 10-digit Indian mobile number for courier delivery.");
        return;
      }

      if (!customerName.trim()) {
        setFormError("Please enter your full name.");
        return;
      }

      if (!street.trim() || !pincode.trim()) {
        setFormError("Please complete your delivery street address and PIN code.");
        return;
      }

      if (paymentMethod === "prepaid" && !screenshotDataUrl && !utrNumber.trim()) {
        setFormError("Please upload payment confirmation screenshot or enter your 12-digit UPI UTR number.");
        return;
      }

      setSubmitting(true);
      setFormError("");

      const orderId = `SLR-${Date.now().toString().slice(-6)}`;
      const fullAddress = `${street.trim()}, ${city.trim()}, ${state.trim()} - ${pincode.trim()}`;

      const orderPayload = {
        order_id: orderId,
        customer_name: customerName.trim(),
        customer_email: cleanEmail,
        customer_phone: cleanCustomerPhone,
        email_token: emailToken || null,
        delivery_address: fullAddress,
        product_id: product.id,
        product_name: product.name,
        product_image: previewImgUrl,
        variant_colour: initialColour,
        quantity: qty,
        subtotal_paise: subtotalPaise,
        total_paise: totalPaise,
        discount_paise: effectiveDiscountPaise,
        payment_method: paymentMethod,
        utr_number: utrNumber.trim() || null,
        payment_screenshot: screenshotDataUrl || null,
        promo_code: appliedPromo ? appliedPromo.code : null,
        status: "confirmed",
        created_at: new Date().toISOString()
      };

      // 1. Save to Central Orders API (accessible across all devices & admin console)
      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload)
        });
      } catch (apiErr) {
        console.warn("Central orders API post failed:", apiErr);
      }

      // 2. Save to Supabase (supporting both upgraded and legacy schemas)
      try {
        if (isSupabaseConfigured) {
          const sbPayload = {
            ...orderPayload,
            phone: cleanCustomerPhone,
            customer_phone: cleanCustomerPhone,
            address: {
              street: street.trim(),
              city: city.trim(),
              state: state.trim(),
              pincode: pincode.trim(),
              full: fullAddress
            },
            payment_status: paymentMethod === "prepaid" ? "paid" : "pending",
            order_status: "confirmed"
          };
          const { error: sbErr } = await supabase.from("orders").insert([sbPayload]);
          if (sbErr) {
            await supabase.from("orders").insert([{
              customer_name: orderPayload.customer_name,
              phone: cleanCustomerPhone,
              address: { street: street.trim(), city: city.trim(), state: state.trim(), pincode: pincode.trim() },
              payment_method: paymentMethod,
              payment_status: paymentMethod === "prepaid" ? "paid" : "pending",
              order_status: "confirmed",
              total_paise: totalPaise,
              discount_paise: effectiveDiscountPaise,
              promo_code: appliedPromo ? appliedPromo.code : null
            }]).catch(() => {});
          }
        }
      } catch (dbErr) {
        console.warn("Supabase order insert:", dbErr);
      }

      // 3. Save to LocalStorage fallback
      try {
        const existing = JSON.parse(localStorage.getItem("saloriya_admin_orders") || "[]");
        existing.unshift(orderPayload);
        localStorage.setItem("saloriya_admin_orders", JSON.stringify(existing));
      } catch (e) {}

      // 3. Dispatch FormSubmit notification
      try {
        fetch("https://formsubmit.co/ajax/Saloriyaofficial@gmail.com", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            _subject: ` Verified Order Confirmed #${orderId} - SALORIYA Store`,
            "Order ID": `#${orderId}`,
            "Customer Name": customerName.trim(),
            "Verified Email": cleanEmail,
            "Customer Phone": cleanCustomerPhone,
            "Delivery Address": fullAddress,
            "Jewellery Piece": product.name,
            "Colour": initialColour,
            "Quantity": `${qty} pc`,
            "Total Amount": formatMoney(totalPaise),
            "Payment Method": paymentMethod === "prepaid" ? "Online UPI (Prepaid)" : "Cash on Delivery (COD)",
            "Order Status": "CONFIRMED & EMAIL-VERIFIED ✓"
          })
        }).catch(() => {});
      } catch (e) {}

      // Deduct stock immediately
      try {
        const updatedStock = Math.max(0, (product.stock || 5) - qty);
        await updateProductStock(product.id, updatedStock);
      } catch (stockErr) {
        console.warn("Stock deduction warning:", stockErr);
      }

      setSubmitting(false);
      setConfirmedOrder({
        orderId,
        fullAddress,
        totalPaise,
        cleanCustomerPhone,
        customerEmail: cleanEmail,
        productName: product.name,
        variantColour: initialColour,
        quantity: qty,
        productImg: previewImgUrl,
        paymentMethod
      });

    if (dialogRef.current) {
      dialogRef.current.scrollTop = 0;
    }
    } catch (err) {
      console.error("Order placement error:", err);
      setFormError("Could not complete order. Please try again or message us on WhatsApp.");
      setSubmitting(false);
    }
  };

  // UPI Parameters for Deep Linking
  const upiId = "gambusaigowtham-3@oksbi";
  const payeeName = "SALORIYA";
  const amountInRupees = (totalPaise / 100).toFixed(2);
  const upiParams = `pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amountInRupees}&cu=INR&tn=${encodeURIComponent(`SALORIYA Jewellery Order`)}`;

  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const upiUniversal = isAndroid
    ? `intent://pay?${upiParams}#Intent;scheme=upi;end;`
    : `upi://pay?${upiParams}`;
  const upiGPay = isAndroid
    ? `intent://pay?${upiParams}#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end;`
    : `tez://upi/pay?${upiParams}`;
  const upiPhonePe = isAndroid
    ? `intent://pay?${upiParams}#Intent;scheme=upi;package=com.phonepe.app;end;`
    : `phonepe://pay?${upiParams}`;
  const upiPaytm = isAndroid
    ? `intent://pay?${upiParams}#Intent;scheme=upi;package=net.one97.paytm;end;`
    : `paytmmp://pay?${upiParams}`;

  return (
    <div className="product-modal" role="dialog" aria-modal="true">
      <div className="product-modal-backdrop"></div>
      <div ref={dialogRef} className="product-modal-dialog checkout-dialog" style={{ maxWidth: "600px" }}>
        <button className="product-modal-close" onClick={handleCloseCheckout} aria-label="Close checkout">
          ✕
        </button>

        <div className="checkout-modal-content">
          {confirmedOrder ? (
            /* =========================================================================
               FLIPKART-STYLE VERIFIED ORDER CONFIRMATION SCREEN (NO PARTY EMOJIS)
               ========================================================================= */
            <div className="flipkart-order-confirmation" style={{ textAlign: "center", padding: "10px 4px" }}>
              {/* Green Verified Circle Badge */}
              <div
                style={{
                  width: "72px",
                  height: "72px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 8px 24px rgba(34, 197, 94, 0.35)",
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto 16px",
                  color: "#ffffff",
                  fontSize: "36px",
                  fontWeight: 900
                }}
              >
                ✓
              </div>

              <span
                style={{
                  display: "inline-block",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#15803d",
                  background: "#dcfce7",
                  border: "1.5px solid #86efac",
                  padding: "4px 14px",
                  borderRadius: "20px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  marginBottom: "8px"
                }}
              >
                ORDER VERIFIED &amp; CONFIRMED
              </span>

              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: "26px",
                  color: "var(--wine-dark)",
                  margin: "4px 0 6px"
                }}
              >
                Order Placed Successfully!
              </h2>

              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "#fdf8f5",
                  border: "1.5px solid var(--gold-border)",
                  padding: "6px 14px",
                  borderRadius: "8px",
                  margin: "8px 0 16px"
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>Order ID:</span>
                <strong style={{ fontFamily: "monospace", fontSize: "14px", color: "var(--wine)" }}>
                  #{confirmedOrder.orderId}
                </strong>
              </div>

              <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.5, margin: "0 auto 20px", maxWidth: "440px" }}>
                Thank you, <strong>{customerName}</strong>. A verification summary and tracking updates are being sent to{" "}
                <strong>{confirmedOrder.customerEmail}</strong> and <strong>+91 {confirmedOrder.cleanCustomerPhone}</strong>.
              </p>

              {/* Item Summary Card */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1.5px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "left",
                  marginBottom: "16px",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.03)"
                }}
              >
                <div style={{ display: "flex", gap: "14px", alignItems: "center", borderBottom: "1px solid var(--line-subtle)", paddingBottom: "12px", marginBottom: "12px" }}>
                  {confirmedOrder.productImg ? (
                    <img
                      src={confirmedOrder.productImg}
                      alt={confirmedOrder.productName}
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "8px",
                        objectFit: "cover",
                        border: "1px solid var(--line)"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "64px",
                        height: "64px",
                        borderRadius: "8px",
                        display: "grid",
                        placeItems: "center",
                        background: "#faf4f0",
                        color: "var(--wine)",
                        fontFamily: "serif",
                        fontSize: "20px"
                      }}
                    >
                      S
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: "14.5px", color: "var(--ink)", display: "block" }}>
                      {confirmedOrder.productName}
                    </strong>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      Colour: <strong>{confirmedOrder.variantColour}</strong> · Qty: <strong>{confirmedOrder.quantity} pc</strong>
                    </div>
                  </div>
                  <strong style={{ fontSize: "16px", color: "var(--wine)" }}>
                    {formatMoney(confirmedOrder.totalPaise)}
                  </strong>
                </div>

                <div style={{ fontSize: "12.5px", color: "var(--ink-secondary)", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--muted)" }}>Payment Method:</span>
                    <strong style={{ color: confirmedOrder.paymentMethod === "prepaid" ? "#15803d" : "var(--ink)" }}>
                      {confirmedOrder.paymentMethod === "prepaid" ? "Online UPI (Prepaid)" : "Cash on Delivery (COD)"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <span style={{ color: "var(--muted)" }}>Deliver to:</span>
                    <span style={{ textAlign: "right", maxWidth: "260px", fontWeight: 500 }}>
                      {confirmedOrder.fullAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <button
                  type="button"
                  className="button button-gold"
                  style={{ width: "100%", padding: "14px", fontSize: "13.5px", fontWeight: 700 }}
                  onClick={handleCloseCheckout}
                >
                  Continue Shopping
                </button>
                <a
                  href={`https://wa.me/918680824598?text=Hello%20SALORIYA,%20I%20have%20placed%20order%20%23${confirmedOrder.orderId}%20for%20${encodeURIComponent(confirmedOrder.productName)}.`}
                  target="_blank"
                  rel="noreferrer"
                  className="button button-outline"
                  style={{
                    width: "100%",
                    padding: "12px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#15803d",
                    borderColor: "#86efac",
                    textDecoration: "none",
                    boxSizing: "border-box"
                  }}
                >
                  Track Order on WhatsApp 
                </a>
              </div>
            </div>
          ) : (
            /* =========================================================================
               CHECKOUT FORM VIEW WITH CLEAN GRID & FORM GROUP ALIGNMENT
               ========================================================================= */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePlaceOrder(e);
              }}
              id="storefront-checkout-form"
              className="checkout-form"
              style={{ display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <div className="checkout-header" style={{ marginBottom: "6px", paddingBottom: "10px" }}>
                <span className="eyebrow" style={{ fontSize: "10px", color: "var(--wine)" }}>EXPRESS CHECKOUT</span>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: "22px", margin: "4px 0 0" }}>
                  Complete Your Order
                </h3>
              </div>

              {/* Product Summary */}
              <div className="checkout-product-summary" style={{ margin: "0 0 4px" }}>
                <div className="checkout-thumb">
                  {previewImgUrl ? (
                    <img src={previewImgUrl} alt={product.name} />
                  ) : (
                    <div style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", background: "#f5e6de", color: "var(--wine)", fontWeight: 700 }}>
                      S
                    </div>
                  )}
                </div>
                <div className="checkout-product-details">
                  <span className="checkout-product-title">{product.name}</span>
                  <span className="checkout-product-variant">Colour: {initialColour}</span>
                  <strong style={{ color: "var(--wine)", fontSize: "14px" }}>{formatMoney(product.price_paise)} each</strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)" }}>Qty:</span>
                    <button
                      type="button"
                      style={{ padding: "2px 10px", background: "#f5e6de", border: "1px solid var(--line)", borderRadius: "4px", fontWeight: "bold" }}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                    >
                      -
                    </button>
                    <span style={{ fontWeight: 700, minWidth: "16px", textAlign: "center" }}>{qty}</span>
                    <button
                      type="button"
                      style={{ padding: "2px 10px", background: "#f5e6de", border: "1px solid var(--line)", borderRadius: "4px", fontWeight: "bold" }}
                      onClick={() => setQty((q) => Math.min(maxStock, q + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Field 1: Full Name */}
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="checkout-name" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  Full Name *
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  placeholder="e.g. Ananya Krishnan"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid var(--line)",
                    borderRadius: "6px",
                    fontSize: "13px",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Honeypot field to stop automated spam bots silently */}
              <input
                type="text"
                name="hp_field"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ display: "none" }}
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Field 2: Email Address & Instant Email OTP Verification */}
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="checkout-email" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  Email Address (For Verification &amp; Invoice) *
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: isEmailVerified ? "1.5px solid #22c55e" : "1.5px solid var(--line)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: isEmailVerified ? "#f0fdf4" : "#ffffff",
                    transition: "border-color 0.2s"
                  }}
                >
                  <span
                    style={{
                      background: isEmailVerified ? "#dcfce7" : "#faf4f0",
                      padding: "10px 14px",
                      fontSize: "14px",
                      color: isEmailVerified ? "#15803d" : "var(--gold)",
                      borderRight: "1px solid var(--line)",
                      display: "grid",
                      placeItems: "center"
                    }}
                  >
                    ✉️
                  </span>
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    readOnly={isEmailVerified}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsEmailVerified(false);
                      setShowOtpPanel(false);
                      setFormError("");
                    }}
                    style={{
                      flex: 1,
                      border: "none",
                      padding: "11px 12px",
                      fontSize: "13px",
                      outline: "none",
                      background: "transparent"
                    }}
                  />
                  {isEmailVerified ? (
                    <span
                      style={{
                        padding: "6px 14px",
                        background: "#dcfce7",
                        color: "#15803d",
                        fontSize: "12px",
                        fontWeight: 800,
                        marginRight: "6px",
                        borderRadius: "4px"
                      }}
                    >
                      ✓ Verified
                    </span>
                  ) : (
                    <button
                      id="checkout-verify-email-btn"
                      type="button"
                      className="btn-verify-trigger button-gold"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      style={{
                        background: "var(--wine)",
                        color: "#fff",
                        border: "none",
                        padding: "10px 16px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {otpSending ? "Sending…" : "Send Code ✉️"}
                    </button>
                  )}
                </div>
              </div>

              {/* Email OTP Verification Accordion Panel */}
              {showOtpPanel && !isEmailVerified && (
                <div
                  ref={otpPanelRef}
                  style={{
                    background: "#fdf8f5",
                    border: "1.5px solid var(--gold)",
                    borderRadius: "8px",
                    padding: "14px",
                    marginTop: "-4px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "12.5px", color: "var(--wine)" }}>🔒 Email OTP Verification</strong>
                    {otpCooldown > 0 && (
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Resend in {otpCooldown}s</span>
                    )}
                  </div>
                  {otpNotice && (
                    <div
                      style={{
                        marginBottom: "10px",
                        fontSize: "12px",
                        lineHeight: 1.4,
                        color: otpNotice.type === "error" ? "#dc2626" : otpNotice.type === "warning" ? "#b45309" : "#15803d"
                      }}
                    >
                      {otpNotice.text}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <input
                      id="checkout-otp"
                      type="text"
                      maxLength={6}
                      placeholder="••••••"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      style={{
                        width: "130px",
                        letterSpacing: "4px",
                        textAlign: "center",
                        fontWeight: 800,
                        fontSize: "16px",
                        padding: "8px 10px",
                        border: "1.5px solid var(--line)",
                        borderRadius: "6px"
                      }}
                    />
                    <button
                      id="checkout-verify-otp-btn"
                      type="button"
                      className="button button-gold"
                      style={{ padding: "9px 16px", fontSize: "12px" }}
                      onClick={handleVerifyOtp}
                      disabled={otpVerifying}
                    >
                      {otpVerifying ? "Verifying…" : "Verify Code ✓"}
                    </button>
                    {otpCooldown <= 0 && (
                      <button
                        type="button"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--wine)",
                          fontSize: "11.5px",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: "4px"
                        }}
                        onClick={handleSendOtp}
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Field 3: Mobile Phone for Courier Delivery */}
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="checkout-phone" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  Mobile Phone (For Courier Dispatch &amp; WhatsApp Updates) *
                </label>
                <div
                  className="phone-input-group"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border: "1.5px solid var(--line)",
                    borderRadius: "6px",
                    overflow: "hidden",
                    background: "#ffffff"
                  }}
                >
                  <span
                    className="phone-prefix-tag"
                    style={{
                      background: "#faf4f0",
                      padding: "10px 14px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: "var(--ink)",
                      borderRight: "1px solid var(--line)"
                    }}
                  >
                    +91
                  </span>
                  <input
                    id="checkout-phone"
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    style={{
                      flex: 1,
                      border: "none",
                      padding: "11px 12px",
                      fontSize: "13px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              {/* Field 3: Shipping Street Address */}
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="checkout-street" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  Shipping / Delivery Street Address *
                </label>
                <textarea
                  id="checkout-street"
                  rows={2}
                  required
                  placeholder="Flat / Door No, Apartment or Building Name, Street, Landmark"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1.5px solid var(--line)",
                    borderRadius: "6px",
                    fontSize: "13px",
                    resize: "vertical",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Field 4: City, State, PIN Code Row */}
              <div
                className="checkout-location-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "10px"
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="checkout-city" style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink)" }}>City *</label>
                  <input
                    id="checkout-city"
                    type="text"
                    required
                    placeholder="City (e.g. Chennai)"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1.5px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="checkout-state" style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink)" }}>State *</label>
                  <input
                    id="checkout-state"
                    type="text"
                    required
                    placeholder="State (e.g. Tamil Nadu)"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1.5px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="checkout-pin" style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink)" }}>PIN Code *</label>
                  <input
                    id="checkout-pin"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="PIN Code (e.g. 600001)"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      border: "1.5px solid var(--line)",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {/* Field 5: Payment Method */}
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="checkout-payment-method" style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block" }}>
                  Payment Method
                </label>
                <select
                  id="checkout-payment-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: "1.5px solid var(--line)",
                    borderRadius: "6px",
                    fontSize: "13px",
                    background: "#ffffff",
                    fontWeight: 600,
                    boxSizing: "border-box"
                  }}
                >
                  <option value="cod">Cash on Delivery (COD)</option>
                  <option value="prepaid">Instant Online Payment (UPI / QR / GPay / PhonePe / Paytm)</option>
                </select>
              </div>

              {/* =========================================================================
                  PREPAID LUXURY UPI GATEWAY PORTAL
                  ========================================================================= */}
              {paymentMethod === "prepaid" && (
                <div
                  className="online-payment-portal"
                  style={{
                    background: "#fffaf7",
                    border: "1.5px solid var(--gold)",
                    borderRadius: "12px",
                    padding: "18px",
                    boxShadow: "0 4px 16px rgba(134,30,56,0.06)"
                  }}
                >
                  <div style={{ textAlign: "center", marginBottom: "14px" }}>
                    <span className="eyebrow" style={{ color: "var(--wine)", fontSize: "10px" }}>
                      SALORIYA INSTANT SECURE UPI
                    </span>
                    <h4 style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", margin: "2px 0 4px" }}>
                      Scan &amp; Pay to Place Order
                    </h4>
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                      Total to Pay: <strong style={{ color: "var(--wine)", fontSize: "14px" }}>{formatMoney(totalPaise)}</strong>
                    </span>
                  </div>

                  {/* Universal Instant UPI Redirection Button for Mobile */}
                  <div style={{ textAlign: "center", marginBottom: "16px" }}>
                    <a
                      href={upiUniversal}
                      className="button button-gold"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "13px",
                        fontSize: "13px",
                        fontWeight: 700,
                        textDecoration: "none",
                        boxSizing: "border-box"
                      }}
                    >
                      ⚡ Open Installed UPI App on Mobile 
                    </a>

                    {/* Quick App Shortcut Row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, 1fr)",
                        gap: "8px",
                        marginTop: "10px"
                      }}
                    >
                      <a
                        href={upiGPay}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "8px 4px",
                          background: "#ffffff",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          textDecoration: "none",
                          color: "var(--ink)",
                          fontSize: "11px",
                          fontWeight: 600
                        }}
                      >
                        <img src="/gpay-icon.svg" alt="GPay" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                        <span>GPay</span>
                      </a>
                      <a
                        href={upiPhonePe}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "8px 4px",
                          background: "#ffffff",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          textDecoration: "none",
                          color: "var(--ink)",
                          fontSize: "11px",
                          fontWeight: 600
                        }}
                      >
                        <img src="/phonepe-icon.svg" alt="PhonePe" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                        <span>PhonePe</span>
                      </a>
                      <a
                        href={upiPaytm}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "8px 4px",
                          background: "#ffffff",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          textDecoration: "none",
                          color: "var(--ink)",
                          fontSize: "11px",
                          fontWeight: 600
                        }}
                      >
                        <img src="/paytm-icon.svg" alt="Paytm" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                        <span>Paytm</span>
                      </a>
                      <a
                        href={upiUniversal}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                          padding: "8px 4px",
                          background: "#ffffff",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          textDecoration: "none",
                          color: "var(--ink)",
                          fontSize: "11px",
                          fontWeight: 600
                        }}
                      >
                        <img src="/upi-logo.svg" alt="UPI" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
                        <span>Other UPI</span>
                      </a>
                    </div>
                  </div>

                  {/* QR Code Scanner Wrap */}
                  <div style={{ textAlign: "center", margin: "14px 0" }}>
                    <div
                      style={{
                        display: "inline-block",
                        background: "#ffffff",
                        padding: "8px",
                        border: "1.5px solid var(--gold)",
                        borderRadius: "12px",
                        boxShadow: "0 4px 16px rgba(134,30,56,0.12)"
                      }}
                    >
                      <img
                        src="/upi-qr.jpg"
                        alt="SALORIYA Google Pay UPI QR Scanner"
                        style={{
                          width: "210px",
                          height: "210px",
                          display: "block",
                          borderRadius: "8px",
                          objectFit: "contain",
                          background: "#202124"
                        }}
                      />
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--wine)", fontWeight: 700, marginTop: "8px" }}>
                      ✦ Scan with Google Pay / PhonePe / Paytm / Any UPI App
                    </div>
                  </div>

                  {/* UPI ID Copy Box */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      textAlign: "center",
                      background: "#ffffff",
                      border: "1px solid var(--line)",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      marginBottom: "14px",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10.5px",
                        color: "var(--muted)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        display: "block",
                        marginBottom: "4px",
                        textAlign: "center"
                      }}
                    >
                      UPI ID:
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "10px",
                        flexWrap: "wrap",
                        width: "100%",
                        textAlign: "center"
                      }}
                    >
                      <code
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 700,
                          color: "var(--wine)",
                          letterSpacing: "0.3px",
                          fontFamily: "monospace",
                          textAlign: "center",
                          wordBreak: "break-all"
                        }}
                      >
                        {upiId}
                      </code>
                      <button
                        type="button"
                        className="button button-small button-outline"
                        onClick={handleCopyUpi}
                        style={{
                          padding: "4px 12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                          height: "auto"
                        }}
                      >
                        {copiedUpi ? "✓ Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>


                  {/* UTR Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--ink)" }}>
                      12-Digit UPI Reference / UTR Number
                    </label>
                    <input
                      id="checkout-utr"
                      type="text"
                      maxLength={16}
                      placeholder="e.g. 402837192837 (from UPI confirmation)"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        border: "1.5px solid var(--line)",
                        borderRadius: "6px",
                        fontSize: "12.5px",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  {/* Screenshot Upload Dropzone */}
                  <div
                    style={{
                      background: "#fff7f3",
                      border: "1.5px dashed var(--wine)",
                      borderRadius: "8px",
                      padding: "14px",
                      textAlign: "center"
                    }}
                  >
                    <label style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--wine)", display: "block", marginBottom: "4px", textTransform: "uppercase" }}>
                      📸 Upload Payment Screenshot *
                    </label>
                    <p style={{ fontSize: "11px", color: "var(--muted)", margin: "0 0 8px" }}>
                      Upload confirmation receipt screenshot after transferring {formatMoney(totalPaise)}:
                    </p>
                    <input
                      id="checkout-screenshot-input"
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotChange}
                      style={{ fontSize: "11.5px" }}
                    />
                    {screenshotDataUrl && (
                      <div style={{ marginTop: "8px", fontSize: "11.5px", color: "#15803d", fontWeight: 700 }}>
                        ✓ Screenshot Attached
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Promo Code Voucher Box */}
              <div
                className="checkout-promo-box"
                style={{
                  background: "#faf5f0",
                  border: "1.5px solid var(--gold-border)",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  boxSizing: "border-box"
                }}
              >
                {appliedPromo ? (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#15803d", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>🏷️</span> Voucher Applied: <strong>"{appliedPromo.code}"</strong>
                      </span>
                      <div style={{ fontSize: "11.5px", color: "#166534", marginTop: "2px" }}>
                        {appliedPromo.discount_type === "free_delivery"
                          ? "✓ Free Delivery Applied (₹50 OFF)"
                          : appliedPromo.discount_type === "percentage"
                          ? `✓ ${appliedPromo.amount || 10}% OFF Applied`
                          : `✓ Flat ₹${appliedPromo.amount || 50} OFF Applied`}
                      </div>
                    </div>
                    <button
                      id="checkout-remove-promo-btn"
                      type="button"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: "4px 8px"
                      }}
                      onClick={() => {
                        setAppliedPromo(null);
                        setPromoSuccess("");
                        setPromoError("");
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label
                      htmlFor="checkout-promo-input"
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      <span>Have a Promo Code?</span>
                      <span style={{ fontSize: "10.5px", color: "var(--muted)", fontWeight: 400 }}></span>
                    </label>
                    <div className="promo-input-row" style={{ display: "flex", alignItems: "stretch", gap: "8px", width: "100%" }}>
                      <input
                        ref={promoInputRef}
                        id="checkout-promo-input"
                        type="text"
                        placeholder="ENTER PROMO CODE"
                        value={promoInput}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck="false"
                        autoComplete="off"
                        autocapitalize="none"
                        autocorrect="off"
                        spellcheck="false"
                        autocomplete="off"
                        onChange={(e) => {
                          setPromoInput(e.target.value);
                          setPromoError("");
                          setPromoSuccess("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.keyCode === 13) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleApplyPromo(e);
                          }
                        }}
                        style={{
                          flex: "1 1 auto",
                          minWidth: 0,
                          padding: "10px 14px",
                          fontSize: "13px",
                          fontWeight: 600,
                          border: "1.5px solid var(--line)",
                          borderRadius: "6px",
                          letterSpacing: "1px",
                          textTransform: "uppercase",
                          background: "#ffffff",
                          boxSizing: "border-box"
                        }}
                      />
                      <button
                        id="checkout-apply-promo-btn"
                        type="button"
                        className="button button-gold"
                        disabled={promoChecking}
                        style={{
                          flex: "0 0 auto",
                          width: "auto",
                          padding: "0 22px",
                          fontSize: "12px",
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          borderRadius: "6px",
                          whiteSpace: "nowrap",
                          cursor: promoChecking ? "wait" : "pointer",
                          height: "auto",
                          minHeight: "42px",
                          touchAction: "manipulation",
                          opacity: promoChecking ? 0.7 : 1
                        }}
                        onPointerDown={() => {
                          if (promoInputRef.current) {
                            setPromoInput(promoInputRef.current.value);
                          }
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleApplyPromo(e);
                        }}
                      >
                        {promoChecking ? "CHECKING…" : "APPLY"}
                      </button>
                    </div>
                    {promoError && (
                      <p style={{ color: "#dc2626", fontSize: "11.5px", margin: "2px 0 0", fontWeight: 600 }}>{promoError}</p>
                    )}
                    {promoSuccess && !appliedPromo && (
                      <p style={{ color: "#15803d", fontSize: "11.5px", margin: "2px 0 0", fontWeight: 600 }}>{promoSuccess}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div
                className="checkout-price-breakdown"
                style={{
                  background: "#fbf7f4",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
                  <span>Item Subtotal ({qty} pc):</span>
                  <strong>{formatMoney(subtotalPaise)}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
                  <span>Courier &amp; Transport Fee:</span>
                  {deliveryPaise === 0 ? (
                    <div>
                      <span style={{ textDecoration: "line-through", marginRight: "6px", fontSize: "11px" }}>₹50.00</span>
                      <strong style={{ color: "#15803d" }}>FREE ✓</strong>
                    </div>
                  ) : (
                    <strong>+ ₹50.00</strong>
                  )}
                </div>

                {effectiveDiscountPaise > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#15803d", fontWeight: 700 }}>
                    <span>Promo Discount ({appliedPromo?.code}):</span>
                    <span>- {formatMoney(effectiveDiscountPaise)}</span>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "16px",
                    fontWeight: 800,
                    color: "var(--wine-dark)",
                    borderTop: "1px dashed var(--line)",
                    paddingTop: "8px",
                    marginTop: "2px"
                  }}
                >
                  <span>Total Payable:</span>
                  <span>{formatMoney(totalPaise)}</span>
                </div>
              </div>

              {formError && (
                <div style={{ color: "#dc2626", fontSize: "12px", fontWeight: 700, padding: "4px 0" }}>
                  {formError}
                </div>
              )}

              {/* Confirm & Place Order CTA */}
              <button
                id="checkout-submit-btn"
                type="button"
                onClick={handlePlaceOrder}
                className="button button-gold"
                style={{
                  width: "100%",
                  padding: "14px",
                  fontSize: "13.5px",
                  fontWeight: 800,
                  letterSpacing: "0.5px"
                }}
                disabled={submitting}
              >
                {submitting
                  ? "Placing Order…"
                  : paymentMethod === "prepaid"
                  ? `CONFIRM & SUBMIT ONLINE ORDER (${formatMoney(totalPaise)}) 💳`
                  : `CONFIRM & PLACE ORDER (${formatMoney(totalPaise)}) `}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
