"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ROLE_LABEL, groupModules, modulesForActor } from "@/lib/nav-config";
import { clearActingTenant } from "@/lib/api/hq";
import { Icon } from "@/components/ui/icons";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MessageToastWatcher } from "@/components/layout/MessageToastWatcher";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { GuidedTour, restartGuidedTour } from "@/components/tour/GuidedTour";

// Demo'daki renderSidebar/renderTopbar'ın (bkz. demo/seviye360/seviye360-app.html)
// React karşılığı — tüm sayfaları (login hariç) aynı gruplu/rol bazlı sidebar +
// topbar kabuğuyla sarar. Kabuk verisi lib/nav-config.tsx'teki MODULES_BY_ROLE'den
// gelir (DashboardHub ile aynı kaynak, tek doğruluk noktası).
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  const exitActingMutation = useMutation({
    mutationFn: clearActingTenant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.me() }),
  });

  if (pathname === "/login" || !me) {
    return <>{children}</>;
  }

  const modules = modulesForActor(me.role, me.actingTenantId);
  const groups = groupModules(modules);
  const currentModule = modules.find((m) => pathname.startsWith(m.href));
  const isActingAsBranch = me.role === "SUPERADMIN" && !!me.actingTenantId;

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  return (
    <div className="app">
      <MessageToastWatcher />
      <CommandPalette role={me.role} actingTenantId={me.actingTenantId} open={cmdOpen} onOpenChange={setCmdOpen} />
      <GuidedTour />
      <a href="#content" className="skip-link">İçeriğe atla</a>
      <div className={`sidebar-scrim ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <nav className={`sidebar ${sidebarOpen ? "open" : ""}`} aria-label="Ana gezinme">
        <div className="brand-block" data-tour="brand">
          <div className="mark">Seviye 360</div>
          <div className="tag">{ROLE_LABEL[me.role] ?? me.role}</div>
        </div>
        <Link href="/dashboard" className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`} onClick={() => setSidebarOpen(false)} data-tour="nav-modules">
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
            <button
              type="button"
              className="btn sm"
              onClick={() => setCmdOpen(true)}
              aria-label="Komut paletini aç"
              title="Komut paleti (Ctrl/Cmd+K)"
              data-tour="cmdk-trigger"
            >
              <Icon name="search" />
              <span className="hide-mobile">Ara</span>
              <kbd style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)", border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 5px", marginLeft: 4 }}>
                ⌘K
              </kbd>
            </button>
            <span className="live-chip">
              <span className="dot" />
              {me.firstName} {me.lastName}
            </span>
            <span data-tour="theme-toggle">
              <ThemeToggle />
            </span>
            <button type="button" className="btn sm" onClick={restartGuidedTour} aria-label="Rehberli turu başlat" title="Rehberli tur">
              <Icon name="help" />
            </button>
            <button type="button" className="btn sm" onClick={handleLogout}>
              Çıkış Yap
            </button>
          </div>
        </div>
        {isActingAsBranch && (
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "8px 20px", background: "var(--brand-tint)", color: "var(--brand-strong)",
              fontSize: "var(--text-xs)", fontWeight: 600, borderBottom: "1px solid var(--border)",
            }}
          >
            <span>
              Şu an <b>{me.actingTenantName ?? "bir şube"}</b> şubesi adına Şube Yöneticisi yetkisiyle işlem yapıyorsunuz.
            </span>
            <button type="button" className="btn xs" disabled={exitActingMutation.isPending} onClick={() => exitActingMutation.mutate()}>
              {exitActingMutation.isPending ? "Çıkılıyor…" : "Şubeden Çık"}
            </button>
          </div>
        )}
        <main id="content" className="content" tabIndex={-1} data-tour="content">
          {children}
        </main>
      </div>
    </div>
  );
}
