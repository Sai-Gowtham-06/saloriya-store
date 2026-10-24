import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AdminDeleteConfirmModal({
  isOpen,
  title = "Confirm Deletion",
  itemName,
  message,
  confirmLabel = "Yes, Delete",
  isDeleting = false,
  onConfirm,
  onClose
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="admin-modal"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px"
      }}
    >
      <div
        className="admin-modal-backdrop"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(45, 20, 27, 0.65)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          zIndex: 1
        }}
        onClick={!isDeleting ? onClose : undefined}
      />
      <div
        className="admin-modal-card"
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "440px",
          width: "100%",
          textAlign: "center",
          padding: "32px 28px",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid rgba(220, 38, 38, 0.2)",
          boxShadow: "0 25px 60px rgba(134, 30, 56, 0.35)",
          animation: "modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            margin: "0 auto 16px",
            borderRadius: "50%",
            background: "#fee2e2",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px"
          }}
        >
          🗑️
        </div>

        <h3
          style={{
            fontFamily: "'Playfair Display', serif",
            color: "var(--maroon, #861e38)",
            fontSize: "22px",
            margin: "0 0 8px",
            fontWeight: 600
          }}
        >
          {title}
        </h3>

        {itemName && (
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#1f2937",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "8px 12px",
              margin: "0 0 12px",
              wordBreak: "break-word"
            }}
          >
            {itemName}
          </p>
        )}

        <p
          style={{
            fontSize: "13px",
            color: "#4b5563",
            lineHeight: "1.6",
            margin: "0 0 24px"
          }}
        >
          {message || "Are you sure you want to permanently delete this item? This action cannot be undone."}
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button
            type="button"
            className="button button-outline"
            onClick={onClose}
            disabled={isDeleting}
            style={{ minWidth: "110px", padding: "10px 18px", borderRadius: "8px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              minWidth: "130px",
              padding: "10px 18px",
              borderRadius: "8px",
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              fontWeight: 700,
              cursor: isDeleting ? "not-allowed" : "pointer"
            }}
          >
            {isDeleting ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
