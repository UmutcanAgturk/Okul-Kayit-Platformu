"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import {
  createAccount,
  createJournalEntry,
  deleteJournalEntry,
  doubleAccountingKeys,
  fetchBalanceSheet,
  fetchChart,
  fetchGeneralLedger,
  fetchIncomeStatement,
  fetchJournal,
  fetchTrialBalance,
  tl,
  type ChartAccount,
} from "@/lib/api/accounting-double";

const ALLOWED = ["BRANCH_ADMIN", "ACCOUNTING", "SUPERADMIN"];
const TABS = ["Yevmiye", "Mizan", "Gelir Tablosu", "Bilanço", "Defter-i Kebir", "Hesap Planı"] as const;
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

      {tab !== "Yevmiye" && tab !== "Hesap Planı" && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
          <div className="field" style={{ maxWidth: 170 }}><label>Başlangıç</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="field" style={{ maxWidth: 170 }}><label>Bitiş</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          {(from || to) && <button type="button" className="btn sm" onClick={() => { setFrom(""); setTo(""); }}>Temizle</button>}
        </div>
      )}

      {tab === "Yevmiye" && <JournalTab accounts={accounts} />}
      {tab === "Mizan" && <TrialBalanceTab from={from} to={to} />}
      {tab === "Gelir Tablosu" && <IncomeTab from={from} to={to} />}
      {tab === "Bilanço" && <BalanceTab from={from} to={to} />}
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
