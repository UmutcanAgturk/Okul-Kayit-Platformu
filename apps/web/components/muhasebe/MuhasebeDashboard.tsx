"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { LedgerPanel } from "./LedgerPanel";
import { InstallmentsPanel } from "./InstallmentsPanel";
import { PayrollPanel } from "./PayrollPanel";
import { BelgelerPanel } from "./BelgelerPanel";
import { StatistikTab } from "./StatistikTab";
import { BeklentiTab } from "./BeklentiTab";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];
const TABS = [
  { id: "genel", label: "Genel Bakış (Kayıt Defteri)" },
  { id: "istatistik", label: "İstatistikler" },
  { id: "tahsilat", label: "Tahsilat Takibi" },
  { id: "beklenti", label: "Beklentiler" },
  { id: "bordro", label: "Bordro" },
  { id: "belgeler", label: "Belgeler (Fatura/Dekont/Senet)" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Muhasebe modülünün gerçek (localStorage değil, Postgres'e karşı çalışan)
 * ekranı — Kayıt Defteri, Tahsilat Takibi, Bordro ve Belgeler (Fatura/Dekont/
 * Senet) bölümlerini kapsar (bkz. kök README.md).
 */
export function MuhasebeDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("genel");

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Muhasebe yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Muhasebe</h1>
      <p className="lede">
        {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : me.role === "SUPERADMIN" ? "Genel Merkez (Şube Yöneticisi yetkisiyle)" : "Muhasebe"}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`screen-tab ${tab === t.id ? "active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "genel" && <LedgerPanel />}
      {tab === "istatistik" && <StatistikTab />}
      {tab === "tahsilat" && <InstallmentsPanel isSuperadmin={me.role === "SUPERADMIN"} />}
      {tab === "beklenti" && <BeklentiTab />}
      {tab === "bordro" && <PayrollPanel />}
      {tab === "belgeler" && <BelgelerPanel />}
    </div>
  );
}
