"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingKeys, collectInstallment, fetchAging, fetchInstallments } from "@/lib/api/accounting";
import { Icon } from "@/components/ui/icons";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

export function InstallmentsPanel() {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: accountingKeys.installments("PENDING"),
    queryFn: () => fetchInstallments("PENDING"),
  });
  const agingQuery = useQuery({ queryKey: accountingKeys.aging(), queryFn: fetchAging });

  const collectMutation = useMutation({
    mutationFn: collectInstallment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.installments("PENDING") });
      queryClient.invalidateQueries({ queryKey: accountingKeys.aging() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.ledger() });
    },
  });

  const installments = pendingQuery.data?.installments ?? [];

  return (
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
  );
}
