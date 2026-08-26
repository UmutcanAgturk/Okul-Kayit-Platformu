"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import {
  cashTransfer,
  createAccount,
  createJournalEntry,
  createSupplier,
  deleteJournalEntry,
  doubleAccountingKeys,
  fetchBalanceSheet,
  fetchCari,
  fetchCashAccounts,
  fetchBeyanname,
  fetchBudget,
  fetchChart,
  fetchGeneralLedger,
  fetchIncomeStatement,
  fetchJournal,
  fetchTrialBalance,
  runBackfill,
  setBudget,
  tl,
  type ChartAccount,
} from "@/lib/api/accounting-double";

const ALLOWED = ["BRANCH_ADMIN", "ACCOUNTING", "SUPERADMIN"];
const TABS = ["Yevmiye", "Cari Hesaplar", "Kasa/Banka", "Mizan", "Gelir Tablosu", "Bilanço", "Bütçe", "Beyanname", "Defter-i Kebir", "Hesap Planı"] as const;
type Tab = (typeof TABS)[number];

const TYPE_LABEL: Record<string, string> = {
  VARLIK: "Varlıklar", YABANCI_KAYNAK: "Yabancı Kaynaklar", OZKAYNAK: "Özkaynaklar",
  GELIR: "Gelirler", GIDER: "Giderler", MALIYET: "Maliyetler",
};

