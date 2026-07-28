"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTeachers, teacherKeys } from "@/lib/api/teachers";
import {
  createPtaRequest,
  fetchBranchPtaRequests,
  fetchStudentPtaRequests,
  fetchTeacherPtaRequests,
  ptaKeys,
  respondToPtaRequest,
} from "@/lib/api/pta";

const STATUS_LABEL: Record<string, string> = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };
const STATUS_TONE: Record<string, string> = {
  BEKLIYOR: "text-amber-600 dark:text-amber-400",
  ONAYLANDI: "text-emerald-600 dark:text-emerald-400",
  REDDEDILDI: "text-red-600 dark:text-red-400",
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
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Ana Sayfa
        </a>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

function ParentPtaView({ me, onLogout }: { me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] }; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const teachersQuery = useQuery({ queryKey: teacherKeys.list(), queryFn: fetchTeachers });
  const teachers = teachersQuery.data?.teachers ?? [];

  const [teacherId, setTeacherId] = useState("");
  useEffect(() => {
    if (teachers.length > 0 && !teacherId) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("15:00");
  const [topic, setTopic] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ptaKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchStudentPtaRequests(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const createMutation = useMutation({
    mutationFn: () => createPtaRequest(selectedStudentId!, { teacherId, requestedAt: new Date(`${date}T${time}`).toISOString(), topic: topic.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptaKeys.byStudent(selectedStudentId ?? "") });
      setTopic("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Talep gönderilemedi."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId || !teacherId || !date) {
      setFormError("Öğretmen ve tarih seçmelisiniz.");
      return;
    }
    createMutation.mutate();
  }

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Velisi olduğunuz bir öğrenci bulunamadı.
      </div>
    );
  }

  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="space-y-6">
      <TopBar title="Veli-Öğretmen Görüşmesi" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Randevu Talebi</h2>
          <form onSubmit={handleSubmit} className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Öğretmen</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.branch})
                  </option>
                ))}
              </select>
            </div>
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Görüşme Konusu (opsiyonel)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Örn. Sınav performansı hakkında görüşmek istiyorum"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={createMutation.isPending || teachers.length === 0}
              className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
            >
              {createMutation.isPending ? "Gönderiliyor…" : "Talep Gönder"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Taleplerim</h2>
          {requestsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {!requestsQuery.isLoading && requests.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz talebiniz yok.</p>
          )}
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {requests.map((r) => (
              <div key={r.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900 dark:text-slate-50">{r.teacherName}</span>
                  <span className={`font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherPtaView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ptaKeys.teacherInbox(), queryFn: fetchTeacherPtaRequests });
  const requests = requestsQuery.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "BEKLIYOR");
  const decided = requests.filter((r) => r.status !== "BEKLIYOR");

  const respondMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVE" | "REJECT" }) => respondToPtaRequest(id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ptaKeys.teacherInbox() }),
  });

  return (
    <div className="space-y-6">
      <TopBar title="Veli Görüşmeleri" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Bekleyen Talepler ({pending.length})</h2>
        {requestsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!requestsQuery.isLoading && pending.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Bekleyen talep yok.</p>
        )}
        <div className="mt-3 space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-50">{r.studentName}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
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
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Geçmiş</h2>
        {decided.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz geçmiş kayıt yok.</p>}
        <div className="mt-3 space-y-2">
          {decided.map((r) => (
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
    </div>
  );
}

function BranchPtaView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
  const requestsQuery = useQuery({ queryKey: ptaKeys.branchAll(), queryFn: fetchBranchPtaRequests });
  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="space-y-6">
      <TopBar title="Veli Görüşmeleri" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Talepler ({requests.length})</h2>
        {requestsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!requestsQuery.isLoading && requests.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz talep yok.</p>
        )}
        <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-50">
                  {r.studentName} <span className="font-normal text-slate-500 dark:text-slate-400">→ {r.teacherName}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
                </div>
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
 * Veli-Öğretmen Görüşme Randevusu — demo'daki "student:veligorusme"
 * (guardianOnly), "teacher:veligorusme", "branch:veligorusme" ekranlarının
 * gerçek karşılığı. `PtaMeetingRequest` yalnızca düz `tenant_isolation`
 * taşır (bkz. prisma/schema.prisma) — Devamsızlık/Disiplin ile aynı desen.
 * Üç farklı rol üç farklı görünüm alır: PARENT talep oluşturur, TEACHER
 * onaylar/reddeder, BRANCH_ADMIN/GUIDANCE_COORDINATOR tüm kurumu izler.
 */
export function PtaDashboard() {
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

  if (me.role === "PARENT") return <ParentPtaView me={me} onLogout={handleLogout} />;
  if (me.role === "TEACHER") return <TeacherPtaView me={me} onLogout={handleLogout} />;
  if (me.role === "BRANCH_ADMIN" || me.role === "GUIDANCE_COORDINATOR") return <BranchPtaView me={me} onLogout={handleLogout} />;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        Bu modüle erişim yetkiniz yok. Veli-Öğretmen Görüşmesi yalnızca Veli/Öğretmen/Şube Yöneticisi/Rehber Öğretmen
        rolüne açıktır.
      </p>
    </div>
  );
}
