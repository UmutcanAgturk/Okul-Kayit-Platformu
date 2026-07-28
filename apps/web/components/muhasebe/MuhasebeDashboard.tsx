"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { LedgerPanel } from "./LedgerPanel";
import { InstallmentsPanel } from "./InstallmentsPanel";
import { PayrollPanel } from "./PayrollPanel";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];
const TABS = [
  { id: "genel", label: "Genel Bakış (Kayıt Defteri)" },
  { id: "tahsilat", label: "Tahsilat Takibi" },
  { id: "bordro", label: "Bordro" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Muhasebe modülünün ilk gerçek (localStorage değil, Postgres'e karşı çalışan)
 * ekranı. demo/seviye360-app.html'deki Muhasebe sekmesinin aynısı DEĞİL —
 * yalnızca o ekranda zaten karşılığı olan üç bölümü (Kayıt Defteri, Tahsilat
 * Takibi, Bordro) kapsar; Fatura/Dekont/Senet henüz buraya taşınmadı (bkz.
 * kök README.md'deki "sıradaki" notu).
 */
export function MuhasebeDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Muhasebe yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Muhasebe</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : "Muhasebe"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Çıkış Yap
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "border-b-2 px-4 py-2 text-sm font-medium transition " +
              (tab === t.id
                ? "border-[#0071ce] text-[#0071ce]"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "genel" && <LedgerPanel />}
      {tab === "tahsilat" && <InstallmentsPanel />}
      {tab === "bordro" && <PayrollPanel />}
    </div>
  );
}
