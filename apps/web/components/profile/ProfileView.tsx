"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { changeMyPassword, fetchMyProfile } from "@/lib/api/profile";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Genel Merkez Yöneticisi",
  BRANCH_ADMIN: "Şube Yöneticisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
  ACCOUNTING: "Muhasebe Görevlisi",
  TEACHER: "Öğretmen",
  STUDENT: "Öğrenci",
  PARENT: "Veli",
};

/**
 * Profilim — demo/seviye360-app.html'deki "profilim" ekranının gerçek
 * karşılığı, tüm roller için ortak. Yeni Prisma modeli EKLEMEZ; kendi
 * User/TeacherProfile/StaffProfile/StudentProfile kaydını gösterir ve
 * şifre değiştirmeyi sağlar (bkz. app/api/me/profile, app/api/me/password).
 */
export function ProfileView() {
  const router = useRouter();

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

  const profileQuery = useQuery({ queryKey: ["me-profile"], queryFn: fetchMyProfile, enabled: !!me });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: () => changeMyPassword(currentPassword, newPassword),
    onSuccess: () => {
      setFormSuccess(true);
      setFormError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err) => {
      setFormSuccess(false);
      setFormError(err instanceof ApiError ? err.message : "Şifre değiştirilemedi.");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    if (newPassword !== confirmPassword) {
      setFormError("Yeni şifre ve tekrarı eşleşmiyor");
      return;
    }
    passwordMutation.mutate();
  }

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  const p = profileQuery.data;

  return (
    <div className="screen">
      <h1>Profilim</h1>
      <p className="lede">Hesap bilgileriniz ve şifre değişikliği.</p>

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Hesap Bilgileri</h3>
          </div>
          {profileQuery.isLoading ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "var(--text-base)" }}>
              <Row label="Ad Soyad" value={`${me.firstName} ${me.lastName}`} />
              <Row label="Rol" value={ROLE_LABEL[me.role] ?? me.role} />
              <Row label="E-posta" value={p?.email ?? me.email} />
              <Row label="Telefon" value={p?.phone ?? "—"} />
              {p?.tenantName && <Row label="Kurum" value={p.tenantName} />}
              {p?.branch && <Row label="Branş" value={p.branch} />}
              {p?.title && <Row label="Ünvan" value={p.title} />}
              {p?.department && <Row label="Departman" value={p.department} />}
              {p?.studentNo && <Row label="Öğrenci No" value={p.studentNo} />}
              {p?.gradeLevel && <Row label="Sınıf Seviyesi" value={GRADE_LEVEL_LABEL[p.gradeLevel] ?? p.gradeLevel} />}
              {p?.classroomName && <Row label="Şube" value={p.classroomName} />}
              {p?.guardianName && <Row label="Veli" value={`${p.guardianName}${p.guardianRelation ? ` (${p.guardianRelation})` : ""}`} />}
              {p?.guardianPhone && <Row label="Veli Telefonu" value={p.guardianPhone} />}
              {p?.targetGoal && <Row label="Hedef" value={p.targetGoal} />}
            </div>
          )}
        </div>

        {me.role === "PARENT" && (
          <div className="card card-pad">
            <div className="card-head">
              <h3>Çocuklarım</h3>
            </div>
            {profileQuery.isLoading ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
            ) : !p?.children || p.children.length === 0 ? (
              <p style={{ margin: 0, color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Kayıtlı bir öğrenciniz bulunamadı.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {p.children.map((c) => (
                  <div key={c.studentId} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-base)" }}>{c.fullName}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {c.relation} · Öğrenci No {c.studentNo} · {GRADE_LEVEL_LABEL[c.gradeLevel] ?? c.gradeLevel}
                      {c.classroomName ? ` · ${c.classroomName}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="card card-pad">
          <div className="card-head">
            <h3>Şifre Değiştir</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label htmlFor="currentPassword">Mevcut Şifre</label>
              <input
                id="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">Yeni Şifre</label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {formError && <span className="chip critical">{formError}</span>}
            {formSuccess && <span className="chip strong">Şifreniz güncellendi.</span>}
            <button type="submit" className="btn primary" disabled={passwordMutation.isPending}>
              {passwordMutation.isPending ? "Kaydediliyor…" : "Şifreyi Güncelle"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
      <span style={{ color: "var(--ink-faint)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
