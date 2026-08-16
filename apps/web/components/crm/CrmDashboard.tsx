"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { CRM_STAGE_LABEL, CRM_STAGES, createCrmLead, CrmLead, crmKeys, deleteCrmLead, fetchCrmLeads, updateCrmLead } from "@/lib/api/crm";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const GRADE_OPTIONS = Object.keys(GRADE_LEVEL_LABEL);

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
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. CRM yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const leads = leadsQuery.data?.leads ?? [];

  return (
    <div className="screen">
      <h1>CRM</h1>
      <p className="lede">Aday öğrencileri statü bazında takip edin.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Yeni Aday Ekle</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
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
              <label>Öğrencinin Okuduğu Okul (opsiyonel)</label>
              <input value={school} onChange={(e) => setSchool(e.target.value)} />
            </div>
            <div className="field">
              <label>Veli E-postası (opsiyonel)</label>
              <input value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} type="email" />
            </div>
            <div className="field">
              <label>Veli Adı Soyadı</label>
              <input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} />
            </div>
            <div className="field">
              <label>Veli Telefonu</label>
              <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="05xx xxx xx xx" />
            </div>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Velinin Düşünceleri (opsiyonel)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            {formError && (
              <p style={{ gridColumn: "span 2", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>
            )}

            <div style={{ gridColumn: "span 2" }}>
              <button type="submit" disabled={createMutation.isPending} className="btn primary">
                {createMutation.isPending ? "Ekleniyor…" : "Ekle"}
              </button>
            </div>
          </form>
        </div>

        {leadsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!leadsQuery.isLoading && leads.length === 0 && (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz aday yok. Yukarıdaki formdan ilk adayınızı ekleyin.</p>
        )}

        <div className="grid cols-4">
          {CRM_STAGES.map((stage, stageIdx) => {
            const stageLeads = leads.filter((l) => l.stage === stage);
            return (
              <div key={stage} className="card card-pad">
                <div className="card-head">
                  <h3>{CRM_STAGE_LABEL[stage]}</h3>
                  <span className="chip neutral">{stageLeads.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stageLeads.map((lead) => {
                    if (deletingId === lead.id) {
                      return (
                        <div
                          key={lead.id}
                          style={{ border: "1px solid var(--critical)", borderRadius: "var(--radius-sm)", padding: 10, fontSize: "var(--text-xs)" }}
                        >
                          <p style={{ margin: 0, color: "var(--critical)" }}>
                            <b>{lead.candidateFullName}</b> silinsin mi?
                          </p>
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => deleteMutation.mutate(lead.id)} disabled={deleteMutation.isPending} className="btn danger solid xs">
                              Evet, Sil
                            </button>
                            <button type="button" onClick={() => setDeletingId(null)} className="btn xs">
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (editingId === lead.id) {
                      return (
                        <div
                          key={lead.id}
                          style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: 10 }}
                        >
                          <input value={editDraft.candidateFullName} onChange={(e) => setEditDraft((d) => ({ ...d, candidateFullName: e.target.value }))} />
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
                          <textarea
                            value={editDraft.notes}
                            onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
                            placeholder="Velinin düşünceleri"
                            rows={2}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => saveEdit(lead.id)} disabled={updateMutation.isPending} className="btn primary xs">
                              Kaydet
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="btn xs">
                              Vazgeç
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={lead.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontSize: "var(--text-xs)" }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)" }}>{lead.candidateFullName}</div>
                        <div style={{ color: "var(--ink-faint)" }}>
                          {GRADE_LEVEL_LABEL[lead.candidateGradeLevel] ?? lead.candidateGradeLevel} · Veli: {lead.guardianFullName}
                        </div>
                        {lead.enrollmentId && (
                          <span className="chip strong" style={{ marginTop: 4 }}>
                            Ön Kayıt oluşturuldu
                          </span>
                        )}
                        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 10 }}>
                          {stageIdx > 0 && (
                            <button
                              type="button"
                              onClick={() => moveStage(lead, -1)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}
                            >
                              ← Geri Al
                            </button>
                          )}
                          {stageIdx < CRM_STAGES.length - 1 && (
                            <button
                              type="button"
                              onClick={() => moveStage(lead, 1)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--brand)", fontWeight: 600, fontSize: "var(--text-xs)" }}
                            >
                              İleri Al →
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(lead)}
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-muted)", fontSize: "var(--text-xs)" }}
                          >
                            Düzenle
                          </button>
                          {!lead.enrollmentId && (
                            <button
                              type="button"
                              onClick={() => setDeletingId(lead.id)}
                              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}
                            >
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
    </div>
  );
}
