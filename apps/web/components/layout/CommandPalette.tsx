"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/api/auth";
import { modulesForActor, type ModuleCard } from "@/lib/nav-config";
import { Icon } from "@/components/ui/icons";

/**
 * demo/seviye360-app.html'deki Komut Paleti'nin (Ctrl/Cmd+K, openCommandPalette/
 * renderCommandPaletteResults) karşılığı — nav-config'teki modüller üzerinde
 * anlık arama yapar, ok tuşlarıyla gezilir, Enter ile gidilir, Esc ile kapanır.
 */
export function CommandPalette({
  role,
  actingTenantId,
  open,
  onOpenChange,
}: {
  role: UserRole;
  actingTenantId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const setOpen = onOpenChange;
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const modules = modulesForActor(role, actingTenantId);

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return modules;
    return modules.filter(
      (m) => m.title.toLocaleLowerCase("tr-TR").includes(q) || m.description.toLocaleLowerCase("tr-TR").includes(q) || m.group.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [modules, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  function go(m: ModuleCard) {
    setOpen(false);
    router.push(m.href);
  }

  function handleInputKeydown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[activeIndex]) go(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(10,14,20,.45)", backdropFilter: "blur(1px)", zIndex: 120 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", top: "16vh", left: "50%", transform: "translateX(-50%)",
          width: "min(560px, 92vw)", maxHeight: "60vh", background: "var(--surface)", color: "var(--ink)",
          border: "1px solid var(--border-strong)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
          zIndex: 121, display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeydown}
            placeholder="Modül ara… (ör. muhasebe, öğrenciler, ders programı)"
            style={{ flex: 1, border: "none", outline: "none", background: "transparent", color: "var(--ink)", fontSize: "var(--text-base)" }}
          />
          <kbd style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 5px" }}>Esc</kbd>
        </div>
        <div style={{ overflowY: "auto", padding: 6 }}>
          {results.length === 0 && (
            <p style={{ margin: "20px 16px", fontSize: "var(--text-sm)", color: "var(--ink-faint)" }}>Sonuç bulunamadı.</p>
          )}
          {results.map((m, i) => (
            <button
              key={m.href}
              type="button"
              onClick={() => go(m)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`nav-item ${i === activeIndex ? "active" : ""}`}
              style={{ width: "100%", textAlign: "left" }}
            >
              <Icon name={m.icon} />
              <span>
                <b>{m.title}</b>
                <span className="sub">{m.group}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
