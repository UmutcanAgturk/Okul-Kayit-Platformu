"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
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
const STATUS_TONE: Record<string, string> = {
  BEKLIYOR: "text-amber-600 dark:text-amber-400",
  ONAYLANDI: "text-emerald-600 dark:text-emerald-400",
  REDDEDILDI: "text-red-600 dark:text-red-400",
  TAMAMLANDI: "text-slate-500 dark:text-slate-400",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function TopBar({ title, firstName, lastName, onLogout }: { title: string; firstName: string; lastName: string; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {firstName} {lastName}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <a href="/dashboard" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Ana Sayfa
        </a>
        <button type="button" onClick={onLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

function StudentOrParentMentorView({
  me,
  onLogout,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
  onLogout: () => void;
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Öğrenci kaydı bulunamadı.
      </div>
    );
  }

  const mentor = mentorQuery.data?.mentor ?? null;
  const quota = mentorQuery.data?.quota ?? null;
  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="space-y-6">
      <TopBar title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      {students.length > 1 && (
        <div className="flex gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition " +
                (selectedStudentId === s.studentId
                  ? "border-[#0071ce] bg-[#0071ce] text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
              }
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {mentorQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {!mentorQuery.isLoading && !mentor && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Şubenizde henüz mentör öğretmen atanmamış — Şube Yöneticisi bir öğretmeni mentör olarak işaretlediğinde
          otomatik olarak size atanacaktır.
        </div>
      )}

      {mentor && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Mentörünüz: {mentor.name}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{mentor.branch}</p>
            {quota && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Bu ay: {quota.used}/{quota.limit} randevu kullanıldı
              </p>
            )}
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Tarih</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Saat</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Not (opsiyonel)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Örn. Sınav kaygısı hakkında konuşmak istiyorum"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}
              <button
                type="submit"
                disabled={createMutation.isPending || (quota ? quota.used >= quota.limit : false)}
                className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
              >
                {createMutation.isPending ? "Gönderiliyor…" : "Randevu Talep Et"}
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Randevu Geçmişi</h2>
            {requestsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
            {!requestsQuery.isLoading && requests.length === 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz randevunuz yok.</p>
            )}
            <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
              {requests.map((r) => (
                <div key={r.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-slate-50">{formatDateTime(r.requestedAt)}</span>
                    <span className={`font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                  {r.note && <div className="text-xs text-slate-500 dark:text-slate-400">{r.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherMentorView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
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
    <div className="space-y-6">
      <TopBar title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      {!requestsQuery.isLoading && requests.length === 0 && (
        <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Henüz size atanmış bir mentör randevu talebi yok. (Mentör havuzunda değilseniz Şube Yöneticisi sizi
          Personel ekranından ekleyebilir.)
        </div>
      )}

      {requests.length > 0 && (
        <>
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Bekleyen Talepler ({pending.length})</h2>
            {pending.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bekleyen talep yok.</p>}
            <div className="mt-3 space-y-2">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(r.requestedAt)}
                      {r.note && ` · ${r.note}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ id: r.id, decision: "APPROVE" })}
                      className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      Onayla
                    </button>
                    <button
                      type="button"
                      onClick={() => respondMutation.mutate({ id: r.id, decision: "REJECT" })}
                      className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Onaylanmış ({approved.length})</h2>
            {approved.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Onaylanmış randevu yok.</p>}
            <div className="mt-3 space-y-2">
              {approved.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(r.requestedAt)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => respondMutation.mutate({ id: r.id, decision: "COMPLETE" })}
                    className="rounded-lg bg-slate-600 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Tamamlandı Olarak İşaretle
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Geçmiş</h2>
            {past.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz geçmiş kayıt yok.</p>}
            <div className="mt-3 space-y-2">
              {past.map((r) => (
                <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(r.requestedAt)}</div>
                  </div>
                  <span className={`font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function BranchMentorView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
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
    <div className="space-y-6">
      <TopBar title="Seviye Mentör" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Mentör Havuzu</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Mentör olarak işaretlenen öğretmenler, öğrencilere round-robin (en az mentisi olana) otomatik atanır.
        </p>
        <div className="mt-3 space-y-2">
          {teachers.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div>
                <span className="font-medium text-slate-900 dark:text-slate-50">{t.name}</span>
                <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{t.branch}</span>
              </div>
              <button
                type="button"
                onClick={() => toggleMutation.mutate(t.id)}
                className={
                  "rounded-lg px-3 py-1 text-xs font-semibold " +
                  (t.isMentor ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
                }
              >
                {t.isMentor ? "Mentör ✓" : "Mentör Yap"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Randevu Talepleri ({requests.length})</h2>
        {requestsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!requestsQuery.isLoading && requests.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz talep yok.</p>
        )}
        <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-50">
                  {r.studentName} <span className="font-normal text-slate-500 dark:text-slate-400">→ {r.mentorName}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(r.requestedAt)}</div>
              </div>
              <span className={`font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentOrParentMentorView me={me} onLogout={handleLogout} />;
  if (me.role === "TEACHER") return <TeacherMentorView me={me} onLogout={handleLogout} />;
  if (me.role === "BRANCH_ADMIN") return <BranchMentorView me={me} onLogout={handleLogout} />;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        Bu modüle erişim yetkiniz yok. Seviye Mentör yalnızca Öğrenci/Veli/Öğretmen/Şube Yöneticisi rolüne açıktır.
      </p>
    </div>
  );
}
