"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import {
  setStudentArchived,
  fetchStudentDetail,
  updateStudentGuardianContact,
  updateStudentOwnContact,
  studentsRosterKeys,
  type AchievementTag,
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
            <span key={t.code} className={`chip ${tone}`} title={t.code}>{t.label}</span>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Öğrenci Detay Sayfası — Şube/HQ Öğrenciler listesinde bir öğrenciye
 * tıklanınca açılan TAM SAYFA görünüm (StudentDetailDrawer'ın sayfa
 * karşılığı; aynı /api/branch/students/[id]/detail verisini kullanır ama
 * roster satırına ihtiyaç duymaz — kimlik alanları da API'den gelir).
 */
export function StudentDetailView({ studentId }: { studentId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["branch-students", "detail", studentId],
    queryFn: () => fetchStudentDetail(studentId),
  });
  const detail = detailQuery.data?.student ?? null;

  const [editing, setEditing] = useState(false);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingOwn, setEditingOwn] = useState(false);
  const [ownPhone, setOwnPhone] = useState("");
  const [ownEmail, setOwnEmail] = useState("");
  const [ownTargetGoal, setOwnTargetGoal] = useState("");
  const [ownFormError, setOwnFormError] = useState<string | null>(null);

  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (detail) {
      setGuardianFullName(detail.guardianName ?? "");
      setGuardianPhone(detail.guardianPhone ?? "");
      setOwnPhone(detail.phone ?? "");
      setOwnEmail(detail.email);
      setOwnTargetGoal(detail.targetGoal ?? "");
    }
  }, [detail]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() });
    queryClient.invalidateQueries({ queryKey: ["branch-students", "detail", studentId] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: { guardianFullName: string; guardianPhone: string }) => updateStudentGuardianContact(studentId, input),
    onSuccess: () => { invalidate(); setEditing(false); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Güncellenemedi."),
  });
  const saveOwnMutation = useMutation({
    mutationFn: (input: Partial<{ phone: string; email: string; targetGoal: string | null }>) => updateStudentOwnContact(studentId, input),
    onSuccess: () => { invalidate(); setEditingOwn(false); setOwnFormError(null); },
    onError: (err) => setOwnFormError(err instanceof ApiError ? err.message : "Güncellenemedi."),
  });
  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => setStudentArchived(studentId, archived),
    onSuccess: () => { invalidate(); setDeleteArmed(false); setDeleteError(null); },
    onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "İşlem başarısız."),
  });

  function handleSave() {
    if (!guardianFullName.trim() || !guardianPhone.trim()) { setFormError("Veli adı ve telefonu zorunludur."); return; }
    saveMutation.mutate({ guardianFullName: guardianFullName.trim(), guardianPhone: guardianPhone.trim() });
  }
  function handleSaveOwn() {
    if (!ownEmail.trim() || !ownEmail.includes("@")) { setOwnFormError("Geçerli bir e-posta girin."); return; }
    saveOwnMutation.mutate({ phone: ownPhone.trim() || undefined, email: ownEmail.trim(), targetGoal: ownTargetGoal.trim() || null });
  }

  return (
    <div className="screen">
      <button type="button" className="btn ghost sm" onClick={() => router.push("/ogrenciler")} style={{ marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="chevron" /> Öğrenciler
      </button>

      {detailQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      {detailQuery.isError && (
        <div className="card card-pad"><p style={{ margin: 0, color: "var(--critical)", fontWeight: 600 }}>{detailQuery.error instanceof ApiError ? detailQuery.error.message : "Öğrenci detayı yüklenemedi."}</p></div>
      )}

      {detail && (
        <>
          {/* Başlık */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
            {detail.photoDataUrl && (
              <img src={detail.photoDataUrl} alt={detail.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-strong)" }} />
            )}
            <div>
              <h1 style={{ margin: 0 }}>{detail.name}{detail.archived && <span className="chip" style={{ marginLeft: 8, fontSize: "var(--text-xs)" }}>Arşivli</span>}</h1>
              <p className="lede" style={{ margin: "2px 0 0" }}>
                {detail.studentNo} · {GRADE_LEVEL_LABEL[detail.gradeLevel as keyof typeof GRADE_LEVEL_LABEL] ?? detail.gradeLevel} · {detail.classroomName ?? "— Atanmamış —"} · <span className={PAYMENT_STATUS_CHIP[detail.paymentStatus]}>{PAYMENT_STATUS_LABEL[detail.paymentStatus]}</span>
              </p>
            </div>
          </div>

          <div className="grid cols-2" style={{ gap: 14, alignItems: "start", marginTop: 14 }}>
            {/* Kimlik & İletişim */}
            <div className="card card-pad">
              <div className="card-head">
                <h3>Kimlik &amp; İletişim</h3>
                {!editingOwn && <button type="button" className="btn xs" onClick={() => setEditingOwn(true)}>Düzenle</button>}
              </div>
              {!editingOwn ? (
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>T.C. Kimlik No</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.nationalId ?? "—"}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Doğum Tarihi</dt><dd style={{ margin: 0, fontWeight: 600 }}>{formatDate(detail.birthDate)}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Cinsiyet</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.gender ?? "—"}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Kullanıcı Adı / E-posta</dt><dd style={{ margin: 0, fontWeight: 600, wordBreak: "break-all", textAlign: "right" }}>{detail.email}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Telefon</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.phone ?? "—"}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Hedef</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.targetGoal ?? "—"}</dd></div>
                </dl>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field"><label>E-posta / Kullanıcı Adı</label><input type="email" value={ownEmail} onChange={(e) => setOwnEmail(e.target.value)} /></div>
                  <div className="field"><label>Telefon</label><input value={ownPhone} onChange={(e) => setOwnPhone(e.target.value)} /></div>
                  <div className="field"><label>Hedef</label><input value={ownTargetGoal} onChange={(e) => setOwnTargetGoal(e.target.value)} placeholder="Örn. Tıp Fakültesi" /></div>
                  {ownFormError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{ownFormError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn primary sm" disabled={saveOwnMutation.isPending} onClick={handleSaveOwn}>{saveOwnMutation.isPending ? "Kaydediliyor…" : "Kaydet"}</button>
                    <button type="button" className="btn sm" onClick={() => setEditingOwn(false)}>Vazgeç</button>
                  </div>
                </div>
              )}
            </div>

            {/* Veli İletişim */}
            <div className="card card-pad">
              <div className="card-head">
                <h3>Veli İletişim Bilgisi</h3>
                {!editing && <button type="button" className="btn xs" onClick={() => setEditing(true)}>Düzenle</button>}
              </div>
              {!editing ? (
                <dl style={{ margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Ad Soyad</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.guardianName ?? "—"}</dd></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><dt style={{ color: "var(--ink-muted)" }}>Telefon</dt><dd style={{ margin: 0, fontWeight: 600 }}>{detail.guardianPhone ?? "—"}</dd></div>
                </dl>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field"><label>Veli Adı Soyadı</label><input value={guardianFullName} onChange={(e) => setGuardianFullName(e.target.value)} /></div>
                  <div className="field"><label>Veli Telefonu</label><input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} /></div>
                  {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn primary sm" disabled={saveMutation.isPending} onClick={handleSave}>{saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}</button>
                    <button type="button" className="btn sm" onClick={() => setEditing(false)}>Vazgeç</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Son Sınav */}
          {detail.lastExamStats && (
            <div style={{ marginTop: 14 }}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-faint)" }}>Son Sınav</p>
              <div className="grid cols-4" style={{ gap: 8 }}>
                <div className="card stat-card tone-strong"><p className="stat-label">Doğru</p><p className="stat-value">{detail.lastExamStats.correct}</p></div>
                <div className="card stat-card tone-critical"><p className="stat-label">Yanlış</p><p className="stat-value">{detail.lastExamStats.wrong}</p></div>
                <div className="card stat-card"><p className="stat-label">Boş</p><p className="stat-value">{detail.lastExamStats.empty}</p></div>
                <div className="card stat-card tone-accent"><p className="stat-label">Net</p><p className="stat-value">{detail.lastExamStats.netScore}</p></div>
              </div>
            </div>
          )}

          {/* AI Profil */}
          {detail.aiProfile && (
            <div className="card card-pad" style={{ marginTop: 14, background: "var(--brand-tint)", borderColor: "var(--brand)" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)" }}>🧠 AI Profil Özeti</h3>
              <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                {detail.aiProfile.netTrend == null
                  ? "Net trendi için en az iki sınav sonucu gerekiyor."
                  : detail.aiProfile.netTrend > 0
                    ? `Son sınavda net ${detail.aiProfile.netTrend} puan arttı.`
                    : detail.aiProfile.netTrend < 0
                      ? `Son sınavda net ${Math.abs(detail.aiProfile.netTrend)} puan azaldı.`
                      : "Net puanı bir önceki sınavla aynı kaldı."}
              </p>
              {detail.aiProfile.priorityAchievements.length > 0 && (
                <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                  Öncelikli kazanımlar: {detail.aiProfile.priorityAchievements.map((a) => a.label).join(", ")}.
                </p>
              )}
            </div>
          )}

          {/* Kazanım etiketleri */}
          {(detail.achievementTags.strong.length + detail.achievementTags.weak.length + detail.achievementTags.critical.length > 0) && (
            <div className="card card-pad" style={{ marginTop: 14 }}>
              <div className="card-head"><h3>Kazanım Durumu</h3></div>
              <AchievementTagRow label="Güçlü Kazanımlar" tone="strong" tags={detail.achievementTags.strong} />
              <AchievementTagRow label="Geliştirilmesi Gerekenler" tone="weak" tags={detail.achievementTags.weak} />
              <AchievementTagRow label="Kritik Eksikler" tone="critical" tags={detail.achievementTags.critical} />
            </div>
          )}

          {/* Arşivle / Geri al */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
            {detail.archived ? (
              <>
                {deleteError && <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{deleteError}</p>}
                <button type="button" className="btn sm" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(false)}>
                  {archiveMutation.isPending ? "İşleniyor…" : "Arşivden Geri Al (Aktifleştir)"}
                </button>
              </>
            ) : deleteArmed ? (
              <>
                <p style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                  Bu öğrenci pasife alınsın (arşivlensin) mi? Listeden kaldırılır ve girişi kapanır; taksit, ödeme, sınav vb. tüm kayıtları korunur ve gerektiğinde arşivden geri alınabilir.
                </p>
                {deleteError && <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{deleteError}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="btn sm danger solid" disabled={archiveMutation.isPending} onClick={() => archiveMutation.mutate(true)}>{archiveMutation.isPending ? "Arşivleniyor…" : "Evet, Pasife Al"}</button>
                  <button type="button" className="btn sm" onClick={() => setDeleteArmed(false)}>Vazgeç</button>
                </div>
              </>
            ) : (
              <button type="button" className="btn sm danger" onClick={() => setDeleteArmed(true)}>Öğrenci Kaydını Arşivle (Pasife Al)</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
