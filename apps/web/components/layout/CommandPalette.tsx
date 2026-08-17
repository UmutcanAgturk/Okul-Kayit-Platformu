"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { UserRole } from "@/lib/api/auth";
import { modulesForActor, type ModuleCard } from "@/lib/nav-config";
import { searchCommandPalette } from "@/lib/api/command-palette";
import { Icon } from "@/components/ui/icons";

// Modül kartlarıyla aynı biçimde ele alınabilsin diye (bkz. results.map
// aşağıda) DB'den gelen öğrenci/personel/kurum sonuçları da birer sanal
// "ModuleCard"a dönüştürülür — href'leri gerçek bir nav-config kartına denk
// gelmez, doğrudan ilgili listeleme ekranına (öğrenci/kurum için derin
// bağlantılı) gider.
interface ResultItem extends ModuleCard {
  kind: "module" | "student" | "staff" | "institution";
}

/**
 * demo/seviye360-app.html'deki Komut Paleti'nin (Ctrl/Cmd+K, openCommandPalette/
 * renderCommandPaletteResults) karşılığı — nav-config'teki modüller üzerinde
 * anlık arama yapar, ok tuşlarıyla gezilir, Enter ile gidilir, Esc ile kapanır.
 * task #93: 2+ karakterlik bir sorguda modül adı aramasına ek olarak öğrenci
 * adı/no, personel adı ve (HQ'da) kurum adı da gruplu şekilde aranır.
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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const modules = modulesForActor(role, actingTenantId);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 180);
    return () => clearTimeout(t);
  }, [query]);

  const searchQuery = useQuery({
    queryKey: ["command-palette-search", debouncedQuery],
    queryFn: () => searchCommandPalette(debouncedQuery),
    enabled: open && debouncedQuery.length >= 2,
  });
  const searchHits = debouncedQuery.length >= 2 ? searchQuery.data : undefined;

  const moduleResults: ResultItem[] = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const base = !q
      ? modules
      : modules.filter(
          (m) => m.title.toLocaleLowerCase("tr-TR").includes(q) || m.description.toLocaleLowerCase("tr-TR").includes(q) || m.group.toLocaleLowerCase("tr-TR").includes(q),
        );
    return base.map((m) => ({ ...m, kind: "module" as const }));
  }, [modules, query]);

  const studentResults: ResultItem[] = (searchHits?.students ?? []).map((s) => ({
    href: `/ogrenciler?student=${s.id}`,
    title: s.name,
    description: `Öğrenci No: ${s.studentNo}`,
    icon: "users",
    group: "Öğrenciler",
    kind: "student",
  }));
  const staffResults: ResultItem[] = (searchHits?.staff ?? []).map((s) => ({
    href: "/personel",
    title: s.name,
    description: s.title ? s.title : "Personel",
    icon: "briefcase",
    group: "Personel",
    kind: "staff",
  }));
  const institutionResults: ResultItem[] = (searchHits?.institutions ?? []).map((t) => ({
    href: "/kurumlar",
    title: t.name,
    description: t.city,
    icon: "map",
    group: "Kurumlar",
    kind: "institution",
  }));

  const results: ResultItem[] = [...studentResults, ...staffResults, ...institutionResults, ...moduleResults];

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

  function go(m: ResultItem) {
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
            placeholder="Ara… modül, öğrenci adı/no, personel adı, kurum adı"
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
              key={`${m.kind}-${m.href}-${m.title}`}
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
