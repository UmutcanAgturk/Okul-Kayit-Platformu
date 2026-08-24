"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { courseKeys, createCourse, fetchCourses } from "@/lib/api/courses";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const WRITE_ROLES = ["BRANCH_ADMIN", "SUPERADMIN"];
const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];

function CoursesView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const coursesQuery = useQuery({ queryKey: courseKeys.branchList(), queryFn: fetchCourses });
  const canWrite = WRITE_ROLES.includes(me.role);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [credit, setCredit] = useState("");
  const [weeklyHours, setWeeklyHours] = useState("");
  const [gradeLevels, setGradeLevels] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createCourse({
        code: code.trim(),
        name: name.trim(),
        credit: credit ? Number(credit) : undefined,
        weeklyHours: weeklyHours ? Number(weeklyHours) : undefined,
        mandatory,
        gradeLevels: gradeLevels.split(",").map((g) => g.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.branchList() });
      setCode(""); setName(""); setCredit(""); setWeeklyHours(""); setGradeLevels(""); setMandatory(false); setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kurs oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { setFormError("Kurs kodu ve adı zorunludur."); return; }
    createMutation.mutate();
  }

  const courses = coursesQuery.data?.courses ?? [];

  return (
    <div className="screen">
      <h1>Kurslar</h1>
      <p className="lede">Kredili ders/kurs kataloğu ve sınıf seviyeleri.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {canWrite && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>Yeni Kurs</h3></div>
          <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
            <div className="field"><label>Kurs Kodu</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Örn. IO-2010" /></div>
            <div className="field"><label>Kurs Adı</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Robotik Kodlama" /></div>
            <div className="field"><label>Kredi</label><input type="number" value={credit} onChange={(e) => setCredit(e.target.value)} /></div>
            <div className="field"><label>Haftalık Saat</label><input type="number" value={weeklyHours} onChange={(e) => setWeeklyHours(e.target.value)} /></div>
            <div className="field"><label>Sınıf Seviyeleri (virgülle)</label><input value={gradeLevels} onChange={(e) => setGradeLevels(e.target.value)} placeholder="Örn. 01, 02, 03" /></div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} style={{ width: "auto" }} /> Zorunlu ders
              </label>
            </div>
            {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
            <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
              {createMutation.isPending ? "Oluşturuluyor…" : "Kursu Oluştur"}
            </button>
          </form>
        </div>
      )}

      <div className="card card-pad">
        <div className="card-head"><h3>Kurs Kataloğu</h3><span className="hint">{courses.length} kurs</span></div>
        {coursesQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : courses.length === 0 ? (
          <div className="empty-state"><Icon name="book" /><p>Henüz kurs eklenmedi.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Kod</th><th>Ad</th><th>Kredi</th><th>Haftalık Saat</th><th>Zorunlu</th><th>Seviyeler</th></tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontFamily: "monospace" }}>{c.code}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.credit ?? "—"}</td>
                    <td>{c.weeklyHours ?? "—"}</td>
                    <td>{c.mandatory ? "Evet" : "Hayır"}</td>
                    <td>{c.gradeLevels.length ? c.gradeLevels.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function CoursesDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <CoursesView me={me} />;
}
