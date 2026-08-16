"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { buildReportCardNarrative, fetchReportCard, reportCardKeys, type ReportCard } from "@/lib/api/report-card";
import { fetchBranchStudents } from "@/lib/api/students-roster";
import { fetchMyClasses } from "@/lib/api/my-classes";
import { Icon } from "@/components/ui/icons";
import { LineChart } from "@/components/ui/charts/LineChart";
import { PrintDocumentViewer } from "@/components/documents/PrintDocumentViewer";
import { KarnePrintBody } from "@/components/documents/DocumentPrintBodies";

const SELF_SERVICE_ROLES = ["STUDENT", "PARENT"];
const STAFF_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];

function tl(n: number) {
  return Math.round(n * 10) / 10;
}

function ReportCardBody({ card, studentNo, classroomLabel }: { card: ReportCard; studentNo?: string; classroomLabel?: string }) {
  const [showPrint, setShowPrint] = useState(false);
  const trend = [...card.examHistory].reverse().map((e) => ({ label: e.examName, value: e.netScore }));
  const presenceRatePct = 100 - card.attendanceSummary.absenceRatePct;
  const narrative = buildReportCardNarrative(card);

  return (
    <div className="grid cols-2">
      <div style={{ gridColumn: "span 2", display: "flex", justifyContent: "flex-end" }}>
        <button type="button" className="btn primary" onClick={() => setShowPrint(true)}>
          Karneyi Görüntüle / Yazdır
        </button>
      </div>

      <div className="grid cols-4" style={{ gridColumn: "span 2" }}>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Genel Ortalama Başarı</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>
            {card.summary.overallAvgMasteryPct === null ? "—" : `%${card.summary.overallAvgMasteryPct}`}
          </div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Devam Oranı</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--strong)" }}>%{presenceRatePct}</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>En Güçlü Ders</div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>{card.summary.strongestSubject ?? "—"}</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Gelişime Açık Ders</div>
          <div style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>{card.summary.weakestSubject ?? "—"}</div>
        </div>
      </div>

      {trend.length >= 2 && (
        <div className="card card-pad" style={{ gridColumn: "span 2" }}>
          <div className="card-head">
            <h3>Net İlerleyişi</h3>
          </div>
          <LineChart points={trend} unit=" net" height={140} />
        </div>
      )}

      <div className="card card-pad">
        <div className="card-head">
          <h3>Devamsızlık Özeti</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6, columnGap: 12, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          <span>Toplam Kayıtlı Gün</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>{card.attendanceSummary.totalDays}</span>
          <span>Var</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--strong)" }}>{card.attendanceSummary.presentDays}</span>
          <span>Geç</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--weak)" }}>{card.attendanceSummary.lateDays}</span>
          <span>İzinli</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink-muted)" }}>{card.attendanceSummary.excusedDays}</span>
          <span>Yok (Devamsız)</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--critical)" }}>{card.attendanceSummary.absentDays}</span>
          <span>Devamsızlık Oranı</span>
          <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>%{card.attendanceSummary.absenceRatePct}</span>
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Ders Bazlı Başarı</h3>
        </div>
        {card.subjectBreakdown.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz sınav sonucu yok.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {card.subjectBreakdown.map((s) => (
            <div key={s.subject}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                <span>{s.subject}</span>
                <span>%{s.avgMasteryPct}</span>
              </div>
              <div className="progress-track" style={{ marginTop: 4, height: 6 }}>
                <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, s.avgMasteryPct))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad" style={{ gridColumn: "span 2" }}>
        <div className="card-head">
          <h3>Sınav Geçmişi</h3>
        </div>
        {card.examHistory.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz sınava girilmedi.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {card.examHistory.map((e) => (
            <div key={e.examId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{e.examName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {new Date(e.examDate).toLocaleDateString("tr-TR")} · {e.examType}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{tl(e.netScore)} net</div>
                {e.percentile !== null && (
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>%{Math.round(e.percentile)} yüzdelik</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {card.disciplineSummary.recordCount > 0 && (
        <div className="card card-pad">
          <div className="card-head">
            <h3>Davranış Notları</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6, columnGap: 12, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            <span>Toplam Kayıt</span>
            <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink)" }}>{card.disciplineSummary.recordCount}</span>
            <span>Olumlu</span>
            <span style={{ textAlign: "right", fontWeight: 600, color: "var(--strong)" }}>{card.disciplineSummary.positiveCount}</span>
            <span>Olumsuz</span>
            <span style={{ textAlign: "right", fontWeight: 600, color: "var(--critical)" }}>{card.disciplineSummary.negativeCount}</span>
            <span>Net Puan</span>
            <span style={{ textAlign: "right", fontWeight: 700, color: "var(--ink)" }}>{card.disciplineSummary.netPoints}</span>
          </div>
        </div>
      )}

      <div className="card card-pad" style={card.disciplineSummary.recordCount > 0 ? undefined : { gridColumn: "span 2" }}>
        <div className="card-head">
          <h3>Öğretmen Değerlendirmesi</h3>
        </div>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{narrative}</p>
      </div>

      {showPrint && (
        <PrintDocumentViewer open onClose={() => setShowPrint(false)} documentNo={card.studentName}>
          <KarnePrintBody report={card} studentNo={studentNo} classroomLabel={classroomLabel} />
        </PrintDocumentViewer>
      )}
    </div>
  );
}

interface StaffRosterRow {
  id: string;
  studentNo: string;
  name: string;
  gradeLevel: string;
  classroomName: string | null;
}

/**
 * Personel (BRANCH_ADMIN/GUIDANCE_COORDINATOR/TEACHER) tarafı — demo'nun
 * "branch:karne"/"teacher:karne" ekranlarının karşılığı. Backend
 * (app/api/students/[studentId]/report-card) STAFF_ROLES'e zaten izin
 * veriyordu ama bu bileşen yalnızca STUDENT/PARENT'ın kendi karnesini
 * gösteriyordu — personel için öğrenci roster/seçici arayüzü eksikti.
 *
 * TEACHER için `/api/branch/students` 403 döner (o uç yalnızca BRANCH_ADMIN/
 * GUIDANCE_COORDINATOR'a açık) — bu yüzden TEACHER, MyClassesView'daki gibi
 * kendi sınıflarına scope edilmiş `/api/teacher/my-classes`'tan roster alır;
 * demo'da da teacher:karne yalnızca `teacherRoster()` (kendi sınıfı) gösterir.
 */
function StaffReportCardView({ me }: { me: { firstName: string; lastName: string; role: string } }) {
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const isTeacher = me.role === "TEACHER";

  const branchStudentsQuery = useQuery({ queryKey: ["branch-students"], queryFn: fetchBranchStudents, enabled: !isTeacher });
  const myClassesQuery = useQuery({ queryKey: ["teacher-my-classes"], queryFn: fetchMyClasses, enabled: isTeacher });
  const reportCardQuery = useQuery({
    queryKey: reportCardKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchReportCard(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const isLoading = isTeacher ? myClassesQuery.isLoading : branchStudentsQuery.isLoading;
  const roster: StaffRosterRow[] = useMemo(() => {
    if (isTeacher) {
      return (myClassesQuery.data?.classrooms ?? []).flatMap((c) =>
        c.students.map((s) => ({ id: s.studentId, studentNo: s.studentNo, name: s.name, gradeLevel: s.gradeLevel, classroomName: c.classroomName })),
      );
    }
    return branchStudentsQuery.data?.students ?? [];
  }, [isTeacher, myClassesQuery.data, branchStudentsQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.studentNo.includes(q));
  }, [roster, search]);

  const selectedStudent = roster.find((s) => s.id === selectedStudentId) ?? null;

  return (
    <div className="screen">
      <h1>Karne</h1>
      <p className="lede">
        {me.firstName} {me.lastName} · Bir öğrenci seçerek karnesini görüntüleyin.
      </p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
          <label>Ara</label>
          <input type="text" placeholder="İsim veya öğrenci no…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Icon name="users" />
            <p>Aramanızla eşleşen öğrenci yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğrenci No</th>
                  <th>Ad Soyad</th>
                  <th>Sınıf Seviyesi</th>
                  <th>Şube</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="row-clickable" onClick={() => setSelectedStudentId(s.id)}>
                    <td>{s.studentNo}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.gradeLevel}</td>
                    <td>{s.classroomName ?? "—"}</td>
                    <td>
                      <button type="button" className="btn xs primary" onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.id); }}>
                        Karneyi Göster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStudent && (
        <>
          <div className="card-head" style={{ marginBottom: 10 }}>
            <h3>{selectedStudent.name} — Karne</h3>
          </div>
          {reportCardQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {reportCardQuery.data && (
            <ReportCardBody card={reportCardQuery.data} studentNo={selectedStudent.studentNo} classroomLabel={selectedStudent.classroomName ?? undefined} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Karne — demo/seviye360-app.html'deki buildKarneHtml()'in gerçek karşılığı.
 * Yeni bir veri modeli EKLEMEZ — Ölçme-Değerlendirme (ExamResult/
 * StudentAchievementResult) ve Devamsızlık (AttendanceRecord) modüllerinin
 * gerçek verisini tek ekranda birleştirir (bkz.
 * app/api/students/[studentId]/report-card). STUDENT/PARENT kendi karnesini
 * görür; BRANCH_ADMIN/GUIDANCE_COORDINATOR/TEACHER bir öğrenci seçip onun
 * karnesini görüntüler (bkz. StaffReportCardView).
 */
export function ReportCardView() {
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

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const reportCardQuery = useQuery({
    queryKey: reportCardKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchReportCard(selectedStudentId!),
    enabled: !!selectedStudentId && !!me && SELF_SERVICE_ROLES.includes(me.role),
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  const isStaff = STAFF_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);
  if (isStaff) {
    return <StaffReportCardView me={me} />;
  }
  if (!SELF_SERVICE_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Karne yalnızca Öğrenci/Veli/Şube Personeli rolüne açıktır.
        </p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="card card-pad" style={{ borderColor: "var(--weak)", background: "var(--weak-bg)" }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--weak)" }}>
          {me.role === "STUDENT" ? "Öğrenci profiliniz bulunamadı." : "Velisi olduğunuz bir öğrenci bulunamadı."}
        </p>
      </div>
    );
  }

  const card = reportCardQuery.data;

  return (
    <div className="screen">
      <h1>Karne</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(s.studentId)} className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}>
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {reportCardQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {card && <ReportCardBody card={card} />}
    </div>
  );
}
