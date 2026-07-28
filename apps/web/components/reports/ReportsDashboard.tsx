"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { downloadReport, fetchFinancialSummary, reportsKeys } from "@/lib/api/reports";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReportCard({ icon, title, description, actionLabel, onAction }: { icon: string; title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">
          {icon} {title}
        </h3>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f]"
      >
        {actionLabel}
      </button>
    </div>
  );
}

/**
 * Raporlar / Dışa Aktarım Merkezi — demo/seviye360-app.html'deki
 * "branch:raporlar" ekranının gerçek karşılığı. Demo'nun kendi yorumundaki
 * gibi ("Yeni veri modeli gerektirmez") yeni bir tablo eklemez — mevcut
 * StudentProfile/StaffProfile/AttendanceRecord/ExamResult/AccountingLedgerEntry
 * verisinden anında CSV/görüntülenebilir rapor üretir (bkz.
 * app/api/branch/reports/*).
 */
export function ReportsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showFinancial, setShowFinancial] = useState(false);

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

  const financialQuery = useQuery({
    queryKey: reportsKeys.financialSummary(),
    queryFn: fetchFinancialSummary,
    enabled: showFinancial,
  });

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Raporlar/Dışa Aktarım yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const financial = financialQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Raporlar / Dışa Aktarım</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ana Sayfa
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Mevcut kurum verinizden anında oluşan raporlar — CSV olarak indirin veya görüntüleyin.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ReportCard
          icon="👥"
          title="Öğrenci Listesi"
          description="Öğrenci no, ad, sınıf, veli, ödeme durumu."
          actionLabel="İndir (CSV)"
          onAction={() => downloadReport("/api/branch/reports/students")}
        />
        <ReportCard
          icon="🛡️"
          title="Personel Listesi"
          description="Ad, rol, branş/departman, telefon, durum."
          actionLabel="İndir (CSV)"
          onAction={() => downloadReport("/api/branch/reports/staff")}
        />
        <ReportCard
          icon="📅"
          title="Devamsızlık Özeti"
          description="Sınıf bazlı alınan gün sayısı ve devamsızlık oranı."
          actionLabel="İndir (CSV)"
          onAction={() => downloadReport("/api/branch/reports/attendance-summary")}
        />
        <ReportCard
          icon="📊"
          title="Sınav Sonuçları Özeti"
          description="Öğrenci bazlı genel ortalama net."
          actionLabel="İndir (CSV)"
          onAction={() => downloadReport("/api/branch/reports/exam-summary")}
        />
        <ReportCard
          icon="📒"
          title="Mali Özet"
          description="Kategori bazlı gelir/gider dökümü ve net kâr."
          actionLabel="Görüntüle"
          onAction={() => setShowFinancial(true)}
        />
      </div>

      {showFinancial && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Mali Özet Raporu</h2>
            <button type="button" onClick={() => setShowFinancial(false)} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
              Kapat
            </button>
          </div>
          {financialQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {financial && (
            <>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="pb-2">Tür</th>
                      <th className="pb-2">Kategori</th>
                      <th className="pb-2 text-right">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.rows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-slate-500 dark:text-slate-400">
                          Kayıt yok
                        </td>
                      </tr>
                    )}
                    {financial.rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1.5">{r.type === "GELIR" ? "Gelir" : "Gider"}</td>
                        <td className="py-1.5">{r.category}</td>
                        <td className="py-1.5 text-right">{formatTl(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Toplam Gelir</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">{formatTl(financial.totalIncome)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Toplam Gider</span>
                  <span className="font-medium text-slate-900 dark:text-slate-50">{formatTl(financial.totalExpense)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span>Net Kâr</span>
                  <span>{formatTl(financial.netProfit)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