export function ResmiMuhasebeDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);

  const [tab, setTab] = useState<Tab>("Yevmiye");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const allowed = me ? ALLOWED.includes(me.role) : false;
  const chart = useQuery({ queryKey: doubleAccountingKeys.chart(), queryFn: fetchChart, enabled: allowed });
  const accounts = chart.data?.accounts ?? [];

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!allowed) {
    return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Resmi Muhasebe yalnızca Şube Yöneticisi, Muhasebe ve Genel Merkez rollerine açıktır.</p></div>;
  }

  return (
    <div className="screen">
      <h1>Resmi Muhasebe</h1>
      <p className="lede">Tekdüzen Hesap Planı temelli çift taraflı defter — yevmiye, mizan, gelir tablosu ve bilanço.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0 14px" }}>
        {TABS.map((t) => (
          <button key={t} type="button" className={`btn sm ${tab === t ? "primary" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {(["Mizan", "Gelir Tablosu", "Bilanço", "Defter-i Kebir"] as Tab[]).includes(tab) && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ maxWidth: 170 }}><label>Başlangıç</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field" style={{ maxWidth: 170 }}><label>Bitiş</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {(from || to) && <button type="button" className="btn sm" onClick={() => { setFrom(""); setTo(""); }}>Temizle</button>}
        </div>
      )}

      {tab === "Yevmiye" && <JournalTab accounts={accounts} />}
      {tab === "Cari Hesaplar" && <CariTab />}
      {tab === "Kasa/Banka" && <CashTab />}
      {tab === "Mizan" && <TrialBalanceTab from={from} to={to} />}
      {tab === "Gelir Tablosu" && <IncomeTab from={from} to={to} />}
      {tab === "Bilanço" && <BalanceTab from={from} to={to} />}
      {tab === "Bütçe" && <BudgetTab />}
      {tab === "Beyanname" && <BeyannameTab />}
      {tab === "Defter-i Kebir" && <LedgerTab accounts={accounts} from={from} to={to} />}
      {tab === "Hesap Planı" && <ChartTab accounts={accounts} loading={chart.isLoading} />}
    </div>
  );
}

/* ------------------------------- Yevmiye ------------------------------- */
interface DraftLine { code: string; debit: string; credit: string }
function JournalTab({ accounts }: { accounts: ChartAccount[] }) {
  const qc = useQueryClient();
  const journal = useQuery({ queryKey: doubleAccountingKeys.journal(), queryFn: () => fetchJournal() });
  const [showForm, setShowForm] = useState(false);
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ code: "", debit: "", credit: "" }, { code: "", debit: "", credit: "" }]);
  const [err, setErr] = useState<string | null>(null);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;

  const createMut = useMutation({
    mutationFn: () => createJournalEntry({
      entryDate: new Date(entryDate).toISOString(),
      description,
      lines: lines.filter((l) => l.code && (Number(l.debit) || Number(l.credit))).map((l) => ({ code: l.code, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acc2"] });
      setShowForm(false); setDescription(""); setLines([{ code: "", debit: "", credit: "" }, { code: "", debit: "", credit: "" }]); setErr(null);
    },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Fiş kaydedilemedi"),
  });
  const delMut = useMutation({ mutationFn: (id: string) => deleteJournalEntry(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["acc2"] }) });

  const setLine = (i: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Yevmiye Defteri</h3>
        <button type="button" className="btn primary sm" onClick={() => setShowForm((v) => !v)}>{showForm ? "Kapat" : "+ Yeni Fiş"}</button>
      </div>

      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="grid cols-2" style={{ rowGap: 10, marginBottom: 10 }}>
            <div className="field"><label>Tarih</label><input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
            <div className="field"><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Örn. Kira ödemesi" /></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 560 }}>
              <thead><tr><th>Hesap</th><th style={{ width: 130 }}>Borç</th><th style={{ width: 130 }}>Alacak</th><th style={{ width: 40 }}></th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <select value={l.code} onChange={(e) => setLine(i, { code: e.target.value })} style={{ width: "100%" }}>
                        <option value="">Hesap seç…</option>
                        {accounts.map((a) => <option key={a.id} value={a.code}>{a.code} — {a.name}</option>)}
                      </select>
                    </td>
                    <td><input type="number" min="0" step="0.01" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                    <td><input type="number" min="0" step="0.01" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                    <td>{lines.length > 2 && <button type="button" className="btn xs danger" onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>×</button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ fontWeight: 700 }}>Toplam</td>
                  <td style={{ fontWeight: 700 }}>{tl(totalDebit)}</td>
                  <td style={{ fontWeight: 700, color: balanced ? "var(--strong)" : "var(--critical)" }}>{tl(totalCredit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <button type="button" className="btn sm" onClick={() => setLines((prev) => [...prev, { code: "", debit: "", credit: "" }])}>+ Satır</button>
            <div style={{ flex: 1 }} />
            {!balanced && totalDebit + totalCredit > 0 && <span style={{ fontSize: "var(--text-xs)", color: "var(--critical)" }}>Borç ve alacak eşit olmalı</span>}
            {err && <span style={{ fontSize: "var(--text-xs)", color: "var(--critical)" }}>{err}</span>}
            <button type="button" className="btn primary sm" disabled={!balanced || !description || createMut.isPending} onClick={() => createMut.mutate()}>{createMut.isPending ? "Kaydediliyor…" : "Fişi Kaydet"}</button>
          </div>
        </div>
      )}

      {journal.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : (journal.data?.entries.length ?? 0) === 0 ? (
        <div className="empty-state"><p>Henüz yevmiye kaydı yok. Tahsilat/gider işledikçe otomatik oluşur veya elle fiş girebilirsiniz.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {journal.data!.entries.map((e) => (
            <div key={e.id} className="card card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div><b>{e.no}</b> <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>{new Date(e.entryDate).toLocaleDateString("tr-TR")} · {e.description}</span></div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className={`chip ${e.source === "MANUEL" ? "" : "strong"}`} style={{ fontSize: "var(--text-xs)" }}>{e.source === "MANUEL" ? "Elle" : e.source}</span>
                  {e.source === "MANUEL" && <button type="button" className="btn xs danger" disabled={delMut.isPending} onClick={() => { if (window.confirm(`${e.no} fişi silinsin mi?`)) delMut.mutate(e.id); }}>Sil</button>}
                </div>
              </div>
              <div style={{ overflowX: "auto", marginTop: 6 }}>
                <table className="table" style={{ minWidth: 420 }}>
                  <thead><tr><th>Hesap</th><th style={{ textAlign: "right" }}>Borç</th><th style={{ textAlign: "right" }}>Alacak</th></tr></thead>
                  <tbody>
                    {e.lines.map((l, i) => (
                      <tr key={i}><td>{l.accountCode} — {l.accountName}</td><td style={{ textAlign: "right" }}>{l.debit ? tl(l.debit) : ""}</td><td style={{ textAlign: "right" }}>{l.credit ? tl(l.credit) : ""}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Mizan ------------------------------- */
function TrialBalanceTab({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: doubleAccountingKeys.trial(from, to), queryFn: () => fetchTrialBalance({ from: from || undefined, to: to || undefined }) });
  if (q.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  const d = q.data;
  if (!d || d.rows.length === 0) return <div className="empty-state"><p>Mizanda gösterilecek hareket yok.</p></div>;
  const balanced = Math.abs(d.totalDebit - d.totalCredit) < 0.01;
  return (
    <div className="card card-pad" style={{ overflowX: "auto" }}>
      <table className="table" style={{ minWidth: 560 }}>
        <thead><tr><th>Kod</th><th>Hesap</th><th style={{ textAlign: "right" }}>Borç</th><th style={{ textAlign: "right" }}>Alacak</th><th style={{ textAlign: "right" }}>Bakiye</th></tr></thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td style={{ textAlign: "right" }}>{tl(r.debit)}</td><td style={{ textAlign: "right" }}>{tl(r.credit)}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{tl(r.balance)}</td></tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 800 }}><td></td><td>TOPLAM</td><td style={{ textAlign: "right" }}>{tl(d.totalDebit)}</td><td style={{ textAlign: "right", color: balanced ? "var(--strong)" : "var(--critical)" }}>{tl(d.totalCredit)}</td><td></td></tr>
        </tfoot>
      </table>
      {!balanced && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>Uyarı: mizan dengesiz — borç ve alacak toplamları eşit değil.</p>}
    </div>
  );
}

/* --------------------------- Gelir Tablosu --------------------------- */
function IncomeTab({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: doubleAccountingKeys.income(from, to), queryFn: () => fetchIncomeStatement({ from: from || undefined, to: to || undefined }) });
  if (q.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  const d = q.data;
  if (!d) return null;
  return (
    <div className="grid cols-2" style={{ gap: 14, alignItems: "start" }}>
      <div className="card card-pad">
        <h3>Gelirler</h3>
        {d.revenue.length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Kayıt yok.</p> : d.revenue.map((r) => (
          <div key={r.code} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}><span>{r.code} — {r.name}</span><b>{tl(r.amount)}</b></div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}><span>Toplam Gelir</span><span style={{ color: "var(--strong)" }}>{tl(d.totalRevenue)}</span></div>
      </div>
      <div className="card card-pad">
        <h3>Giderler</h3>
        {d.expense.length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Kayıt yok.</p> : d.expense.map((r) => (
          <div key={r.code} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}><span>{r.code} — {r.name}</span><b>{tl(r.amount)}</b></div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}><span>Toplam Gider</span><span style={{ color: "var(--critical)" }}>{tl(d.totalExpense)}</span></div>
      </div>
      <div className="card card-pad" style={{ gridColumn: "1 / -1", background: d.netProfit >= 0 ? "var(--strong-bg, var(--surface-2))" : "var(--weak-bg, var(--surface-2))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "var(--text-lg)" }}>
          <span>DÖNEM NET {d.netProfit >= 0 ? "KÂRI" : "ZARARI"}</span>
          <span style={{ color: d.netProfit >= 0 ? "var(--strong)" : "var(--critical)" }}>{tl(d.netProfit)}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Bilanço ------------------------------ */
function BalanceTab({ from, to }: { from: string; to: string }) {
  const q = useQuery({ queryKey: doubleAccountingKeys.balance(from, to), queryFn: () => fetchBalanceSheet({ from: from || undefined, to: to || undefined }) });
  if (q.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  const d = q.data;
  if (!d) return null;
  const dengede = Math.abs(d.totalAssets - d.totalPassive) < 0.01;
  const Row = ({ r }: { r: { code: string; name: string; amount: number } }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}><span>{r.code} — {r.name}</span><b>{tl(r.amount)}</b></div>
  );
  return (
    <>
      <div className="grid cols-2" style={{ gap: 14, alignItems: "start" }}>
        <div className="card card-pad">
          <h3>Aktif (Varlıklar)</h3>
          {d.assets.length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Kayıt yok.</p> : d.assets.map((r) => <Row key={r.code} r={r} />)}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}><span>AKTİF TOPLAM</span><span>{tl(d.totalAssets)}</span></div>
        </div>
        <div className="card card-pad">
          <h3>Pasif (Kaynaklar)</h3>
          {[...d.liabilities, ...d.equity].length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Kayıt yok.</p> : (
            <>
              {d.liabilities.map((r) => <Row key={r.code} r={r} />)}
              {d.equity.map((r) => <Row key={r.code} r={r} />)}
            </>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontWeight: 800 }}><span>PASİF TOPLAM</span><span>{tl(d.totalPassive)}</span></div>
        </div>
      </div>
      {!dengede && <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>Uyarı: bilanço denk değil (Aktif ≠ Pasif). Açılış fişi/eksik kayıt olabilir.</p>}
    </>
  );
}

/* --------------------------- Defter-i Kebir --------------------------- */
function LedgerTab({ accounts, from, to }: { accounts: ChartAccount[]; from: string; to: string }) {
  const [accountId, setAccountId] = useState("");
  const q = useQuery({ queryKey: doubleAccountingKeys.ledger(accountId, from, to), queryFn: () => fetchGeneralLedger(accountId, { from: from || undefined, to: to || undefined }), enabled: !!accountId });
  return (
    <div>
      <div className="field" style={{ maxWidth: 360, marginBottom: 12 }}>
        <label>Hesap</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Hesap seç…</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
        </select>
      </div>
      {!accountId ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Bir hesap seçin.</p> : q.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : q.data && (
        <div className="card card-pad" style={{ overflowX: "auto" }}>
          <h3 style={{ marginTop: 0 }}>{q.data.account.code} — {q.data.account.name}</h3>
          <table className="table" style={{ minWidth: 560 }}>
            <thead><tr><th>Fiş</th><th>Tarih</th><th>Açıklama</th><th style={{ textAlign: "right" }}>Borç</th><th style={{ textAlign: "right" }}>Alacak</th><th style={{ textAlign: "right" }}>Bakiye</th></tr></thead>
            <tbody>
              {q.data.rows.length === 0 ? <tr><td colSpan={6} style={{ color: "var(--ink-faint)" }}>Hareket yok.</td></tr> : q.data.rows.map((r, i) => (
                <tr key={i}><td>{r.no}</td><td>{new Date(r.entryDate).toLocaleDateString("tr-TR")}</td><td>{r.description}</td><td style={{ textAlign: "right" }}>{r.debit ? tl(r.debit) : ""}</td><td style={{ textAlign: "right" }}>{r.credit ? tl(r.credit) : ""}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{tl(r.balance)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr style={{ fontWeight: 800 }}><td colSpan={3}>TOPLAM</td><td style={{ textAlign: "right" }}>{tl(q.data.totalDebit)}</td><td style={{ textAlign: "right" }}>{tl(q.data.totalCredit)}</td><td style={{ textAlign: "right" }}>{tl(q.data.balance)}</td></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------- Hesap Planı --------------------------- */
function ChartTab({ accounts, loading }: { accounts: ChartAccount[]; loading: boolean }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", type: "GIDER", normalBalance: "BORC", parentCode: "" });
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => createAccount({ code: form.code.trim(), name: form.name.trim(), type: form.type as ChartAccount["type"], normalBalance: form.normalBalance as ChartAccount["normalBalance"], parentCode: form.parentCode.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doubleAccountingKeys.chart() }); setShowForm(false); setForm({ code: "", name: "", type: "GIDER", normalBalance: "BORC", parentCode: "" }); setErr(null); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Eklenemedi"),
  });

  const grouped = useMemo(() => {
    const g = new Map<string, ChartAccount[]>();
    for (const a of accounts) { const arr = g.get(a.type) ?? []; arr.push(a); g.set(a.type, arr); }
    return g;
  }, [accounts]);

  if (loading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Tekdüzen Hesap Planı</h3>
        <button type="button" className="btn primary sm" onClick={() => setShowForm((v) => !v)}>{showForm ? "Kapat" : "+ Hesap Ekle"}</button>
      </div>
      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="grid cols-2" style={{ rowGap: 10 }}>
            <div className="field"><label>Kod</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Örn. 770.07" /></div>
            <div className="field"><label>Hesap Adı</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="field"><label>Sınıf</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field"><label>Normal Bakiye</label>
              <select value={form.normalBalance} onChange={(e) => setForm({ ...form, normalBalance: e.target.value })}>
                <option value="BORC">Borç</option><option value="ALACAK">Alacak</option>
              </select>
            </div>
          </div>
          {err && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{err}</p>}
          <button type="button" className="btn primary sm" style={{ marginTop: 10 }} disabled={!form.code.trim() || !form.name.trim() || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Ekleniyor…" : "Kaydet"}</button>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {["VARLIK", "YABANCI_KAYNAK", "OZKAYNAK", "GELIR", "GIDER", "MALIYET"].filter((t) => grouped.has(t)).map((t) => (
          <div key={t} className="card card-pad">
            <div className="card-head"><h3>{TYPE_LABEL[t]}</h3></div>
            {grouped.get(t)!.map((a) => (
              <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)", paddingLeft: a.parentCode ? 18 : 0 }}>
                <span><b>{a.code}</b> {a.name}</span>
                <span className="chip" style={{ fontSize: "var(--text-xs)" }}>{a.normalBalance === "BORC" ? "Borç" : "Alacak"}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------- Cari Hesaplar --------------------------- */
function CariExtract({ accountId }: { accountId: string }) {
  const q = useQuery({ queryKey: doubleAccountingKeys.ledger(accountId), queryFn: () => fetchGeneralLedger(accountId) });
  if (q.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-xs)", padding: "6px 0" }}>Yükleniyor…</p>;
  if (!q.data || q.data.rows.length === 0) return <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)", padding: "6px 0" }}>Hareket yok.</p>;
  return (
    <div style={{ overflowX: "auto", padding: "4px 0 8px" }}>
      <table className="table" style={{ minWidth: 480, fontSize: "var(--text-xs)" }}>
        <thead><tr><th>Tarih</th><th>Açıklama</th><th style={{ textAlign: "right" }}>Borç</th><th style={{ textAlign: "right" }}>Alacak</th><th style={{ textAlign: "right" }}>Bakiye</th></tr></thead>
        <tbody>
          {q.data.rows.map((r, i) => (
            <tr key={i}><td>{new Date(r.entryDate).toLocaleDateString("tr-TR")}</td><td>{r.description}</td><td style={{ textAlign: "right" }}>{r.debit ? tl(r.debit) : ""}</td><td style={{ textAlign: "right" }}>{r.credit ? tl(r.credit) : ""}</td><td style={{ textAlign: "right", fontWeight: 600 }}>{tl(r.balance)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CariTab() {
  const qc = useQueryClient();
  const cari = useQuery({ queryKey: doubleAccountingKeys.cari(), queryFn: fetchCari });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showSupplier, setShowSupplier] = useState(false);
  const [sName, setSName] = useState("");
  const [sTax, setSTax] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const backfillMut = useMutation({
    mutationFn: runBackfill,
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["acc2"] }); setMsg(`Açılış tamam: ${r.accrued} öğrenci tahakkuku, ${r.collected} tahsilat kaydı (${r.skipped} atlandı).`); },
    onError: (e) => setMsg(e instanceof ApiError ? e.message : "Açılış başarısız"),
  });
  const supplierMut = useMutation({
    mutationFn: () => createSupplier({ name: sName.trim(), taxNo: sTax.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: doubleAccountingKeys.suppliers() }); setShowSupplier(false); setSName(""); setSTax(""); },
  });

  const students = cari.data?.students ?? [];
  const suppliers = cari.data?.suppliers ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn sm" disabled={backfillMut.isPending} onClick={() => { if (window.confirm("Mevcut taksit geçmişinden çift taraflı defter oluşturulsun mu? (Carisinde hareket olan öğrenci atlanır.)")) backfillMut.mutate(); }}>
          {backfillMut.isPending ? "Oluşturuluyor…" : "Muhasebeyi Geçmişten Oluştur"}
        </button>
        <button type="button" className="btn sm primary" onClick={() => setShowSupplier((v) => !v)}>{showSupplier ? "Kapat" : "+ Tedarikçi"}</button>
        {msg && <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{msg}</span>}
      </div>

      {showSupplier && (
        <div className="card card-pad">
          <div className="grid cols-2" style={{ rowGap: 10 }}>
            <div className="field"><label>Tedarikçi Adı</label><input value={sName} onChange={(e) => setSName(e.target.value)} /></div>
            <div className="field"><label>Vergi No (ops.)</label><input value={sTax} onChange={(e) => setSTax(e.target.value)} /></div>
          </div>
          <button type="button" className="btn primary sm" style={{ marginTop: 10 }} disabled={!sName.trim() || supplierMut.isPending} onClick={() => supplierMut.mutate()}>{supplierMut.isPending ? "Ekleniyor…" : "Kaydet"}</button>
        </div>
      )}

      <div className="card card-pad">
        <div className="card-head"><h3>Öğrenci Carileri (120)</h3><span className="hint">Borç bakiye = tahsil edilecek</span></div>
        {cari.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : students.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz öğrenci carisi yok. Kayıt/tahsilat işledikçe veya &quot;Geçmişten Oluştur&quot; ile oluşur.</p>
        ) : students.map((s) => (
          <div key={s.accountId} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", cursor: "pointer" }} onClick={() => setExpanded(expanded === s.accountId ? null : s.accountId)}>
              <span><b>{s.code}</b> {s.name.replace(/^Alıcı — /, "")}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <b style={{ color: s.balance > 0 ? "var(--critical)" : "var(--strong)" }}>{tl(s.balance)}</b>
                <span className="btn xs">{expanded === s.accountId ? "Gizle" : "Ekstre"}</span>
              </span>
            </div>
            {expanded === s.accountId && <CariExtract accountId={s.accountId} />}
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Tedarikçi Carileri (320)</h3><span className="hint">Alacak bakiye = ödenecek</span></div>
        {suppliers.length === 0 ? <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz tedarikçi carisi yok.</p> : suppliers.map((s) => (
          <div key={s.accountId} style={{ borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", cursor: "pointer" }} onClick={() => setExpanded(expanded === s.accountId ? null : s.accountId)}>
              <span><b>{s.code}</b> {s.name.replace(/^Satıcı — /, "")}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}><b>{tl(s.balance)}</b><span className="btn xs">{expanded === s.accountId ? "Gizle" : "Ekstre"}</span></span>
            </div>
            {expanded === s.accountId && <CariExtract accountId={s.accountId} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Kasa/Banka ----------------------------- */
function CashTab() {
  const qc = useQueryClient();
  const cash = useQuery({ queryKey: doubleAccountingKeys.cash(), queryFn: fetchCashAccounts });
  const [fromCode, setFromCode] = useState("100");
  const [toCode, setToCode] = useState("102");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: () => cashTransfer({ fromCode, toCode, amount: Number(amount) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["acc2"] }); setAmount(""); setErr(null); },
    onError: (e) => setErr(e instanceof ApiError ? e.message : "Transfer başarısız"),
  });
  const accounts = cash.data?.accounts ?? [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid cols-3">
        {accounts.map((a) => (
          <div key={a.code} className="card stat-card"><p className="stat-label">{a.code} — {a.name}</p><p className="stat-value" style={{ fontSize: "var(--text-lg)" }}>{tl(a.balance)}</p></div>
        ))}
      </div>
      <div className="card card-pad">
        <div className="card-head"><h3>Virman (Hesaplar Arası Transfer)</h3></div>
        <div className="grid cols-3" style={{ rowGap: 10, alignItems: "end" }}>
          <div className="field"><label>Nereden</label>
            <select value={fromCode} onChange={(e) => setFromCode(e.target.value)}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select>
          </div>
          <div className="field"><label>Nereye</label>
            <select value={toCode} onChange={(e) => setToCode(e.target.value)}>{accounts.map((a) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}</select>
          </div>
          <div className="field"><label>Tutar</label><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        </div>
        {err && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{err}</p>}
        <button type="button" className="btn primary sm" style={{ marginTop: 10 }} disabled={!Number(amount) || fromCode === toCode || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Kaydediliyor…" : "Transferi Kaydet"}</button>
      </div>
    </div>
  );
}

/* ------------------------------- Bütçe ------------------------------- */
function BudgetTab() {
  const qc = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const q = useQuery({ queryKey: doubleAccountingKeys.budget(year), queryFn: () => fetchBudget(year) });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const mut = useMutation({
    mutationFn: (input: { accountCode: string; plannedAmount: number }) => setBudget({ year, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: doubleAccountingKeys.budget(year) }),
  });

  const rows = q.data?.rows ?? [];
  const revenue = rows.filter((r) => r.type === "GELIR");
  const expense = rows.filter((r) => r.type === "GIDER" || r.type === "MALIYET");
  const sum = (arr: typeof rows, k: "planned" | "actual") => arr.reduce((s, r) => s + r[k], 0);

  const Section = ({ title, data, positive }: { title: string; data: typeof rows; positive: boolean }) => (
    <div className="card card-pad">
      <div className="card-head"><h3>{title}</h3><span className="hint">Plan · Gerçekleşen · Fark</span></div>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ minWidth: 560 }}>
          <thead><tr><th>Hesap</th><th style={{ textAlign: "right", width: 150 }}>Bütçe</th><th style={{ textAlign: "right" }}>Gerçekleşen</th><th style={{ textAlign: "right" }}>Fark</th><th style={{ width: 110 }}>%</th></tr></thead>
          <tbody>
            {data.length === 0 ? <tr><td colSpan={5} style={{ color: "var(--ink-faint)" }}>Kayıt yok.</td></tr> : data.map((r) => {
              const variance = round2b(r.planned - r.actual);
              const pct = r.planned > 0 ? Math.min(100, Math.round((r.actual / r.planned) * 100)) : 0;
              // Gelirde gerçekleşen ≥ bütçe iyidir; giderde ≤ bütçe iyidir.
              const good = positive ? r.actual >= r.planned : r.actual <= r.planned;
              return (
                <tr key={r.code}>
                  <td>{r.code} — {r.name}</td>
                  <td style={{ textAlign: "right" }}>
                    <input type="number" min="0" step="100" defaultValue={r.planned || ""} placeholder="0"
                      style={{ width: 120, textAlign: "right" }}
                      onChange={(e) => setEdit((p) => ({ ...p, [r.code]: e.target.value }))}
                      onBlur={(e) => { const v = Number(e.target.value) || 0; if (v !== r.planned) mut.mutate({ accountCode: r.code, plannedAmount: v }); }}
                    />
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{tl(r.actual)}</td>
                  <td style={{ textAlign: "right", color: good ? "var(--strong)" : "var(--critical)" }}>{tl(variance)}</td>
                  <td>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: good ? "var(--strong, #1f7d54)" : "var(--critical)" }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 800 }}>
              <td>TOPLAM</td>
              <td style={{ textAlign: "right" }}>{tl(sum(data, "planned"))}</td>
              <td style={{ textAlign: "right" }}>{tl(sum(data, "actual"))}</td>
              <td style={{ textAlign: "right" }}>{tl(round2b(sum(data, "planned") - sum(data, "actual")))}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  const netPlanned = round2b(sum(revenue, "planned") - sum(expense, "planned"));
  const netActual = round2b(sum(revenue, "actual") - sum(expense, "actual"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field" style={{ maxWidth: 140 }}>
        <label>Bütçe Yılı</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year + 1, year, year - 1, year - 2].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {q.isLoading ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : (
        <>
          <Section title="Gelir Bütçesi" data={revenue} positive={true} />
          <Section title="Gider Bütçesi" data={expense} positive={false} />
          <div className="card card-pad" style={{ background: netActual >= 0 ? "var(--strong-bg, var(--surface-2))" : "var(--weak-bg, var(--surface-2))" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}>
              <span>NET (Bütçe / Gerçekleşen)</span>
              <span>{tl(netPlanned)} · <span style={{ color: netActual >= 0 ? "var(--strong)" : "var(--critical)" }}>{tl(netActual)}</span></span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function round2b(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/* ------------------------------ Beyanname ------------------------------ */
const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
function BeyannameTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const q = useQuery({ queryKey: doubleAccountingKeys.beyanname(year, month), queryFn: () => fetchBeyanname(year, month) });
  const d = q.data;
  const KV = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
      <span>{label}</span><b style={{ color: strong ? "var(--critical)" : undefined }}>{tl(value)}</b>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ maxWidth: 130 }}><label>Yıl</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>{[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}</select>
        </div>
        <div className="field" style={{ maxWidth: 150 }}><label>Ay</label>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>{AY_ADLARI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
        </div>
        <button type="button" className="btn sm" onClick={() => window.print()}>🖨️ Yazdır</button>
      </div>
      {q.isLoading || !d ? <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p> : (
        <div className="grid cols-2" style={{ gap: 14, alignItems: "start" }}>
          <div className="card card-pad">
            <div className="card-head"><h3>KDV Beyannamesi (KDV1)</h3><span className="hint">{d.period}</span></div>
            <KV label="Hesaplanan KDV" value={d.kdv.hesaplananKDV} />
            <KV label="İndirilecek KDV" value={d.kdv.indirilecekKDV} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontWeight: 800 }}><span>Ödenecek KDV</span><span style={{ color: "var(--critical)" }}>{tl(d.kdv.odenecekKDV)}</span></div>
            {d.kdv.devredenKDV > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}><span>Sonraki döneme devreden</span><span>{tl(d.kdv.devredenKDV)}</span></div>}
          </div>
          <div className="card card-pad">
            <div className="card-head"><h3>Muhtasar Beyanname</h3><span className="hint">{d.period}</span></div>
            <KV label="Ücret Gelir Vergisi Stopajı" value={d.muhtasar.ucretStopaji} />
            <KV label="Kira Stopajı (GVK 94)" value={d.muhtasar.kiraStopaji} />
            <KV label="Damga Vergisi" value={d.muhtasar.damga} />
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", fontWeight: 800 }}><span>Toplam Ödenecek</span><span style={{ color: "var(--critical)" }}>{tl(d.muhtasar.toplam)}</span></div>
          </div>
          <div className="card card-pad" style={{ gridColumn: "1 / -1" }}>
            <div className="card-head"><h3>SGK Prim ve Hizmet Belgesi</h3><span className="hint">{d.sgk.personelSayisi} personel</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800 }}><span>Toplam SGK Primi (işçi + işveren)</span><span>{tl(d.sgk.toplamPrim)}</span></div>
          </div>
          <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
            Bu özet hazırlık amaçlıdır; resmi beyan GİB/SGK sistemleri üzerinden yapılır. Değerler muhasebe defteri ve bordro kayıtlarından türetilir.
          </p>
        </div>
      )}
    </div>
  );
}
