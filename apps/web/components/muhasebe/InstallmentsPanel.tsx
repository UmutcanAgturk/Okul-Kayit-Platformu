"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingKeys, collectInstallment, fetchAging, fetchInstallments } from "@/lib/api/accounting";

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Bekleyen Taksitler</h2>
        {pendingQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!pendingQuery.isLoading && installments.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bekleyen taksit yok.</p>
        )}
        <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
          {installments.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-50">{i.studentName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {i.installmentNo}. taksit · vade {new Date(i.dueDate).toLocaleDateString("tr-TR")} · {tl(Number(i.amount))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => collectMutation.mutate(i.id)}
                disabled={collectMutation.isPending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Tahsil Et
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Tahsilat Yaşlandırma Raporu</h2>
        {agingQuery.data && (
          <>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {agingQuery.data.buckets.map((b) => (
                <div key={b.id} className="rounded-lg bg-slate-50 p-2 text-center dark:bg-slate-800/60">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{b.label}</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-50">{b.count}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{tl(b.amount)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 max-h-[380px] space-y-2 overflow-y-auto">
              {agingQuery.data.rows.map((r) => (
                <div key={r.studentId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {r.count} taksit · {r.daysLate} gün gecikme
                    </div>
                  </div>
                  <span className="font-semibold text-red-600 dark:text-red-400">{tl(r.totalAmount)}</span>
                </div>
              ))}
              {agingQuery.data.rows.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">Vadesi geçen taksit yok.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
