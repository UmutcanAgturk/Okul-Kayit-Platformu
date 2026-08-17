"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { accountingKeys, collectInstallment, createLedgerEntry, fetchAging, fetchBranchCollectionRates, fetchInstallments } from "@/lib/api/accounting";
import { Icon } from "@/components/ui/icons";
import { CompositionBar } from "@/components/ui/charts/CompositionBar";
import { HBarChart } from "@/components/ui/charts/HBarChart";

const UPCOMING_DUE_WINDOW_DAYS = 7;

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  OVERDUE: "Gecikmiş",
  CANCELLED: "İptal",
};

export function InstallmentsPanel({ isSuperadmin = false }: { isSuperadmin?: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [freeName, setFreeName] = useState("");
  const [freeAmount, setFreeAmount] = useState("");
  const [freeNote, setFreeNote] = useState("");
  const [freeError, setFreeError] = useState<string | null>(null);
  const [freeSuccess, setFreeSuccess] = useState<string | null>(null);
  const pendingQuery = useQuery({
    queryKey: accountingKeys.installments("PENDING"),
    queryFn: () => fetchInstallments("PENDING"),
  });
  const allQuery = useQuery({
    queryKey: accountingKeys.installments(),
    queryFn: () => fetchInstallments(),
  });
  const agingQuery = useQuery({ queryKey: accountingKeys.aging(), queryFn: fetchAging });
  const collectionRateQuery = useQuery({
    queryKey: ["branch-collection-rates"],
    queryFn: fetchBranchCollectionRates,
    enabled: isSuperadmin,
  });

  const collectMutation = useMutation({
    mutationFn: collectInstallment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "installments"] });
      queryClient.invalidateQueries({ queryKey: accountingKeys.aging() });
      queryClient.invalidateQueries({ queryKey: ["accounting", "ledger"] });
    },
  });

  // task #95: öğrenci/veli adıyla arama — hem Bekleyen Taksitler hem Tüm
  // Taksitler tablosunu filtreler (zaten çekilmiş listeler üzerinde,
  // Roller Yönetimi/HQ Kurumlar'daki aynı istemci-tarafı arama deseni).
  const searchLower = search.trim().toLocaleLowerCase("tr-TR");
  const installments = (pendingQuery.data?.installments ?? []).filter((i) => !searchLower || i.studentName.toLocaleLowerCase("tr-TR").includes(searchLower));
  // Özet kartlar/Ödeme Durumu Dağılımı HER ZAMAN tam veri setinden hesaplanır
  // (arama yalnızca aşağıdaki listeleri filtreler, genel istatistikleri değil).
  const allInstallments = allQuery.data?.installments ?? [];
  const filteredAllInstallments = allInstallments.filter((i) => !searchLower || i.studentName.toLocaleLowerCase("tr-TR").includes(searchLower));

  // task #95: serbest tutarla tahsilat — belirli bir takside bağlı olmadan,
  // öğrenci adı + serbest bir tutar girilerek doğrudan Muhasebe Kayıt
  // Defteri'ne bir GELIR kaydı düşer (mevcut genel amaçlı
  // POST /api/branch/accounting-ledger'ı yeniden kullanır — yeni bir rota/
  // şema alanı GEREKMEZ, PaymentInstallment'ta "kısmi ödeme/kalan tutar"
  // kavramı hiç yok, bu yüzden belirli bir taksitle eşleştirilmeye
  // ÇALIŞILMAZ; öğrenci adı `note` alanına yazılır).
  const freeCollectMutation = useMutation({
    mutationFn: (input: { name: string; amount: number; note: string }) =>
      createLedgerEntry({
        type: "GELIR",
        category: "Serbest Tahsilat",
        amount: input.amount,
        entryDate: new Date().toISOString().slice(0, 10),
        note: input.note ? `${input.name} — ${input.note}` : input.name,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting", "ledger"] });
      setFreeSuccess("Tahsilat kaydedildi.");
      setFreeError(null);
      setFreeName("");
      setFreeAmount("");
      setFreeNote("");
    },
    onError: (err) => {
      setFreeError(err instanceof ApiError ? err.message : "Tahsilat kaydedilemedi.");
      setFreeSuccess(null);
    },
  });

  function handleFreeCollect() {
    setFreeSuccess(null);
    if (!freeName.trim()) {
      setFreeError("Öğrenci/veli adı zorunludur.");
      return;
    }
    const amount = Number(freeAmount);
    if (!amount || amount <= 0) {
      setFreeError("Tutar 0'dan büyük olmalıdır.");
      return;
    }
    freeCollectMutation.mutate({ name: freeName.trim(), amount, note: freeNote.trim() });
  }

  const summary = useMemo(() => {
    const now = Date.now();
    let paidCount = 0;
    let paidAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    for (const i of allInstallments) {
      const amount = Number(i.amount);
      if (i.status === "PAID") {
        paidCount += 1;
        paidAmount += amount;
      } else if (i.status === "PENDING" || i.status === "OVERDUE") {
        if (i.status === "OVERDUE" || new Date(i.dueDate).getTime() < now) {
          overdueCount += 1;
          overdueAmount += amount;
        } else {
          pendingCount += 1;
          pendingAmount += amount;
        }
      }
    }
    const collectibleTotal = paidAmount + pendingAmount + overdueAmount;
    const collectionRate = collectibleTotal > 0 ? Math.round((paidAmount / collectibleTotal) * 100) : 0;
    return { paidCount, paidAmount, pendingCount, pendingAmount, overdueCount, overdueAmount, collectionRate };
  }, [allInstallments]);

  // Ödeme Durumu Dağılımı — demo'daki öğrenci bazlı statik paymentStatus
  // alanının (Güncel/1 taksit yaklaşıyor/Gecikmiş ödeme var) gerçek, DİNAMİK
  // karşılığı: her öğrencinin taksitlerinden GERÇEKTEN türetilir (Gecikmiş >
  // Yaklaşan > Güncel önceliğiyle, tek bir gecikmiş taksit öğrenciyi
  // "Gecikmiş" yapar).
  const studentStatusDistribution = useMemo(() => {
    const now = Date.now();
    const upcomingWindowMs = UPCOMING_DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const byStudent = new Map<string, "overdue" | "upcoming" | "guncel">();
    for (const i of allInstallments) {
      if (i.status !== "PENDING" && i.status !== "OVERDUE") continue;
      const dueMs = new Date(i.dueDate).getTime();
      const isOverdue = i.status === "OVERDUE" || dueMs < now;
      const isUpcoming = !isOverdue && dueMs - now <= upcomingWindowMs;
      const current = byStudent.get(i.studentId);
      if (isOverdue) byStudent.set(i.studentId, "overdue");
      else if (isUpcoming && current !== "overdue") byStudent.set(i.studentId, "upcoming");
      else if (!current) byStudent.set(i.studentId, "guncel");
    }
    // Hiç PENDING/OVERDUE taksidi olmayan (tamamı ödenmiş veya hiç taksidi
    // olmayan) öğrenciler de "Güncel" sayılır — demo'daki gibi.
    const studentIds = new Set(allInstallments.map((i) => i.studentId));
    let overdue = 0;
    let upcoming = 0;
    let guncel = 0;
    for (const id of studentIds) {
      const s = byStudent.get(id) ?? "guncel";
      if (s === "overdue") overdue++;
      else if (s === "upcoming") upcoming++;
      else guncel++;
    }
    return { overdue, upcoming, guncel, total: studentIds.size };
  }, [allInstallments]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid cols-4">
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Tahsil Edilen</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--strong)" }}>{tl(summary.paidAmount)}</div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{summary.paidCount} taksit</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Bekleyen</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{tl(summary.pendingAmount)}</div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{summary.pendingCount} taksit</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Geciken</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--critical)" }}>{tl(summary.overdueAmount)}</div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{summary.overdueCount} taksit</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Tahsilat Oranı</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>%{summary.collectionRate}</div>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Ödeme Durumu Dağılımı</h3>
          <span className="hint">{studentStatusDistribution.total} öğrenci</span>
        </div>
        {studentStatusDistribution.total === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)", margin: 0 }}>Kapsamda kayıtlı öğrenci yok.</p>
        ) : (
          <CompositionBar
            segments={[
              { label: "Güncel", value: studentStatusDistribution.guncel, color: "var(--strong)" },
              { label: "Yaklaşan Taksit", value: studentStatusDistribution.upcoming, color: "var(--weak)" },
              { label: "Gecikmiş", value: studentStatusDistribution.overdue, color: "var(--critical)" },
            ]}
          />
        )}
      </div>

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Öğrenci/Veli Ara</h3>
          </div>
          <div className="field">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İsim ile ara… (Bekleyen Taksitler ve Tüm Taksitler'i filtreler)" />
          </div>
        </div>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Serbest Tutarla Tahsilat</h3>
          </div>
          <p style={{ margin: "0 0 8px", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
            Belirli bir taksitle eşleştirmeden, öğrenci/veli adına serbest bir tutar tahsil edip doğrudan Kayıt Defteri'ne işler.
          </p>
          <div className="grid cols-2" style={{ gap: 8 }}>
            <div className="field">
              <label>Öğrenci/Veli Adı</label>
              <input value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="Örn. Elif Yılmaz" />
            </div>
            <div className="field">
              <label>Tutar (₺)</label>
              <input type="number" min="0" value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Açıklama (opsiyonel)</label>
            <input value={freeNote} onChange={(e) => setFreeNote(e.target.value)} placeholder="Örn. Kırtasiye ücreti" />
          </div>
          {freeError && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{freeError}</p>}
          {freeSuccess && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>{freeSuccess}</p>}
          <button type="button" className="btn primary sm" style={{ marginTop: 10 }} disabled={freeCollectMutation.isPending} onClick={handleFreeCollect}>
            {freeCollectMutation.isPending ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
          </button>
        </div>
      </div>

      <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Bekleyen Taksitler</h3>
        </div>
        {pendingQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!pendingQuery.isLoading && installments.length === 0 && (
          <div className="empty-state">
            <Icon name="check" />
            <p>Bekleyen taksit yok.</p>
          </div>
        )}
        <div style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {installments.map((i) => (
            <div
              key={i.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
            >
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{i.studentName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {i.installmentNo}. taksit · vade {new Date(i.dueDate).toLocaleDateString("tr-TR")} · {tl(Number(i.amount))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => collectMutation.mutate(i.id)}
                disabled={collectMutation.isPending}
                className="btn primary xs"
              >
                Tahsil Et
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Tahsilat Yaşlandırma Raporu</h3>
        </div>
        {agingQuery.data && (
          <>
            <div className="grid cols-4" style={{ marginBottom: 12 }}>
              {agingQuery.data.buckets.map((b) => (
                <div key={b.id} style={{ background: "var(--surface-2)", borderRadius: "var(--radius-sm)", padding: 8, textAlign: "center" }}>
                  <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{b.label}</div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>{b.count}</div>
                  <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>{tl(b.amount)}</div>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {agingQuery.data.rows.map((r) => (
                <div
                  key={r.studentId}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                >
                  <div>
                    <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {r.count} taksit · {r.daysLate} gün gecikme
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--critical)" }}>{tl(r.totalAmount)}</span>
                </div>
              ))}
              {agingQuery.data.rows.length === 0 && (
                <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Vadesi geçen taksit yok.</p>
              )}
            </div>
          </>
        )}
      </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Tüm Taksitler</h3>
          <span className="hint">{filteredAllInstallments.length} / {allInstallments.length} kayıt</span>
        </div>
        {allQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!allQuery.isLoading && filteredAllInstallments.length === 0 && (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>{search ? "Aramayla eşleşen taksit yok." : "Henüz taksit kaydı yok."}</p>
          </div>
        )}
        {filteredAllInstallments.length > 0 && (
          <div style={{ maxHeight: 480, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 8px" }}>Öğrenci</th>
                  <th style={{ padding: "6px 8px" }}>Taksit No</th>
                  <th style={{ padding: "6px 8px" }}>Tutar</th>
                  <th style={{ padding: "6px 8px" }}>Vade Tarihi</th>
                  <th style={{ padding: "6px 8px" }}>Durum</th>
                  <th style={{ padding: "6px 8px" }}>Ödeme Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllInstallments.map((i) => {
                  const isOverdue = i.status === "PENDING" && new Date(i.dueDate).getTime() < Date.now();
                  const displayStatus = isOverdue ? "OVERDUE" : i.status;
                  return (
                    <tr key={i.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{i.studentName}</td>
                      <td style={{ padding: "6px 8px" }}>{i.installmentNo}</td>
                      <td style={{ padding: "6px 8px" }}>{tl(Number(i.amount))}</td>
                      <td style={{ padding: "6px 8px" }}>{new Date(i.dueDate).toLocaleDateString("tr-TR")}</td>
                      <td style={{ padding: "6px 8px" }}>
                        <span
                          className="badge"
                          style={{
                            color:
                              displayStatus === "PAID"
                                ? "var(--strong)"
                                : displayStatus === "OVERDUE"
                                  ? "var(--critical)"
                                  : "var(--ink-muted)",
                          }}
                        >
                          {STATUS_LABEL[displayStatus] ?? displayStatus}
                        </span>
                      </td>
                      <td style={{ padding: "6px 8px" }}>{i.paidAt ? new Date(i.paidAt).toLocaleDateString("tr-TR") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isSuperadmin && (
        <div className="card card-pad">
          <div className="card-head">
            <h3>Kurum Bazlı Tahsilat Oranı</h3>
            <span className="hint">{collectionRateQuery.data?.branches.length ?? 0} kurum</span>
          </div>
          {collectionRateQuery.isLoading ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          ) : !collectionRateQuery.data?.branches.length ? (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)", margin: 0 }}>Kurum yok.</p>
          ) : (
            <HBarChart
              max={100}
              unit="%"
              rows={collectionRateQuery.data.branches.map((b) => ({
                label: b.tenantName,
                sub: b.city,
                value: b.collectionRate ?? 0,
                tone: (b.collectionRate ?? 0) >= 90 ? "strong" : (b.collectionRate ?? 0) >= 75 ? "weak" : "critical",
              }))}
            />
          )}
        </div>
      )}
    </div>
  );
}
