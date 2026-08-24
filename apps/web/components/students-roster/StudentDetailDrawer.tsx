"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import {
  setStudentArchived,
  fetchStudentDetail,
  updateStudentGuardianContact,
  updateStudentOwnContact,
  studentsRosterKeys,
  type AchievementTag,
  type BranchStudentRow,
  type PaymentStatusBadge,
} from "@/lib/api/students-roster";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";

const PAYMENT_STATUS_LABEL: Record<PaymentStatusBadge, string> = {
  TAKSIT_YOK: "Taksit Yok",
  GECIKMIS: "Gecikmiş",
  PLANLI: "Planlı",
  GUNCEL: "Güncel",
};
const PAYMENT_STATUS_CHIP: Record<PaymentStatusBadge, string> = {
  TAKSIT_YOK: "chip",
  GECIKMIS: "chip critical",
  PLANLI: "chip weak",
  GUNCEL: "chip strong",
};

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("tr-TR") : "—";
}

function AchievementTagRow({ label, tone, tags }: { label: string; tone: "strong" | "weak" | "critical"; tags: AchievementTag[] }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: "0 0 5px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: `var(--${tone})` }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {tags.length === 0 ? (
          <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Yok</span>
        ) : (
          tags.map((t) => (
            <span key={t.code} className={`chip ${tone}`} title={t.code}>
              {t.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * demo/seviye360-app.html'deki openStudentDetail() çekmecesinin karşılığı —
 * Şube Öğrenciler roster'ında bir satıra tıklayınca sayfadan ayrılmadan
 * sağdan açılır; özet bilgi gösterir ve veli iletişim bilgisini satır içi
 * düzenlemeye izin verir (bkz. app/api/branch/students/[studentId] PATCH).
 */
export function StudentDetailDrawer({
  student,
  onClose,
  readOnly = false,
}: {
  student: BranchStudentRow | null;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editingOwn, setEditingOwn] = useState(false);
  const [ownPhone, setOwnPhone] = useState("");
  const [ownEmail, setOwnEmail] = useState("");
  const [ownTargetGoal, setOwnTargetGoal] = useState("");
  const [ownFormError, setOwnFormError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["branch-students", "detail", student?.id],
    queryFn: () => fetchStudentDetail(student!.id),
    enabled: !!student,
  });
  const detail = detailQuery.data?.student ?? null;

  useEffect(() => {
    setEditing(false);
    setFormError(null);
    setDeleteArmed(false);
    setDeleteError(null);
    setEditingOwn(false);
    setOwnFormError(null);
    if (student) {
      setGuardianFullName(student.guardianName ?? "");
      setGuardianPhone(student.guardianPhone ?? "");
    }
  }, [student]);

  useEffect(() => {
    if (detail) {
      setOwnPhone(detail.phone ?? "");
      setOwnEmail(detail.email);
      setOwnTargetGoal(detail.targetGoal ?? "");
    }
  }, [detail]);

  const saveMutation = useMutation({
    mutationFn: (input: { guardianFullName: string; guardianPhone: string }) =>
      updateStudentGuardianContact(student!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() });
      setEditing(false);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Güncellenemedi."),
  });

  const saveOwnMutation = useMutation({
    mutationFn: (input: Partial<{ phone: string; email: string; targetGoal: string | null }>) => updateStudentOwnContact(student!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() });
      queryClient.invalidateQueries({ queryKey: ["branch-students", "detail", student?.id] });
      setEditingOwn(false);
      setOwnFormError(null);
    },
    onError: (err) => setOwnFormError(err instanceof ApiError ? err.message : "Güncellenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: () => setStudentArchived(student!.id, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() });
      setDeleteArmed(false);
      setDeleteError(null);
      onClose();
    },
    onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Öğrenci kaydı arşivlenemedi."),
  });

  const open = !!student;

  function handleSave() {
    if (!guardianFullName.trim() || !guardianPhone.trim()) {
      setFormError("Veli adı ve telefonu zorunludur.");
      return;
    }
    saveMutation.mutate({ guardianFullName: guardianFullName.trim(), guardianPhone: guardianPhone.trim() });
  }

  function handleSaveOwn() {
    if (!ownEmail.trim() || !ownEmail.includes("@")) {
      setOwnFormError("Geçerli bir e-posta girin.");
      return;
    }
    saveOwnMutation.mutate({ phone: ownPhone.trim() || undefined, email: ownEmail.trim(), targetGoal: ownTargetGoal.trim() || null });
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(10,14,20,.45)", zIndex: 80,
          opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .18s var(--ease)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, width: "min(380px, 92vw)",
          background: "var(--surface)", color: "var(--ink)", borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)", zIndex: 81, padding: 20, overflowY: "auto",
          transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform .22s var(--ease)",
        }}
      >
        {student && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {detail?.photoDataUrl && (
                  <img
                    src={detail.photoDataUrl}
                    alt={student.name}
                    style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-strong)", flexShrink: 0 }}
                  />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 800 }}>{student.name}</h3>
                  <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{student.studentNo}</p>
                </div>
              </div>
              <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)", flexShrink: 0 }}>
                <Icon name="x" />
              </button>
            </div>

            <dl style={{ margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 8, fontSize: "var(--text-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <dt style={{ color: "var(--ink-muted)" }}>Sınıf Düzeyi</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{GRADE_LEVEL_LABEL[student.gradeLevel] ?? student.gradeLevel}</dd>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <dt style={{ color: "var(--ink-muted)" }}>Şube</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>{student.classroomName ?? "— Atanmamış —"}</dd>
              </div>
              {detail && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>Ödeme Durumu</dt>
                  <dd style={{ margin: 0 }}>
                    <span className={PAYMENT_STATUS_CHIP[detail.paymentStatus]}>{PAYMENT_STATUS_LABEL[detail.paymentStatus]}</span>
                  </dd>
                </div>
              )}
            </dl>

            <div className="card card-pad" style={{ marginBottom: 14 }}>
              <div className="card-head">
                <h3>Kimlik &amp; İletişim</h3>
                {!editingOwn && !readOnly && (
                  <button type="button" className="btn xs" onClick={() => setEditingOwn(true)}>
                    Düzenle
                  </button>
                )}
              </div>
              {detailQuery.isLoading && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Yükleniyor…</p>}
              {detail && !editingOwn && (
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>T.C. Kimlik No</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{detail.nationalId ?? "—"}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Doğum Tarihi</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{formatDate(detail.birthDate)}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Cinsiyet</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{detail.gender ?? "—"}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Kullanıcı Adı / E-posta</dt>
                    <dd style={{ margin: 0, fontWeight: 600, wordBreak: "break-all", textAlign: "right" }}>{detail.email}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Telefon</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{detail.phone ?? "—"}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Hedef</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{detail.targetGoal ?? "—"}</dd>
                  </div>
                </dl>
              )}
              {editingOwn && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field">
                    <label>E-posta / Kullanıcı Adı</label>
                    <input type="email" value={ownEmail} onChange={(e) => setOwnEmail(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Telefon</label>
                    <input value={ownPhone} onChange={(e) => setOwnPhone(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Hedef</label>
                    <input value={ownTargetGoal} onChange={(e) => setOwnTargetGoal(e.target.value)} placeholder="Örn. Tıp Fakültesi" />
                  </div>
                  {ownFormError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{ownFormError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn primary sm" disabled={saveOwnMutation.isPending} onClick={handleSaveOwn}>
                      {saveOwnMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                    <button type="button" className="btn sm" onClick={() => setEditingOwn(false)}>
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>

            {detail?.lastExamStats && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-faint)" }}>
                  Son Sınav
                </p>
                <div className="grid cols-2" style={{ gap: 8 }}>
                  <div className="card stat-card tone-strong" style={{ padding: "8px 10px" }}>
                    <p className="stat-label">Doğru</p>
                    <p className="stat-value" style={{ fontSize: 15 }}>{detail.lastExamStats.correct}</p>
                  </div>
                  <div className="card stat-card tone-critical" style={{ padding: "8px 10px" }}>
                    <p className="stat-label">Yanlış</p>
                    <p className="stat-value" style={{ fontSize: 15 }}>{detail.lastExamStats.wrong}</p>
                  </div>
                  <div className="card stat-card" style={{ padding: "8px 10px" }}>
                    <p className="stat-label">Boş</p>
                    <p className="stat-value" style={{ fontSize: 15 }}>{detail.lastExamStats.empty}</p>
                  </div>
                  <div className="card stat-card tone-accent" style={{ padding: "8px 10px" }}>
                    <p className="stat-label">Net</p>
                    <p className="stat-value" style={{ fontSize: 15 }}>{detail.lastExamStats.netScore}</p>
                  </div>
                </div>
              </div>
            )}

            {detail?.aiProfile && (
              <div className="card card-pad" style={{ marginBottom: 14, background: "var(--brand-tint)", borderColor: "var(--brand)" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)" }}>🧠 AI Profil Özeti</h3>
                <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  {detail.aiProfile.netTrend == null
                    ? "Net trendi için en az iki sınav sonucu gerekiyor."
                    : detail.aiProfile.netTrend > 0
                      ? `Son sınavda net ${detail.aiProfile.netTrend} puan arttı.`
                      : detail.aiProfile.netTrend < 0
                        ? `Son sınavda net ${Math.abs(detail.aiProfile.netTrend)} puan azaldı.`
                        : "Net puanı bir önceki sınavla aynı kaldı."}
                </p>
                {detail.aiProfile.priorityAchievements.length > 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                    Öncelikli kazanımlar: {detail.aiProfile.priorityAchievements.map((a) => a.label).join(", ")}.
                  </p>
                )}
              </div>
            )}

            {detail && (detail.achievementTags.strong.length + detail.achievementTags.weak.length + detail.achievementTags.critical.length > 0) && (
              <div style={{ marginBottom: 14 }}>
                <AchievementTagRow label="Güçlü Kazanımlar" tone="strong" tags={detail.achievementTags.strong} />
                <AchievementTagRow label="Geliştirilmesi Gerekenler" tone="weak" tags={detail.achievementTags.weak} />
                <AchievementTagRow label="Kritik Eksikler" tone="critical" tags={detail.achievementTags.critical} />
              </div>
            )}

            <div className="card card-pad">
              <div className="card-head">
                <h3>Veli İletişim Bilgisi</h3>
                {!editing && !readOnly && (
                  <button type="button" className="btn xs" onClick={() => setEditing(true)}>
                    Düzenle
                  </button>
                )}
              </div>
              {!editing ? (
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Ad Soyad</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{student.guardianName ?? "—"}</dd>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>Telefon</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>{student.guardianPhone ?? "—"}</dd>
                  </div>
                </dl>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field">
                    <label>Veli Adı Soyadı</label>
                    <input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Veli Telefonu</label>
                    <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                  </div>
                  {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn primary sm" disabled={saveMutation.isPending} onClick={handleSave}>
                      {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                    <button type="button" className="btn sm" onClick={() => setEditing(false)}>
                      Vazgeç
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!readOnly && (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                {deleteArmed ? (
                  <>
                    <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      Bu öğrenci pasife alınsın (arşivlensin) mi? Listeden kaldırılır ve girişi kapanır; taksit, ödeme, sınav vb. tüm kayıtları korunur ve gerektiğinde arşivden geri alınabilir.
                    </p>
                    {deleteError && <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{deleteError}</p>}
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" className="btn sm danger solid" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                        {deleteMutation.isPending ? "Arşivleniyor…" : "Evet, Pasife Al"}
                      </button>
                      <button type="button" className="btn sm" onClick={() => setDeleteArmed(false)}>
                        Vazgeç
                      </button>
                    </div>
                  </>
                ) : (
                  <button type="button" className="btn sm danger" onClick={() => setDeleteArmed(true)}>
                    Öğrenci Kaydını Arşivle (Pasife Al)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
