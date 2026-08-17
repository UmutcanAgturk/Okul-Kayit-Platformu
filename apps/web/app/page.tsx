"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const LANDING_FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: "map", title: "Çok Şubeli Genel Merkez Yönetimi", desc: "Tüm kurumları, öğrencileri ve personeli tek panelden yönetin; şube bazlı veya konsolide raporlar alın." },
  { icon: "chart", title: "Ölçme-Değerlendirme & Yapay Zeka", desc: "Optik sonuç girişi, kazanım analizi ve öğrenciye özel yapay zeka destekli performans yorumları." },
  { icon: "wallet", title: "Uçtan Uca Muhasebe", desc: "Fatura, dekont, senet ve tahsilat takibini tek bir kayıt defterinde otomatikleştirin." },
  { icon: "trophy", title: "Gamification & Lider Tablosu", desc: "XP, seviye ve rozetler; gerçek akademik ve davranışsal verilerden otomatik hesaplanır." },
  { icon: "calendar", title: "Devamsızlık, Program & Karne", desc: "Yoklama, haftalık ders programı ve dönemsel karneler tek bir akademik akışta." },
  { icon: "heart", title: "Öğrenci Yaşamı", desc: "Kulüpler, veli görüşmeleri, disiplin takibi ve servis/ulaşım yönetimi bir arada." },
  { icon: "flag", title: "Rehberli Tur Modu", desc: "Yeni kullanıcılar platformun öne çıkan modüllerini adım adım, gerçek verilerle keşfeder." },
  { icon: "grid", title: "Her Cihazda Sorunsuz", desc: "Masaüstünden telefona, karanlık moddan aydınlık moda kesintisiz bir deneyim." },
];

const LANDING_PORTALS = [
  { label: "Genel Merkez", desc: "Süperadmin görünümüyle tüm şubelere ve verilere tam erişim." },
  { label: "Şube Yönetimi", desc: "Şube müdürü kendi kurumunun kayıt, akademik ve mali işlerini yönetir." },
  { label: "Öğretmen", desc: "Sınıfını, devamsızlığı ve etüt/mentörlük randevularını tek ekrandan görür." },
  { label: "Öğrenci & Veli", desc: "Karne, ödeme, devamsızlık ve mesajlaşmaya güvenli ve sade bir arayüzden erişir." },
];

/**
 * Giriş öncesi tanıtım (landing) sayfası — demo/seviye360-app.html'deki
 * renderLandingScreen()'in gerçek karşılığı. Demo'nun "veriler yalnızca
 * tarayıcınızda saklanır" rozeti buraya taşınmadı — bu depoda gerçek bir
 * Postgres + RLS backend'i var (bkz. lib/db-context.ts), o yüzden metin
 * bunu doğru yansıtır. Zaten oturumu açık bir kullanıcı "/" adresine
 * gelirse doğrudan /dashboard'a yönlendirilir (bkz. AppChrome'daki
 * `!me` kontrolüyle aynı fetchMe sorgusu).
 */
export default function LandingPage() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });

  useEffect(() => {
    if (me) router.replace("/dashboard");
  }, [me, router]);

  return (
    <div className="landing">
      <nav className="landing-nav">
        <div className="brand-block" style={{ padding: 0 }}>
          <div className="mark">Seviye 360</div>
        </div>
        <div className="landing-nav-actions">
          <ThemeToggle />
          <Link href="/login" className="btn primary sm">
            Giriş Yap
          </Link>
        </div>
      </nav>

      <section className="landing-hero-section">
        <span className="landing-badge">
          <Icon name="star" />
          Çok Şubeli Okul Yönetim Platformu
        </span>
        <h1>Okulunuzun tüm operasyonunu tek bir platformdan yönetin</h1>
        <p>
          Seviye 360; kayıt, akademik takip, muhasebe ve iletişimi Genel Merkez&apos;den öğrenciye kadar tek bir
          güvenli platformda birleştirir.
        </p>
        <div className="landing-cta-row">
          <Link href="/login" className="btn primary">
            Giriş Yap
          </Link>
          <a href="#landing-features" className="btn">
            Modülleri Gör
          </a>
        </div>
        <div className="landing-proof">
          <Icon name="shield" />
          <span>
            <b>Gerçek bir backend üzerinde çalışır:</b> bcrypt + JWT kimlik doğrulama, iptal edilebilir oturumlar ve
            PostgreSQL Row-Level Security ile şubeler arasında veritabanı seviyesinde tam izolasyon.
          </span>
        </div>
      </section>

      <section className="landing-section" id="landing-features">
        <div className="landing-section-head">
          <h2>Tek platformda onlarca modül</h2>
          <p>Kayıttan mezuniyete, her adımı kapsayan uçtan uca bir okul yönetim sistemi.</p>
        </div>
        <div className="landing-feature-grid">
          {LANDING_FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="icon-wrap">
                <Icon name={f.icon} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-head">
          <h2>Herkese özel bir portal</h2>
          <p>Rol bazlı erişimle her kullanıcı yalnızca kendisiyle ilgili olanı görür.</p>
        </div>
        <div className="landing-portal-grid">
          {LANDING_PORTALS.map((p) => (
            <div key={p.label} className="landing-portal-card">
              <b>{p.label}</b>
              <span>{p.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <Link href="/login" className="btn primary">
          Giriş Yap
        </Link>
        <p>Seviye 360 — Okul Yönetim ve Kayıt Platformu.</p>
      </footer>
    </div>
  );
}
