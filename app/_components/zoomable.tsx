"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Wrap any thumbnail to make it click-to-open in a full-screen lightbox. Esc / backdrop / ✕ closes.
export function Zoomable({ src, caption, children }: { src?: string | null; caption?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!src) return <>{children}</>;

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
        }}
        role="button"
        tabIndex={0}
        aria-label={caption ? `Open ${caption}` : "Open image"}
        style={{ cursor: "zoom-in" }}
      >
        {children}
      </div>
      {open && mounted &&
        createPortal(
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background: "rgba(6,7,11,.88)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 32,
              animation: "fadeIn .12s ease",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 18,
                right: 22,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              {caption && (
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted-2)" }}>{caption}</span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                  color: "var(--ink)",
                  background: "var(--panel)",
                  border: "1px solid var(--line-frame)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  cursor: "pointer",
                }}
              >
                ✕ Esc
              </button>
            </div>
            <img
              src={src}
              alt={caption || ""}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "92vw",
                maxHeight: "88vh",
                borderRadius: 12,
                border: "1px solid var(--line-frame)",
                boxShadow: "0 30px 90px rgba(0,0,0,.6)",
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
