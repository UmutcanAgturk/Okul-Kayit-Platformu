"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { updateStudentGuardianContact, studentsRosterKeys, type BranchStudentRow } from "@/lib/api/students-roster";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";

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

  useEffect(() => {
    setEditing(false);
    setFormError(null);
    if (student) {
      setGuardianFullName(student.guardianName ?? "");
      setGuardianPhone(student.guardianPhone ?? "");
    }
  }, [student]);

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

  const open = !!student;

  function handleSave() {
    if (!guardianFullName.trim() || !guardianPhone.trim()) {
      setFormError("Veli adı ve telefonu zorunludur.");
      return;
    }
    saveMutation.mutate({ guardianFullName: guardianFullName.trim(), guardianPhone: guardianPhone.trim() });
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
              <div>
                <h3 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 800 }}>{student.name}</h3>
                <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{student.studentNo}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-faint)" }}>
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
            </dl>

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
          </>
        )}
      </div>
    </>
  );
}
