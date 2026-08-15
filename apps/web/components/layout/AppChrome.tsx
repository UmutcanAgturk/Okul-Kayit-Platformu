"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ROLE_LABEL, groupModules, MODULES_BY_ROLE } from "@/lib/nav-config";
import { Icon } from "@/components/ui/icons";

// Demo'daki renderSidebar/renderTopbar'ın (bkz. demo/seviye360/seviye360-app.html)
// React karşılığı — tüm sayfaları (login hariç) aynı gruplu/rol bazlı sidebar +
// topbar kabuğuyla sarar. Kabuk verisi lib/nav-config.tsx'teki MODULES_BY_ROLE'den
// gelir (DashboardHub ile aynı kaynak, tek doğruluk noktası).
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  if (pathname === "/login" || !me) {
    return <>{children}</>;
  }

  const modules = MODULES_BY_ROLE[me.role] ?? [];
  const groups = groupModules(modules);
  const currentModule = modules.find((m) => pathname.startsWith(m.href));

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="app">
      <a href="#content" className="skip-link">İçeriğe atla</a>
      <div className={`sidebar-scrim ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Ana gezinme">
        <div className="brand-block">
          <div className="mark">Seviye 360</div>
          <div className="tag">{ROLE_LABEL[me.role] ?? me.role}</div>
        </div>
        <Link href="/dashboard" className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`} onClick={() => setSidebarOpen(false)}>
          <Icon name="grid" />
          <span>Modüller</span>
        </Link>
        {groups.map((g) => (
          <div className="nav-group" key={g.label}>
            <div className="nav-eyebrow-btn">
              <span className="nav-eyebrow">{g.label}</span>
            </div>
            <div className="nav-group-items">
              {g.items.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`nav-item ${pathname.startsWith(m.href) ? "active" : ""}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon name={m.icon} />
                  <span>{m.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="main">
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button type="button" className="sidebar-toggle" onClick={() => setSidebarOpen(true)} aria-label="Menüyü aç">
              <Icon name="grid" />
            </button>
            <div className="crumb">
              <b>Seviye 360</b>
              <span className="sep">›</span>
              {currentModule?.title ?? "Modüller"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="live-chip">
              <span className="dot" />
              {me.firstName} {me.lastName}
            </span>
            <button type="button" className="btn sm" onClick={handleLogout}>
              Çıkış Yap
            </button>
          </div>
        </div>
        <main id="content" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
