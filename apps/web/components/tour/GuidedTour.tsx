"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModuleCard } from "@/lib/nav-config";

const STORAGE_KEY = "seviye360-tour-seen";

interface TourStep {
  target: string; // data-tour değeri
  title: string;
  body: string;
  href?: string; // verilirse bu adıma geçerken gerçek ekrana gidilir
}

const INTRO_STEPS: TourStep[] = [
  { target: "brand", title: "Seviye 360'a Hoş Geldiniz", body: "Bu kısa tur, platformun ana bölümlerini gerçek ekranlara giderek tanıtır. İstediğiniz an Esc'e basarak çıkabilirsiniz." },
  { target: "nav-modules", title: "Modüller", body: "Sol menüden rolünüze açık tüm modüllere erişebilirsiniz — gruplara ayrılmış şekilde listelenir." },
];
const OUTRO_STEPS: TourStep[] = [
  { target: "cmdk-trigger", title: "Komut Paleti", body: "Herhangi bir modülü ya da öğrenci/personel adını hızlıca aramak için Ctrl/Cmd+K'ya basın veya bu butona tıklayın.", href: "/dashboard" },
  { target: "theme-toggle", title: "Tema", body: "Açık/koyu tema arasında buradan geçiş yapabilirsiniz." },
];

// Turun gerçek ekranlara gitmesi (task #94) — demo'daki startTour()'un
// Bugün/Şube Haritası/Ölçme-Değerlendirme/Lider Tablosu/Karne/Aktivite Akışı
// gibi canlı ekranlara gidip veriyi anlatan davranışının karşılığı. Her rol
// farklı modüllere sahip olduğundan (bkz. lib/nav-config.tsx MODULES_BY_ROLE)
// adımlar SABİT bir href listesi değil, aktörün GERÇEKTEN erişebildiği
// modüller arasından, aşağıdaki öncelik sırasına göre eşleştirilerek
// dinamik kurulur — bir rolde olmayan bir modül için asla adım üretilmez.
// Açıklama metni olarak modülün kendi (nav-config'teki) description'ı
// kullanılır, böylece her ekran için ayrıca metin yazmaya gerek kalmaz.
const HIGHLIGHT_TITLES = ["Bugün", "Şube Performans Haritası", "Ölçme-Değerlendirme", "Aktivite Akışı", "Lider Tablosu", "Karne"];

function buildSteps(modules: ModuleCard[]): TourStep[] {
  const highlightSteps: TourStep[] = HIGHLIGHT_TITLES.map((title) => modules.find((m) => m.title === title))
    .filter((m): m is ModuleCard => !!m)
    .map((m) => ({ target: "content", title: m.title, body: m.description, href: m.href }));
  return [...INTRO_STEPS, ...highlightSteps, ...OUTRO_STEPS];
}

/**
 * demo/seviye360-app.html'deki startTour()'un karşılığı — platformun ana
 * bölümlerini adım adım tanıtan, DOM'daki data-tour="..." işaretli elemanları
 * spotlight'layan hafif bir rehberli tur katmanı. İlk girişte otomatik
 * başlar (localStorage), sonrasında AppChrome'daki "Tur" butonundan elle
 * tekrar başlatılabilir.
 */
export function GuidedTour({ modules }: { modules: ModuleCard[] }) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const steps = buildSteps(modules);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setStepIndex(0);
    }
    function handleStart() {
      setStepIndex(0);
    }
    window.addEventListener("seviye360:start-tour", handleStart);
    return () => window.removeEventListener("seviye360:start-tour", handleStart);
  }, []);

  useEffect(() => {
    if (stepIndex === null) return;
    const step = steps[stepIndex];
    if (step?.href) router.push(step.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;
    function updateRect() {
      const step = steps[stepIndex!];
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    updateRect();
    window.addEventListener("resize", updateRect);
    // Sayfa gezinmesi sonrası hedef eleman render edilene kadar birkaç kez dener.
    const timers = [50, 150, 350].map((ms) => setTimeout(updateRect, ms));
    return () => {
      window.removeEventListener("resize", updateRect);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    if (stepIndex === null) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  function finish() {
    localStorage.setItem(STORAGE_KEY, "1");
    setStepIndex(null);
  }

  if (stepIndex === null) return null;
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const cardTop = rect ? Math.min(window.innerHeight - 180, rect.bottom + 12) : window.innerHeight / 2 - 80;
  const cardLeft = rect ? Math.min(window.innerWidth - 320, Math.max(12, rect.left)) : window.innerWidth / 2 - 160;

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,14,20,.55)", zIndex: 150 }} onClick={finish} />
      {rect && (
        <div
          style={{
            position: "fixed", zIndex: 151, pointerEvents: "none",
            top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12,
            border: "2px solid var(--brand)", borderRadius: 10, boxShadow: "0 0 0 4000px rgba(10,14,20,.55)",
            transition: "all .18s var(--ease)",
          }}
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", top: cardTop, left: cardLeft, width: 300, zIndex: 152,
          background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-strong)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", padding: 16,
        }}
      >
        <p style={{ margin: 0, fontSize: "var(--text-2xs)", color: "var(--ink-faint)", fontWeight: 700 }}>
          Adım {stepIndex + 1} / {steps.length}
        </p>
        <h3 style={{ margin: "4px 0 6px", fontSize: "var(--text-base)", fontWeight: 800 }}>{step.title}</h3>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{step.body}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <button type="button" className="btn xs" onClick={finish}>
            Turu Atla
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            {stepIndex > 0 && (
              <button type="button" className="btn xs" onClick={() => setStepIndex((i) => (i ?? 0) - 1)}>
                Geri
              </button>
            )}
            <button type="button" className="btn primary xs" onClick={() => (isLast ? finish() : setStepIndex((i) => (i ?? 0) + 1))}>
              {isLast ? "Bitir" : "İleri"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function restartGuidedTour() {
  window.dispatchEvent(new Event("seviye360:start-tour"));
}
