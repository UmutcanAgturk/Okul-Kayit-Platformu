"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchStudents } from "@/lib/api/students-roster";
import {
  createPaymentMethodCatalogEntry,
  deletePaymentMethodCatalogEntry,
  fetchPaymentMethodCatalog,
  INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL,
  INSTITUTION_PAYMENT_METHOD_TYPE_LABEL,
  PAYMENT_METHOD_TYPE_LABEL,
  createPaymentMethod,
  deletePaymentMethod,
  fetchBranchPaymentReceipts,
  fetchPaymentMethods,
  reviewPaymentReceipt,
  updatePaymentMethodCatalogEntry,
  type InstitutionPaymentMethodRow,
  type InstitutionPaymentMethodType,
  type PaymentMethodRow,
} from "@/lib/api/payment-methods";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

function tl(amount: string) {
  return "₺" + Math.round(Number(amount)).toLocaleString("tr-TR");
}

/**
 * Bekleyen Dekont Onayları — demo'daki "renderPendingReceipts" panelinin
 * gerçek karşılığı (bkz. app/api/branch/payment-receipts). Onaylama, taksidi
 * otomatik olarak ödendi işaretler ve Muhasebe defterine geçer.
 */
function PendingReceiptsPanel() {
  const queryClient = useQueryClient();
  const receiptsQuery = useQuery({ queryKey: ["branch-payment-receipts"], queryFn: fetchBranchPaymentReceipts });

  const reviewMutation = useMutation({
    mutationFn: ({ receiptId, decision }: { receiptId: string; decision: "APPROVE" | "REJECT" }) =>
      reviewPaymentReceipt(receiptId, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-payment-receipts"] }),
  });

  const pending = (receiptsQuery.data?.receipts ?? []).filter((r) => r.status === "BEKLIYOR");

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>Bekleyen Dekont Onayları</h3>
        <span className="hint">{pending.length} bekliyor</span>
      </div>
      {receiptsQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : pending.length === 0 ? (
        <div className="empty-state">
          <Icon name="attach" />
          <p>Onay bekleyen dekont yok.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {pending.map((r) => (
            <div
              key={r.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", padding: "9px 0" }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                  {r.studentName} · Taksit #{r.installmentNo} · {tl(r.amount)}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {new Date(r.submittedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                  {r.note ? ` · ${r.note}` : ""}
                </div>
                <a href={r.dataUrl} download={r.fileName} target="_blank" rel="noreferrer" style={{ fontSize: "var(--text-xs)", color: "var(--brand)" }}>
                  {r.fileName} — görüntüle/indir
                </a>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn primary xs"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ receiptId: r.id, decision: "APPROVE" })}
                >
                  Onayla
                </button>
                <button
                  type="button"
                  className="btn xs"
                  disabled={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ receiptId: r.id, decision: "REJECT" })}
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Kayıtlı Yöntemler — demo/seviye360-app.html'deki CURRENT_BRANCH.paymentMethods
 * kataloğunun gerçek karşılığı (bkz. app/api/branch/payment-method-catalog).
 * Aşağıdaki öğrenci-bazlı formdan FARKLIDIR: bu, ŞUBENİN kendi tahsilat
 * araçlarının (banka hesabı/POS/kasa/senet) kurum geneli listesidir —
 * studentId taşımaz, tek bir "varsayılan" işaretlenebilir.
 */
function PaymentMethodCatalogPanel() {
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: ["payment-method-catalog"], queryFn: fetchPaymentMethodCatalog });
  const methods = catalogQuery.data?.methods ?? [];

  const [type, setType] = useState<InstitutionPaymentMethodType>("BANKA_HAVALESI");
  const [label, setLabel] = useState("");
  const [extra, setExtra] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editExtra, setEditExtra] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["payment-method-catalog"] });

  const createMutation = useMutation({
    mutationFn: () => createPaymentMethodCatalogEntry({ type, label: label.trim(), extra: extra.trim() || undefined }),
    onSuccess: () => {
      setLabel("");
      setExtra("");
      setFormError(null);
      invalidate();
    },
    onError: (e) => setFormError(e instanceof ApiError ? e.message : "Ödeme yöntemi eklenemedi."),
  });

  const updateMutation = useMutation({
    mutationFn: (input: { id: string; data: Parameters<typeof updatePaymentMethodCatalogEntry>[1] }) =>
      updatePaymentMethodCatalogEntry(input.id, input.data),
    onSuccess: () => {
      setEditingId(null);
      setRowError(null);
      invalidate();
    },
    onError: (e) => setRowError(e instanceof ApiError ? e.message : "Güncellenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePaymentMethodCatalogEntry(id),
    onSuccess: () => {
      setDeletingId(null);
      setRowError(null);
      invalidate();
    },
    onError: (e) => setRowError(e instanceof ApiError ? e.message : "Silinemedi."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setFormError("Etiket zorunludur.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <div className="grid cols-2" style={{ marginBottom: 14 }}>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Yöntem Kaydet</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label>Tür</label>
            <select value={type} onChange={(e) => setType(e.target.value as InstitutionPaymentMethodType)}>
              {Object.entries(INSTITUTION_PAYMENT_METHOD_TYPE_LABEL).map(([value, l]) => (
                <option key={value} value={value}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Etiket</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Örn. İş Bankası Şube Hesabı" />
          </div>
          <div className="field">
            <label>{INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL[type]} (opsiyonel)</label>
            <input value={extra} onChange={(e) => setExtra(e.target.value)} />
          </div>
          {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" className="btn primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Ekleniyor…" : "Kaydet"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Kayıtlı Yöntemler</h3>
          <span className="hint">{methods.length} kayıt</span>
        </div>
        {rowError && <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{rowError}</p>}
        {catalogQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : methods.length === 0 ? (
          <div className="empty-state">
            <Icon name="cardIcon" />
            <p>Henüz kayıtlı bir kurum ödeme yöntemi yok.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
            {methods.map((m: InstitutionPaymentMethodRow) => {
              if (deletingId === m.id) {
                return (
                  <div key={m.id} style={{ border: "1px solid var(--critical)", borderRadius: 9, padding: "10px 12px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>
                    <b>{m.label}</b> silinsin mi?
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button type="button" className="btn xs danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(m.id)}>
                        Evet, Sil
                      </button>
                      <button type="button" className="btn xs" onClick={() => setDeletingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }
              if (editingId === m.id) {
                return (
                  <div key={m.id} style={{ border: "1px solid var(--border-strong)", borderRadius: 9, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                    <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    <input
                      value={editExtra}
                      onChange={(e) => setEditExtra(e.target.value)}
                      placeholder={INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL[m.type]}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn xs primary"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: m.id, data: { label: editLabel.trim(), extra: editExtra.trim() || null } })}
                      >
                        Kaydet
                      </button>
                      <button type="button" className="btn xs" onClick={() => setEditingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", opacity: m.isActive ? 1 : 0.55 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{m.label}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {m.isDefault && <span className="chip strong">Varsayılan</span>}
                      {!m.isActive && <span className="chip neutral">Pasif</span>}
                    </div>
                  </div>
                  <p style={{ margin: "2px 0 6px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {INSTITUTION_PAYMENT_METHOD_TYPE_LABEL[m.type]}
                    {m.extra && ` · ${INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL[m.type]}: ${m.extra}`}
                  </p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {!m.isDefault && (
                      <button
                        type="button"
                        className="btn xs"
                        disabled={updateMutation.isPending}
                        onClick={() => updateMutation.mutate({ id: m.id, data: { isDefault: true } })}
                      >
                        Varsayılan Yap
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn xs"
                      onClick={() => {
                        setEditingId(m.id);
                        setEditLabel(m.label);
                        setEditExtra(m.extra ?? "");
                        setDeletingId(null);
                        setRowError(null);
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="btn xs"
                      disabled={updateMutation.isPending}
                      onClick={() => updateMutation.mutate({ id: m.id, data: { isActive: !m.isActive } })}
                    >
                      {m.isActive ? "Devre Dışı Bırak" : "Etkinleştir"}
                    </button>
                    <button
                      type="button"
                      className="btn xs danger"
                      onClick={() => {
                        setDeletingId(m.id);
                        setEditingId(null);
                        setRowError(null);
                      }}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Ödeme Yöntemleri — demo/seviye360-app.html'deki "odeme" ekranının gerçek
 * karşılığı. Gerçek bir ödeme sağlayıcısı entegrasyonu YOKTUR — yalnızca
 * hangi öğrencinin hangi ödeme aracını (kart/havale/nakit) "dosyada"
 * tuttuğunun kaydı (bkz. app/api/branch/students/[studentId]/payment-methods).
 */
export function PaymentMethodsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<PaymentMethodRow["type"]>("KREDI_KARTI");
  const [maskedCardNumber, setMaskedCardNumber] = useState("");
  const [isDefault, setIsDefault] = useState(false);

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

  const studentsQuery = useQuery({ queryKey: ["branch-students"], queryFn: fetchBranchStudents, enabled: !!me });
  const methodsQuery = useQuery({
    queryKey: ["payment-methods", studentId],
    queryFn: () => fetchPaymentMethods(studentId),
    enabled: !!studentId,
  });

  const createMutation = useMutation({
    mutationFn: () => createPaymentMethod(studentId, { type, maskedCardNumber: maskedCardNumber || undefined, isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods", studentId] });
      setMaskedCardNumber("");
      setIsDefault(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (methodId: string) => deletePaymentMethod(studentId, methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-methods", studentId] }),
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ödeme Yöntemleri yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const students = studentsQuery.data?.students ?? [];
  const methods = methodsQuery.data?.methods ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    createMutation.mutate();
  }

  return (
    <div className="screen">
      <h1>Ödeme Yöntemleri</h1>
      <p className="lede">Öğrencinin taksit tahsilatında kullanılacak ödeme aracını (kart/havale/nakit) dosyada tutun.</p>

      <PendingReceiptsPanel />

      <PaymentMethodCatalogPanel />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="field" style={{ maxWidth: 380 }}>
          <label>Öğrenci</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Öğrenci seçin —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentNo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {studentId && (
        <div className="grid cols-2">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Ödeme Yöntemi</h3>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Tür</label>
                <select value={type} onChange={(e) => setType(e.target.value as PaymentMethodRow["type"])}>
                  {Object.entries(PAYMENT_METHOD_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {type === "KREDI_KARTI" && (
                <div className="field">
                  <label>Maskeli Kart No (opsiyonel)</label>
                  <input
                    type="text"
                    placeholder="•••• •••• •••• 4831"
                    value={maskedCardNumber}
                    onChange={(e) => setMaskedCardNumber(e.target.value)}
                  />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Varsayılan ödeme yöntemi yap
              </label>
              <button type="submit" className="btn primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Ekleniyor…" : "Ekle"}
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Kayıtlı Ödeme Yöntemleri</h3>
              <span className="hint">{methods.length} kayıt</span>
            </div>
            {methodsQuery.isLoading ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
            ) : methods.length === 0 ? (
              <div className="empty-state">
                <Icon name="cardIcon" />
                <p>Bu öğrenci için henüz bir ödeme yöntemi kayıtlı değil.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {methods.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                  >
                    <div>
                      <div style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {PAYMENT_METHOD_TYPE_LABEL[m.type]}
                        {m.isDefault && <span className="chip strong">Varsayılan</span>}
                      </div>
                      {m.maskedCardNumber && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{m.maskedCardNumber} · {m.provider}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn danger xs"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
