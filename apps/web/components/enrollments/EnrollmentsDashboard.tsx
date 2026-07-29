"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  cancelEnrollment,
  completeEnrollment,
  createEnrollment,
  EnrollmentRow,
  enrollmentKeys,
  fetchEnrollments,
  GRADE_LEVEL_LABEL,
  STAGE_LABEL,
  updateEnrollment,
} from "@/lib/api/enrollments";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const GRADE_OPTIONS = Object.keys(GRADE_LEVEL_LABEL);
const LOCKED_STAGES = ["KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];

const STAGE_TONE: Record<string, string> = {
  ON_KAYIT_ALINDI: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  SOZLESME_BEKLENIYOR: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  ODEME_PLANI_OLUSTURULDU: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  KAYIT_TAMAMLANDI: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  IPTAL_EDILDI: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800";

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  const enrollmentsQuery = useQuery({ queryKey: enrollmentKeys.list(), queryFn: () => fetchEnrollments(), enabled: !!me });

  const [candidateFullName, setCandidateFullName] = useState("");
  const [candidateGradeLevel, setCandidateGradeLevel] = useState("SINIF_9");
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ candidateFullName: string; guardianFullName: string; guardianPhone: string }>({
    candidateFullName: "",
    guardianFullName: "",
    guardianPhone: "",
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
      guardianFullName: guardianFullName.trim(),
      guardianPhone: guardianPhone.trim(),
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
    });
  }

  function startEdit(row: EnrollmentRow) {
    setEditingId(row.id);
    setCancelingId(null);
    setCompletingId(null);
    setEditDraft({ candidateFullName: row.candidateFullName, guardianFullName: row.guardianFullName, guardianPhone: row.guardianPhone });
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
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Ön Kayıt yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const enrollments = enrollmentsQuery.data?.enrollments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Öğrenci Ön Kayıt</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName} · Aday öğrencinin yerini ayırtın, ardından sözleşme ve ödeme planıyla tam kayda dönüştürün.
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Ön Kayıt</h2>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Aday Adı Soyadı</label>
                <input value={candidateFullName} onChange={(e) => setCandidateFullName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Sınıf Düzeyi</label>
                <select value={candidateGradeLevel} onChange={(e) => setCandidateGradeLevel(e.target.value)} className={inputCls}>
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {GRADE_LEVEL_LABEL[g]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Veli Adı Soyadı</label>
                  <input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Veli Telefonu</label>
                  <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="05xx xxx xx xx" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kapora (₺, opsiyonel)</label>
                <input type="number" min="0" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className={inputCls} />
              </div>

              {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
              >
                {createMutation.isPending ? "Oluşturuluyor…" : "Ön Kaydı Oluştur"}
              </button>
            </form>
          </div>

          {credentials && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Kayıt Tamamlandı — Giriş Bilgileri</h2>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Bu şifre yalnızca burada gösterilir — hemen veliye/öğrenciye iletin, tekrar görüntülenemez.
              </p>
              <dl className="mt-2 space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
                <div className="flex justify-between">
                  <dt>Kullanıcı adı</dt>
                  <dd className="font-mono">{credentials.username}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Şifre</dt>
                  <dd className="font-mono">{credentials.password}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ön Kayıt Listesi</h2>
            <span className="text-xs text-slate-400">{enrollments.length} aday</span>
          </div>

          {enrollmentsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {!enrollmentsQuery.isLoading && enrollments.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz ön kayıt yok. Soldaki formdan ilk adayınızı ekleyin.</p>
          )}

          <div className="mt-3 max-h-[640px] space-y-3 overflow-y-auto">
            {enrollments.map((row) => {
              const locked = LOCKED_STAGES.includes(row.stage);

              if (cancelingId === row.id) {
                return (
                  <div key={row.id} className="rounded-lg border border-red-200 p-3 text-sm dark:border-red-900">
                    <p className="text-red-700 dark:text-red-300">
                      <b>{row.candidateFullName}</b> iptal edilsin mi?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate(row.id)}
                        disabled={cancelMutation.isPending}
                        className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        Evet, İptal Et
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancelingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              if (editingId === row.id) {
                return (
                  <div key={row.id} className="space-y-2 rounded-lg border border-slate-300 p-3 text-sm dark:border-slate-700">
                    <input
                      value={editDraft.candidateFullName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, candidateFullName: e.target.value }))}
                      placeholder="Aday adı soyadı"
                      className={inputCls}
                    />
                    <input
                      value={editDraft.guardianFullName}
                      onChange={(e) => setEditDraft((d) => ({ ...d, guardianFullName: e.target.value }))}
                      placeholder="Veli adı soyadı"
                      className={inputCls}
                    />
                    <input
                      value={editDraft.guardianPhone}
                      onChange={(e) => setEditDraft((d) => ({ ...d, guardianPhone: e.target.value }))}
                      placeholder="Veli telefonu"
                      className={inputCls}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(row.id)}
                        disabled={updateMutation.isPending}
                        className="rounded-lg bg-[#0071ce] px-3 py-1 text-xs font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
                      >
                        Kaydet
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              if (completingId === row.id) {
                return (
                  <div key={row.id} className="space-y-2 rounded-lg border border-[#0071ce] p-3 text-sm dark:border-blue-700">
                    <p className="font-medium text-slate-900 dark:text-slate-50">
                      {row.candidateFullName} — Kayıt Tamamla
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Taksit Sayısı</label>
                        <input
                          type="number"
                          min="1"
                          max="36"
                          value={completeDraft.installmentCount}
                          onChange={(e) => setCompleteDraft((d) => ({ ...d, installmentCount: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Taksit Tutarı (₺)</label>
                        <input
                          type="number"
                          min="0"
                          value={completeDraft.installmentAmount}
                          onChange={(e) => setCompleteDraft((d) => ({ ...d, installmentAmount: e.target.value }))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">İlk Vade Tarihi</label>
                      <input
                        type="date"
                        value={completeDraft.firstDueDate}
                        onChange={(e) => setCompleteDraft((d) => ({ ...d, firstDueDate: e.target.value }))}
                        className={inputCls}
                      />
                    </div>
                    {completeError && <p className="text-xs text-red-600 dark:text-red-400">{completeError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submitComplete(row.id)}
                        disabled={completeMutation.isPending}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {completeMutation.isPending ? "Tamamlanıyor…" : "Onayla ve Tamamla"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompletingId(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={row.id} className="border-b border-slate-100 pb-2 text-sm dark:border-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-50">{row.candidateFullName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {GRADE_LEVEL_LABEL[row.candidateGradeLevel] ?? row.candidateGradeLevel} · Veli: {row.guardianFullName} ({row.guardianPhone})
                      </div>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${STAGE_TONE[row.stage] ?? ""}`}>
                      {STAGE_LABEL[row.stage]}
                    </span>
                  </div>
                  {!locked && (
                    <div className="mt-1.5 flex gap-3 text-xs">
                      <button type="button" onClick={() => startComplete(row)} className="font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                        Kaydı Tamamla
                      </button>
                      <button type="button" onClick={() => startEdit(row)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
                        Düzenle
                      </button>
                      <button type="button" onClick={() => setCancelingId(row.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400">
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
