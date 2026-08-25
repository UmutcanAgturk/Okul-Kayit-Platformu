"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ModuleCard } from "@/lib/nav-config";
import { Icon } from "@/components/ui/icons";

const SEEN_KEY = "seviye360.tour-seen";

interface TourStep {
  title: string;
  body: string;
  /** Varsa "Bu modüle git" düğmesi çıkar (yalnız kullanıcının erişebildiği modüller). */
  moduleHref?: string;
}

/** Rol-bağımsız genel adımlar + kullanıcının sahip olduğu birkaç öne çıkan modül. */
function buildSteps(modules: ModuleCard[]): TourStep[] {
  const has = (href: string) => modules.some((m) => m.href === href);
  const steps: TourStep[] = [
    { title: "Seviye 360'a Hoş Geldiniz 👋", body: "Bu kısa tur, panelin nasıl kullanılacağını ve size açık olan modülleri gösterir. İstediğiniz an 'Kapat' ile çıkabilirsiniz." },
    { title: "Modül Arama", body: "Üstteki 'Modül Ara' kutusuna yazarak tüm modüller arasında isme veya açıklamaya göre anında filtreleme yapabilirsiniz." },
    { title: "Sık Kullanılanlar", body: "En çok açtığınız modüller otomatik olarak 'Sık Kullanılanlar' bölümünde kısayol olarak toplanır — sık işleriniz hep elinizin altında." },
    { title: "Kategoriler", body: "Modüller 'Kayıt İşlemleri', 'Akademik', 'Yönetim & Finans' gibi başlıklar altında gruplanır; aradığınızı hızlıca bulmanızı sağlar." },
  ];
  const highlights: TourStep[] = [
    { title: "Öğrenci Kaydı", body: "Yeni öğrenci ve veli kaydını buradan yaparsınız. İlk şifre T.C. Kimlik No olarak verilir ve veliye e-posta ile iletilir.", moduleHref: "/normal-kayit" },
    { title: "Ölçme-Değerlendirme", body: "Sınav sonuçlarını girer, AI Sınıf Röntgeni ile kazanım ısı haritasını görürsünüz.", moduleHref: "/olcme-degerlendirme" },
    { title: "Global Analytics", body: "Tüm şubelerin konsolide akademik başarı ve gelir analizini tek ekranda görürsünüz.", moduleHref: "/analytics" },
    { title: "Muhasebe", body: "Tahsilat, taksit ve mali özet işlemleri burada yönetilir.", moduleHref: "/muhasebe" },
  ];
  return [...steps, ...highlights.filter((h) => h.moduleHref && has(h.moduleHref))];
}

export function GuidedTour({ modules }: { modules: ModuleCard[] }) {
  const router = useRouter();
  const steps = useMemo(() => buildSteps(modules), [modules]);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  // İlk ziyarette otomatik aç (bir kez).
  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* yoksay */
    }
  }, []);

  function close() {
    setOpen(false);
    setI(0);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* yoksay */
    }
  }

  const step = steps[i];
  const isLast = i === steps.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={() => { setI(0); setOpen(true); }}
        className="btn secondary sm"
        style={{ position: "fixed", right: 18, bottom: 18, zIndex: 40, display: "inline-flex", alignItems: "center", gap: 6, boxShadow: "var(--shadow-md, 0 4px 16px rgba(0,0,0,.18))" }}
        aria-label="Rehberli Tur"
      >
        <Icon name="help" /> Rehberli Tur
      </button>

      {open && step && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card card-pad"
            style={{ maxWidth: 440, width: "100%", background: "var(--surface, #fff)", display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="chip strong" style={{ fontSize: "var(--text-xs)" }}>{i + 1} / {steps.length}</span>
              <button type="button" onClick={close} className="btn ghost sm" aria-label="Kapat">Kapat</button>
            </div>
            <h3 style={{ margin: 0 }}>{step.title}</h3>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)", lineHeight: 1.6 }}>{step.body}</p>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              {step.moduleHref && (
                <button type="button" className="btn sm" onClick={() => { close(); router.push(step.moduleHref!); }}>
                  Bu modüle git
                </button>
              )}
              <div style={{ flex: 1 }} />
              {i > 0 && (
                <button type="button" className="btn secondary sm" onClick={() => setI((n) => Math.max(0, n - 1))}>Geri</button>
              )}
              {isLast ? (
                <button type="button" className="btn primary sm" onClick={close}>Bitir</button>
              ) : (
                <button type="button" className="btn primary sm" onClick={() => setI((n) => Math.min(steps.length - 1, n + 1))}>İleri</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
