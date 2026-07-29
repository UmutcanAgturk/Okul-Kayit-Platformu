"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { CRM_STAGE_LABEL, CRM_STAGES, createCrmLead, CrmLead, crmKeys, deleteCrmLead, fetchCrmLeads, updateCrmLead } from "@/lib/api/crm";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const GRADE_OPTIONS = Object.keys(GRADE_LEVEL_LABEL);

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800";

/**
 * CRM — demo/seviye360-app.html'deki SCREENS["branch:crm"] Kanban'ının
 * gerçek karşılığı (bkz. app/api/branch/crm-leads). Sürükle-bırak yerine
 * (bu depodaki hiçbir modülde drag-and-drop kullanılmadı) "İleri Al/Geri Al"
 * butonlarıyla aşama değişimi — aynı görsel Kanban etkisini basit ve tutarlı
 * bir şekilde verir.
 */
export function CrmDashboard() {
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

  const leadsQuery = useQuery({ queryKey: crmKeys.list(), queryFn: fetchCrmLeads, enabled: !!me });

  const [candidateFullName, setCandidateFullName] = useState("");
  const [candidateGradeLevel, setCandidateGradeLevel] = useState("SINIF_9");
  const [school, setSchool] = useState("");
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ candidateFullName: "", guardianFullName: "", guardianPhone: "", notes: "" });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createCrmLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.list() });
      setCandidateFullName("");
      setSchool("");
      setGuardianFullName("");
      setGuardianPhone("");
      setGuardianEmail("");
      setNotes("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "CRM adayı oluşturulamadı."),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof updateCrmLead>[1] }) => updateCrmLead(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.list() });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCrmLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.list() });
      setDeletingId(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!candidateFullName.trim() || !guardianFullName.trim() || !guardianPhone.trim()) {
      setFormError("Aday adı soyadı, veli adı soyadı ve veli telefonu zorunludur.");
      return;
    }
    createMutation.mutate({
      candidateFullName: candidateFullName.trim(),
      candidateGradeLevel,
      guardianFullName: guardianFullName.trim(),
      guardianPhone: guardianPhone.trim(),
      school: school.trim() || undefined,
      guardianEmail: guardianEmail.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  function startEdit(lead: CrmLead) {
    setEditingId(lead.id);
    setDeletingId(null);
    setEditDraft({ candidateFullName: lead.candidateFullName, guardianFullName: lead.guardianFullName, guardianPhone: lead.guardianPhone, notes: lead.notes ?? "" });
  }

  function saveEdit(id: string) {
    updateMutation.mutate({ id, input: { ...editDraft, notes: editDraft.notes || null } });
  }

  function moveStage(lead: CrmLead, direction: 1 | -1) {
    const idx = CRM_STAGES.indexOf(lead.stage);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= CRM_STAGES.length) return;
    updateMutation.mutate({ id: lead.id, input: { stage: CRM_STAGES[nextIdx] } });
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
          Bu modüle erişim yetkiniz yok. CRM yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const leads = leadsQuery.data?.leads ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Aday öğrencileri statü bazında takip edin.</p>
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

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Aday Ekle</h2>
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Öğrencinin Okuduğu Okul (opsiyonel)</label>
            <input value={school} onChange={(e) => setSchool(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Veli E-postası (opsiyonel)</label>
            <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} type="email" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Veli Adı Soyadı</label>
            <input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Veli Telefonu</label>
            <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="05xx xxx xx xx" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Velinin Düşünceleri (opsiyonel)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>

          {formError && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
            >
              {createMutation.isPending ? "Ekleniyor…" : "Ekle"}
            </button>
          </div>
        </form>
      </div>

      {leadsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
      {!leadsQuery.isLoading && leads.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Henüz aday yok. Yukarıdaki formdan ilk adayınızı ekleyin.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CRM_STAGES.map((stage, stageIdx) => {
          const stageLeads = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{CRM_STAGE_LABEL[stage]}</h3>
                <span className="text-xs text-slate-400">{stageLeads.length}</span>
              </div>
              <div className="space-y-2">
                {stageLeads.map((lead) => {
                  if (deletingId === lead.id) {
                    return (
                      <div key={lead.id} className="rounded-lg border border-red-200 p-2 text-xs dark:border-red-900">
                        <p className="text-red-700 dark:text-red-300">
                          <b>{lead.candidateFullName}</b> silinsin mi?
                        </p>
                        <div className="mt-1.5 flex gap-2">
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(lead.id)}
                            disabled={deleteMutation.isPending}
                            className="rounded bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                          >
                            Evet, Sil
                          </button>
                          <button type="button" onClick={() => setDeletingId(null)} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700">
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (editingId === lead.id) {
                    return (
                      <div key={lead.id} className="space-y-1.5 rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700">
                        <input
                          value={editDraft.candidateFullName}
                          onChange={(e) => setEditDraft((d) => ({ ...d, candidateFullName: e.target.value }))}
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
                        <textarea
                          value={editDraft.notes}
                          onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                          placeholder="Velinin düşünceleri"
                          className={inputCls}
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => saveEdit(lead.id)}
                            disabled={updateMutation.isPending}
                            className="rounded bg-[#0071ce] px-2 py-1 font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
                          >
                            Kaydet
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700">
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={lead.id} className="rounded-lg border border-slate-100 p-2 text-xs dark:border-slate-800">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{lead.candidateFullName}</div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {GRADE_LEVEL_LABEL[lead.candidateGradeLevel] ?? lead.candidateGradeLevel} · Veli: {lead.guardianFullName}
                      </div>
                      {lead.enrollmentId && (
                        <span className="mt-1 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          Ön Kayıt oluşturuldu
                        </span>
                      )}
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {stageIdx > 0 && (
                          <button type="button" onClick={() => moveStage(lead, -1)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
                            ← Geri Al
                          </button>
                        )}
                        {stageIdx < CRM_STAGES.length - 1 && (
                          <button type="button" onClick={() => moveStage(lead, 1)} className="font-medium text-[#0071ce] hover:text-[#00558f]">
                            İleri Al →
                          </button>
                        )}
                        <button type="button" onClick={() => startEdit(lead)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
                          Düzenle
                        </button>
                        {!lead.enrollmentId && (
                          <button type="button" onClick={() => setDeletingId(lead.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                            Sil
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
