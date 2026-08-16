"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchMyClasses } from "@/lib/api/my-classes";
import { fetchBranchExams } from "@/lib/api/exams";
import { Icon } from "@/components/ui/icons";

/**
 * Sınıflarım — demo/seviye360-app.html'deki "teacher:myclass" ekranının
 * gerçek karşılığı (bkz. app/api/teacher/my-classes).
 */
export function MyClassesView() {
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

  const classesQuery = useQuery({ queryKey: ["my-classes"], queryFn: fetchMyClasses, enabled: !!me });
  const examsQuery = useQuery({ queryKey: ["branch-exams"], queryFn: fetchBranchExams, enabled: !!me });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "TEACHER") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Sınıflarım yalnızca Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const classrooms = classesQuery.data?.classrooms ?? [];

  return (
    <div className="screen">
      <h1>Sınıflarım</h1>
      <p className="lede">Ders programınızda kayıtlı olduğunuz sınıfların öğrenci listesi.</p>

      {classesQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : classrooms.length === 0 ? (
        <div className="card card-pad">
          <div className="empty-state">
            <Icon name="users" />
            <p>Ders programınızda henüz kayıtlı bir sınıf yok — Ders Programı ekranından atanabilirsiniz.</p>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {classrooms.map((c) => (
            <div key={c.classroomId} className="card card-pad">
              <div className="card-head">
                <h3>{c.classroomName}</h3>
                <span className="hint">{c.students.length} öğrenci</span>
              </div>
              <ClassXRayPicker classroomId={c.classroomId} exams={examsQuery.data?.exams ?? []} />
              {c.students.length === 0 ? (
                <div className="empty-state">
                  <Icon name="inbox" />
                  <p>Bu sınıfta henüz öğrenci yok — Öğrenciler ekranında Sınıf Atama ile eklenir.</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>Öğrenci</th>
                        <th>Öğrenci No</th>
                        <th>Net Ort.</th>
                        <th>Veli</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.students.map((s) => (
                        <tr key={s.studentId}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td>{s.studentNo}</td>
                          <td>{s.netAvg ?? "—"}</td>
                          <td style={{ color: "var(--ink-faint)", fontSize: "var(--text-xs)" }}>
                            {s.guardianName ?? "—"}
                            {s.guardianPhone && ` · ${s.guardianPhone}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AI Sınıf Röntgeni'ne giriş noktası — demo denetiminde bulunan gerçek
 * eksiklik: ekran zaten inşa edilmiştir (bkz. app/(teacher)/sinif-rontgeni)
 * ama hiçbir menüden erişilemiyordu. Sınav seçimi öğretmenin kendi sınıfı
 * bağlamında yapılır (bkz. app/api/teacher/exams/[examId]/class-xray — yalnızca
 * TEACHER rolüne açık).
 */
function ClassXRayPicker({ classroomId, exams }: { classroomId: string; exams: { id: string; name: string }[] }) {
  const router = useRouter();
  const [examId, setExamId] = useState("");

  if (exams.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
      <select value={examId} onChange={(e) => setExamId(e.target.value)} style={{ maxWidth: 260 }}>
        <option value="">Sınıf Röntgeni için sınav seçin…</option>
        {exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn xs"
        disabled={!examId}
        onClick={() => router.push(`/sinif-rontgeni/${examId}?classroomId=${classroomId}`)}
      >
        <Icon name="chart" /> Sınıf Röntgeni
      </button>
    </div>
  );
}
