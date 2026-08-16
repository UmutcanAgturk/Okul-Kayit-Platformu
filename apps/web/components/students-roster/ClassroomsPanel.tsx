"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import {
  createClassroom,
  deleteClassroom,
  studentsRosterKeys,
  updateClassroom,
  type BranchClassroom,
} from "@/lib/api/students-roster";
import { Icon } from "@/components/ui/icons";

const CLASSROOM_GRADE_OPTIONS = Object.keys(GRADE_LEVEL_LABEL).filter((g) => g !== "MEZUN");

/**
 * Sınıf Atama — demo/seviye360-app.html'deki "branch:assign" ekranının şube
 * oluşturma/düzenleme/silme kartlarının gerçek karşılığı (bkz.
 * app/api/branch/classrooms). Yalnızca BRANCH_ADMIN (veya "şube olarak
 * yöneten" SUPERADMIN) görür; StudentsRosterDashboard içine gömülür.
 */
export function ClassroomsPanel({ classrooms }: { classrooms: BranchClassroom[] }) {
  const queryClient = useQueryClient();
  const [gradeLevel, setGradeLevel] = useState(CLASSROOM_GRADE_OPTIONS[0] ?? "SINIF_9");
  const [suffix, setSuffix] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSuffix, setEditSuffix] = useState("");
  const [editCapacity, setEditCapacity] = useState("30");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["branch-classrooms"] });
    queryClient.invalidateQueries({ queryKey: studentsRosterKeys.all() });
  };

  const createMutation = useMutation({
    mutationFn: () => createClassroom({ gradeLevel, suffix, capacity: Number(capacity) || 30 }),
    onSuccess: () => {
      setSuffix("");
      setCapacity("30");
      setCreateError(null);
      invalidate();
    },
    onError: (e) => setCreateError(e instanceof ApiError ? e.message : "Sınıf oluşturulamadı."),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => updateClassroom(id, { suffix: editSuffix, capacity: Number(editCapacity) || undefined }),
    onSuccess: () => {
      setEditingId(null);
      setRowError(null);
      invalidate();
    },
    onError: (e) => setRowError(e instanceof ApiError ? e.message : "Sınıf güncellenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteClassroom(id),
    onSuccess: () => {
      setDeletingId(null);
      setRowError(null);
      invalidate();
    },
    onError: (e) => setRowError(e instanceof ApiError ? e.message : "Sınıf silinemedi."),
  });

  const sorted = [...classrooms].sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));

  return (
    <div className="grid cols-2" style={{ marginBottom: 14 }}>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Şube Oluştur</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="field">
            <label>Sınıf Düzeyi</label>
            <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
              {CLASSROOM_GRADE_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {GRADE_LEVEL_LABEL[g]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Şube Adı</label>
            <input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="Örn. C" maxLength={3} />
          </div>
          <div className="field">
            <label>Kapasite (Sınıf Limiti)</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          {createError && <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{createError}</p>}
          <button
            type="button"
            className="btn primary"
            disabled={!suffix.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            <Icon name="check" /> Sınıfı Oluştur
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Sınıflarımız</h3>
          <span className="hint">{classrooms.length} şube</span>
        </div>
        {rowError && <p style={{ margin: "0 0 8px", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{rowError}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
          {sorted.length === 0 && <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz şube oluşturulmadı.</p>}
          {sorted.map((c) => {
            const pct = Math.round((c.studentCount / (c.capacity || 1)) * 100);
            if (deletingId === c.id) {
              return (
                <div key={c.id} style={{ border: "1px solid var(--critical)", borderRadius: 9, padding: "10px 12px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>
                  <b>{c.name}</b> silinsin mi?
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button type="button" className="btn xs danger" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}>
                      Evet, Sil
                    </button>
                    <button type="button" className="btn xs" onClick={() => setDeletingId(null)}>
                      Vazgeç
                    </button>
                  </div>
                </div>
              );
            }
            if (editingId === c.id) {
              return (
                <div key={c.id} style={{ border: "1px solid var(--border-strong)", borderRadius: 9, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: "var(--text-xs)" }}>{c.name.split("-")[0]}-</span>
                  <input value={editSuffix} onChange={(e) => setEditSuffix(e.target.value)} maxLength={3} style={{ width: 56 }} />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Limit</span>
                  <input type="number" min={1} value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)} style={{ width: 70 }} />
                  <button type="button" className="btn xs primary" onClick={() => updateMutation.mutate(c.id)} disabled={updateMutation.isPending}>
                    Kaydet
                  </button>
                  <button type="button" className="btn xs" onClick={() => setEditingId(null)}>
                    Vazgeç
                  </button>
                  <p style={{ width: "100%", margin: "2px 0 0", fontSize: 11, color: "var(--ink-faint)" }}>
                    Şube adı değiştirilirse bu sınıftaki öğrencilerin kaydı otomatik olarak yeni koda taşınır.
                  </p>
                </div>
              );
            }
            return (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: "var(--text-sm)" }}>
                    <b>{c.name}</b> <span style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>· {GRADE_LEVEL_LABEL[c.gradeLevel] ?? c.gradeLevel}</span>
                  </span>
                  <span className={`chip ${pct >= 100 ? "critical" : pct >= 80 ? "weak" : "strong"}`}>
                    {c.studentCount}/{c.capacity}
                  </span>
                </div>
                <div className="progress-track" style={{ marginBottom: 8 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: pct >= 100 ? "var(--critical)" : pct >= 80 ? "var(--weak)" : "var(--strong)",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn xs"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditSuffix(c.name.split("-").slice(1).join("-"));
                      setEditCapacity(String(c.capacity));
                      setDeletingId(null);
                      setRowError(null);
                    }}
                  >
                    Düzenle
                  </button>
                  <button
                    type="button"
                    className="btn xs"
                    disabled={c.studentCount > 0}
                    title={c.studentCount > 0 ? "Sınıfta öğrenci varken silinemez" : undefined}
                    onClick={() => {
                      setDeletingId(c.id);
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
      </div>
    </div>
  );
}
