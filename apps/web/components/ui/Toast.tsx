"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone?: "neutral" | "strong" | "critical";
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

/**
 * Demo'daki showToast/showMessageToast'ın karşılığı — sayfa yenilenmeden
 * ekranın sağ altında beliren, birkaç saniye sonra kendiliğinden kaybolan
 * bildirim kutuları. bkz. components/layout/MessageToastWatcher.tsx (yeni
 * mesaj geldiğinde bu provider'ı tetikleyen polling izleyici).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = ++nextId.current;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), AUTO_DISMISS_MS);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: "fixed", bottom: 18, right: 18, zIndex: 200,
          display: "flex", flexDirection: "column", gap: 8, maxWidth: 340, pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card card-pad"
            style={{
              pointerEvents: "auto", boxShadow: "var(--shadow-lg)", display: "flex", gap: 10, alignItems: "flex-start",
              borderColor: t.tone === "critical" ? "var(--critical)" : t.tone === "strong" ? "var(--strong)" : "var(--border-strong)",
              animation: "seviye360-toast-in .22s var(--ease)",
            }}
          >
            <Icon name="bell" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 700 }}>{t.title}</p>
              {t.body && (
                <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {t.body}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Kapat"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", padding: 0, flex: "none" }}
            >
              <Icon name="x" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalıdır");
  return ctx;
}
