"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { downloadReport, fetchFinancialSummary, reportsKeys } from "@/lib/api/reports";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ReportCard({ icon, title, description, actionLabel, onAction }: { icon: string; title: string; description: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>
          {icon} {title}
        </h3>
      </div>
      <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{description}</p>
      <button type="button" onClick={onAction} className="btn primary sm" style={{ marginTop: 14 }}>
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

  const financialQuery = useQuery({
    queryKey: reportsKeys.financialSummary(),
    queryFn: fetchFinancialSummary,
    enabled: showFinancial,
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Raporlar/Dışa Aktarım yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const financial = financialQuery.data;

  return (
    <div className="screen">
      <h1>Raporlar / Dışa Aktarım</h1>
      <p className="lede">Mevcut kurum verinizden anında oluşan raporlar — CSV olarak indirin veya görüntüleyin.</p>

      <div className="grid cols-3">
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
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="card-head">
            <h3>Mali Özet Raporu</h3>
            <button type="button" onClick={() => setShowFinancial(false)} className="btn xs">
              Kapat
            </button>
          </div>
          {financialQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {financial && (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Tür</th>
                      <th>Kategori</th>
                      <th style={{ textAlign: "right" }}>Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financial.rows.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "center", color: "var(--ink-faint)" }}>
                          Kayıt yok
                        </td>
                      </tr>
                    )}
                    {financial.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.type === "GELIR" ? "Gelir" : "Gider"}</td>
                        <td>{r.category}</td>
                        <td style={{ textAlign: "right" }}>{formatTl(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-muted)" }}>Toplam Gelir</span>
                  <span style={{ fontWeight: 600 }}>{formatTl(financial.totalIncome)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--ink-muted)" }}>Toplam Gider</span>
                  <span style={{ fontWeight: 600 }}>{formatTl(financial.totalExpense)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-md)", fontWeight: 700 }}>
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
