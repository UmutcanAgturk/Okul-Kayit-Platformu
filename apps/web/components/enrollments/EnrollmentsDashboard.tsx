"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  cancelEnrollment,
  completeEnrollment,
  createEnrollment,
  EnrollmentRow,
  enrollmentKeys,
  fetchEnrollments,
  GRADE_LEVEL_LABEL,
  PROGRAM_TYPE_OPTIONS,
  STAGE_LABEL,
  updateEnrollment,
} from "@/lib/api/enrollments";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const GRADE_OPTIONS = Object.keys(GRADE_LEVEL_LABEL);
const LOCKED_STAGES = ["KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];

const STAGE_CHIP: Record<string, string> = {
  ON_KAYIT_ALINDI: "neutral",
  SOZLESME_BEKLENIYOR: "weak",
  ODEME_PLANI_OLUSTURULDU: "neutral",
  KAYIT_TAMAMLANDI: "strong",
  IPTAL_EDILDI: "critical",
};

/**
 * "Öğrenci Ön Kayıt" + "Normal Kayıt (Tekli Dönüştürme)" — Enrollment
 * modelinin ilk gerçek arayüzü. Backend (bkz. app/api/branch/enrollments)
 * daha önceki bir oturumda eklenmişti ama hiç frontend'i yoktu. Bir aday
 * burada oluşturulur (ON_KAYIT), düzenlenebilir/iptal edilebilir, ve
 * "Kaydı Tamamla" ile gerçek bir User+StudentProfile+taksit planına
 * dönüştürülür (demo'daki "Normal Kayıt: Tekli Dönüştürme" ekranının
 * karşılığı).
 */
export function EnrollmentsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  const enrollmentsQuery = useQuery({ queryKey: enrollmentKeys.list(), queryFn: () => fetchEnrollments(), enabled: !!me });

  const [candidateFullName, setCandidateFullName] = useState("");
  const [candidateGradeLevel, setCandidateGradeLevel] = useState("SINIF_9");
  const [programType, setProgramType] = useState(PROGRAM_TYPE_OPTIONS[0]);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ candidateFullName: string; guardianFullName: string; guardianPhone: string; programType: string }>({
    candidateFullName: "",
    guardianFullName: "",
    guardianPhone: "",
    programType: PROGRAM_TYPE_OPTIONS[0],
  });

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeDraft, setCompleteDraft] = useState({ installmentCount: "1", installmentAmount: "", firstDueDate: "" });
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: createEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list() });
      setCandidateFullName("");
      setGuardianFullName("");
      setGuardianPhone("");
      setDepositAmount("");
      setProgramType(PROGRAM_TYPE_OPTIONS[0]);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Ön kayıt oluşturulamadı."),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof updateEnrollment>[1] }) => updateEnrollment(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list() });
      setEditingId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelEnrollment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list() });
      setCancelingId(null);
    },
  });

  const completeMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof completeEnrollment>[1] }) => completeEnrollment(vars.id, vars.input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list() });
      setCompletingId(null);
      setCompleteError(null);
      setCredentials(data.credentials);
    },
    onError: (err) => setCompleteError(err instanceof ApiError ? err.message : "Kayıt tamamlanamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateFullName.trim() || !guardianFullName.trim() || !guardianPhone.trim()) {
      setFormError("Aday adı soyadı, veli adı soyadı ve veli telefonu zorunludur.");
      return;
    }
    createMutation.mutate({
      type: "ON_KAYIT",
      candidateFullName: candidateFullName.trim(),
      candidateGradeLevel,
      programType,
      guardianFullName: guardianFullName.trim(),
      guardianPhone: guardianPhone.trim(),
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
    });
  }

  function startEdit(row: EnrollmentRow) {
    setEditingId(row.id);
    setCancelingId(null);
    setCompletingId(null);
    setEditDraft({ candidateFullName: row.candidateFullName, guardianFullName: row.guardianFullName, guardianPhone: row.guardianPhone, programType: row.programType });
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, input: editDraft });
  }

  function startComplete(row: EnrollmentRow) {
    setCompletingId(row.id);
    setEditingId(null);
    setCancelingId(null);
    setCompleteError(null);
    setCompleteDraft({ installmentCount: "1", installmentAmount: "", firstDueDate: new Date().toISOString().slice(0, 10) });
  }

  function submitComplete(id: string) {
    const count = Number(completeDraft.installmentCount);
    const amount = Number(completeDraft.installmentAmount);
    const firstDueDate = completeDraft.firstDueDate;
    if (!count || count < 1 || count > 36 || !amount || amount <= 0 || !firstDueDate) {
      setCompleteError("Taksit sayısı (1-36), taksit tutarı (>0) ve ilk vade tarihi zorunludur.");
      return;
    }
    completeMutation.mutate({ id, input: { installmentCount: count, installmentAmount: amount, firstDueDate } });
  }

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ön Kayıt yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const enrollments = enrollmentsQuery.data?.enrollments ?? [];

  return (
    <div className="screen">
      <h1>Öğrenci Ön Kayıt</h1>
      <p className="lede">
        {me.firstName} {me.lastName} · Aday öğrencinin yerini ayırtın, ardından sözleşme ve ödeme planıyla tam kayda dönüştürün.
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {enrollmentsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      <div className="grid cols-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Ön Kayıt</h3>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Aday Adı Soyadı</label>
                <input value={candidateFullName} onChange={(e) => setCandidateFullName(e.target.value)} />
              </div>
              <div className="field">
                <label>Sınıf Düzeyi</label>
                <select value={candidateGradeLevel} onChange={(e) => setCandidateGradeLevel(e.target.value)}>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {GRADE_LEVEL_LABEL[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Kayıt Türü</label>
                <select value={programType} onChange={(e) => setProgramType(e.target.value)}>
                  {PROGRAM_TYPE_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Veli Adı Soyadı</label>
                  <input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} />
                </div>
                <div className="field">
                  <label>Veli Telefonu</label>
                  <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="05xx xxx xx xx" />
                </div>
              </div>
              <div className="field">
                <label>Kapora (₺, opsiyonel)</label>
                <input type="number" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              </div>

              {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

              <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
                {createMutation.isPending ? "Oluşturuluyor…" : "Ön Kaydı Oluştur"}
              </button>
            </form>
          </div>

          {credentials && (
            <div className="card card-pad" style={{ borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--strong)" }}>Kayıt Tamamlandı — Giriş Bilgileri</h3>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                Bu şifre yalnızca burada gösterilir — hemen veliye/öğrenciye iletin, tekrar görüntülenemez.
              </p>
              <dl style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <dt>Kullanıcı adı</dt>
                  <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.username}</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <dt>Şifre</dt>
                  <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.password}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Ön Kayıt Listesi</h3>
            <span className="hint">{enrollments.length} aday</span>
          </div>

          {enrollmentsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!enrollmentsQuery.isLoading && enrollments.length === 0 && (
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz ön kayıt yok. Soldaki formdan ilk adayınızı ekleyin.</p>
          )}

          <div style={{ maxHeight: 640, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {enrollments.map((row) => {
              const locked = LOCKED_STAGES.includes(row.stage);

              if (cancelingId === row.id) {
                return (
                  <div key={row.id} style={{ border: "1px solid var(--critical)", borderRadius: "var(--radius-sm)", padding: 12, fontSize: "var(--text-sm)" }}>
                    <p style={{ margin: 0, color: "var(--critical)" }}>
                      <b>{row.candidateFullName}</b> iptal edilsin mi?
                    </p>
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => cancelMutation.mutate(row.id)} disabled={cancelMutation.isPending} className="btn danger solid xs">
                        Evet, İptal Et
                      </button>
                      <button type="button" onClick={() => setCancelingId(null)} className="btn xs">
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              if (editingId === row.id) {
                return (
                  <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                    <input
                      value={editDraft.candidateFullName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, candidateFullName: e.target.value }))}
                      placeholder="Aday adı soyadı"
                    />
                    <input
                      value={editDraft.guardianFullName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, guardianFullName: e.target.value }))}
                      placeholder="Veli adı soyadı"
                    />
                    <input
                      value={editDraft.guardianPhone}
                      onChange={(e) => setEditDraft((d) => ({ ...d, guardianPhone: e.target.value }))}
                      placeholder="Veli telefonu"
                    />
                    <select value={editDraft.programType} onChange={(e) => setEditDraft((d) => ({ ...d, programType: e.target.value }))}>
                      {PROGRAM_TYPE_OPTIONS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => saveEdit(row.id)} disabled={updateMutation.isPending} className="btn primary xs">
                        Kaydet
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn xs">
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              if (completingId === row.id) {
                return (
                  <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--brand)", borderRadius: "var(--radius-sm)", padding: 12 }}>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "var(--text-sm)" }}>{row.candidateFullName} — Kayıt Tamamla</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div className="field">
                        <label>Taksit Sayısı</label>
                        <input
                          type="number"
                          min="1"
                          max="36"
                          value={completeDraft.installmentCount}
                          onChange={(e) => setCompleteDraft((d) => ({ ...d, installmentCount: e.target.value }))}
                        />
                      </div>
                      <div className="field">
                        <label>Taksit Tutarı (₺)</label>
                        <input
                          type="number"
                          min="0"
                          value={completeDraft.installmentAmount}
                          onChange={(e) => setCompleteDraft((d) => ({ ...d, installmentAmount: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label>İlk Vade Tarihi</label>
                      <input type="date" value={completeDraft.firstDueDate} onChange={(e) => setCompleteDraft((d) => ({ ...d, firstDueDate: e.target.value }))} />
                    </div>
                    {completeError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{completeError}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => submitComplete(row.id)} disabled={completeMutation.isPending} className="btn success solid xs">
                        {completeMutation.isPending ? "Tamamlanıyor…" : "Onayla ve Tamamla"}
                      </button>
                      <button type="button" onClick={() => setCompletingId(null)} className="btn xs">
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={row.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.candidateFullName}</div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                        {GRADE_LEVEL_LABEL[row.candidateGradeLevel] ?? row.candidateGradeLevel} · Veli: {row.guardianFullName} ({row.guardianPhone})
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span className={`chip ${STAGE_CHIP[row.stage] ?? "neutral"}`}>{STAGE_LABEL[row.stage]}</span>
                      <span className="chip neutral">{row.programType}</span>
                    </div>
                  </div>
                  {!locked && (
                    <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: "var(--text-xs)" }}>
                      <button
                        type="button"
                        onClick={() => startComplete(row)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--strong)", fontWeight: 600 }}
                      >
                        Kaydı Tamamla
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-muted)" }}
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelingId(row.id)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-faint)" }}
                      >
                        İptal Et
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
