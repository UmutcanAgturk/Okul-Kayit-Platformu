"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createMentorRequest,
  fetchBranchMentorRequests,
  fetchBranchTeachers,
  fetchStudentMentor,
  fetchStudentMentorRequests,
  fetchTeacherMentorRequests,
  mentorKeys,
  respondToMentorRequest,
  toggleTeacherMentor,
} from "@/lib/api/mentor";

const STATUS_LABEL: Record<string, string> = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi", TAMAMLANDI: "Tamamlandı" };
const STATUS_CHIP: Record<string, string> = {
  BEKLIYOR: "weak",
  ONAYLANDI: "strong",
  REDDEDILDI: "critical",
  TAMAMLANDI: "neutral",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function ScreenHeader({ title, firstName, lastName }: { title: string; firstName: string; lastName: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="lede">
        {firstName} {lastName}
      </p>
    </>
  );
}

function StudentOrParentMentorView({
  me,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
}) {
  const queryClient = useQueryClient();
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("16:00");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mentorQuery = useQuery({
    queryKey: mentorKeys.studentMentor(selectedStudentId ?? ""),
    queryFn: () => fetchStudentMentor(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const requestsQuery = useQuery({
    queryKey: mentorKeys.studentRequests(selectedStudentId ?? ""),
    queryFn: () => fetchStudentMentorRequests(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const createMutation = useMutation({
    mutationFn: () => createMentorRequest(selectedStudentId!, { requestedAt: new Date(`${date}T${time}`).toISOString(), note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mentorKeys.studentRequests(selectedStudentId ?? "") });
      queryClient.invalidateQueries({ queryKey: mentorKeys.studentMentor(selectedStudentId ?? "") });
      setNote("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Talep gönderilemedi."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setFormError("Tarih seçmelisiniz.");
      return;
    }
    createMutation.mutate();
  }

  if (students.length === 0) {
    return (
      <div className="screen">
        <ScreenHeader title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} />
        <div className="card card-pad" style={{ borderColor: "var(--weak)", background: "var(--weak-bg)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--weak)" }}>Öğrenci kaydı bulunamadı.</p>
        </div>
      </div>
    );
  }

  const mentor = mentorQuery.data?.mentor ?? null;
  const quota = mentorQuery.data?.quota ?? null;
  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="screen">
      <ScreenHeader title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} />

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(s.studentId)} className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}>
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {mentorQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {!mentorQuery.isLoading && !mentor && (
        <div className="card card-pad" style={{ borderColor: "var(--weak)", background: "var(--weak-bg)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--weak)" }}>
            Şubenizde henüz mentör öğretmen atanmamış — Şube Yöneticisi bir öğretmeni mentör olarak işaretlediğinde
            otomatik olarak size atanacaktır.
          </p>
        </div>
      )}

      {mentor && (
        <div className="grid cols-2">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Mentörünüz: {mentor.name}</h3>
            </div>
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{mentor.branch}</p>
            {quota && (
              <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                Bu ay: {quota.used}/{quota.limit} randevu kullanıldı
              </p>
            )}
            <form onSubmit={handleSubmit} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Tarih</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Saat</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Not (opsiyonel)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Örn. Sınav kaygısı hakkında konuşmak istiyorum" />
              </div>
              {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
              <button
                type="submit"
                disabled={createMutation.isPending || (quota ? quota.used >= quota.limit : false)}
                className="btn primary"
                style={{ width: "100%", justifyContent: "center" }}
              >
                {createMutation.isPending ? "Gönderiliyor…" : "Randevu Talep Et"}
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Randevu Geçmişi</h3>
            </div>
            {requestsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
            {!requestsQuery.isLoading && requests.length === 0 && (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz randevunuz yok.</p>
            )}
            <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
              {requests.map((r) => (
                <div key={r.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{formatDateTime(r.requestedAt)}</span>
                    <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  {r.note && <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{r.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherMentorView({ me }: { me: { firstName: string; lastName: string } }) {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: mentorKeys.teacherRequests(), queryFn: fetchTeacherMentorRequests });
  const requests = requestsQuery.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "BEKLIYOR");
  const approved = requests.filter((r) => r.status === "ONAYLANDI");
  const past = requests.filter((r) => r.status === "REDDEDILDI" || r.status === "TAMAMLANDI");

  const respondMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVE" | "REJECT" | "COMPLETE" }) => respondToMentorRequest(id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mentorKeys.teacherRequests() }),
  });

  return (
    <div className="screen">
      <ScreenHeader title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} />

      {!requestsQuery.isLoading && requests.length === 0 && (
        <div className="card card-pad">
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            Henüz size atanmış bir mentör randevu talebi yok. (Mentör havuzunda değilseniz Şube Yöneticisi sizi
            Personel ekranından ekleyebilir.)
          </p>
        </div>
      )}

      {requests.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Bekleyen Talepler ({pending.length})</h3>
            </div>
            {pending.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Bekleyen talep yok.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {pending.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                  <div>
                    <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {formatDateTime(r.requestedAt)}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" onClick={() => respondMutation.mutate({ id: r.id, decision: "APPROVE" })} className="btn success solid xs">
                      Onayla
                    </button>
                    <button type="button" onClick={() => respondMutation.mutate({ id: r.id, decision: "REJECT" })} className="btn danger solid xs">
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Onaylanmış ({approved.length})</h3>
            </div>
            {approved.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Onaylanmış randevu yok.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {approved.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                  <div>
                    <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(r.requestedAt)}</div>
                  </div>
                  <button type="button" onClick={() => respondMutation.mutate({ id: r.id, decision: "COMPLETE" })} className="btn xs">
                    Tamamlandı Olarak İşaretle
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Geçmiş</h3>
            </div>
            {past.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz geçmiş kayıt yok.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {past.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                  <div>
                    <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(r.requestedAt)}</div>
                  </div>
                  <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchMentorView({ me }: { me: { firstName: string; lastName: string } }) {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: mentorKeys.branchRequests(), queryFn: fetchBranchMentorRequests });
  const teachersQuery = useQuery({ queryKey: mentorKeys.branchTeachers(), queryFn: fetchBranchTeachers });
  const requests = requestsQuery.data?.requests ?? [];
  const teachers = teachersQuery.data?.teachers ?? [];

  const toggleMutation = useMutation({
    mutationFn: (teacherId: string) => toggleTeacherMentor(teacherId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mentorKeys.branchTeachers() }),
  });

  return (
    <div className="screen">
      <ScreenHeader title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Mentör Havuzu</h3>
          </div>
          <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
            Mentör olarak işaretlenen öğretmenler, öğrencilere round-robin (en az mentisi olana) otomatik atanır.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {teachers.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                <div>
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{t.name}</span>
                  <span style={{ marginLeft: 8, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{t.branch}</span>
                </div>
                <button type="button" onClick={() => toggleMutation.mutate(t.id)} className={`btn xs ${t.isMentor ? "success solid" : ""}`}>
                  {t.isMentor ? "Mentör ✓" : "Mentör Yap"}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Randevu Talepleri ({requests.length})</h3>
          </div>
          {requestsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!requestsQuery.isLoading && requests.length === 0 && (
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz talep yok.</p>
          )}
          <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {requests.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                    {r.studentName} <span style={{ fontWeight: 500, color: "var(--ink-faint)" }}>→ {r.mentorName}</span>
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(r.requestedAt)}</div>
                </div>
                <span className={`chip ${STATUS_CHIP[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Seviye Mentör (Online Mentörlük) — demo/seviye360-app.html'deki
 * "branch:mentor"/"teacher:mentor"/"student:mentor" ekranlarının gerçek
 * karşılığı. Mentör ataması demo'daki round-robin mantığıyla birebir
 * (StudentProfile.mentorTeacherId, bkz. app/api/students/[studentId]/mentor),
 * aylık randevu kotası sınıf düzeyine göre değişir (bkz. MentorRequest
 * route'larındaki mentorMonthlyQuota).
 */
export function MentorDashboard() {
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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentOrParentMentorView me={me} />;
  if (me.role === "TEACHER") return <TeacherMentorView me={me} />;
  if (me.role === "BRANCH_ADMIN") return <BranchMentorView me={me} />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok. Seviye Mentör yalnızca Öğrenci/Veli/Öğretmen/Şube Yöneticisi rolüne açıktır.
      </p>
    </div>
  );
}
