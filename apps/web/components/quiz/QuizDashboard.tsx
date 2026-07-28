"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createQuizAttempt, fetchAchievements, fetchQuizAttempts, quizKeys } from "@/lib/api/quiz";

const OPTIONS = ["A", "B", "C", "D", "E"];
const QUESTION_COUNT = 5;

function randomOption() {
  return OPTIONS[Math.floor(Math.random() * OPTIONS.length)];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR");
}

/**
 * Quiz / Pratik Modülü — demo/seviye360-app.html'deki "student:quiz"
 * ekranının gerçek karşılığı. Demo'nun kendisinde de sorular GERÇEK değildir
 * (her soru için rastgele bir doğru şık üretilir, gerçek bir soru bankası
 * yoktur) — bu simülasyon burada da AYNEN korunur (istemci tarafında,
 * `startQuizSession`/`answerQuizQuestion` demo fonksiyonlarıyla birebir
 * aynı mantık); yalnızca NİHAİ SONUÇ (ders/kazanım, doğru/toplam) gerçek
 * bir Postgres tablosuna (`QuizAttempt`) kaydedilir.
 */
export function QuizDashboard() {
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

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const achievementsQuery = useQuery({ queryKey: quizKeys.achievements(), queryFn: fetchAchievements, enabled: !!me });
  const achievements = achievementsQuery.data?.achievements ?? [];
  const subjects = useMemo(() => Array.from(new Set(achievements.map((a) => a.subject))), [achievements]);

  const attemptsQuery = useQuery({
    queryKey: quizKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchQuizAttempts(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const [subject, setSubject] = useState("");
  const [achievementId, setAchievementId] = useState("");
  useEffect(() => {
    if (!subject && subjects.length > 0) setSubject(subjects[0]);
  }, [subjects, subject]);

  type Session = { correctAnswers: string[]; currentIndex: number; correctCount: number } | null;
  const [session, setSession] = useState<Session>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      createQuizAttempt(selectedStudentId!, {
        subject,
        achievementId: achievementId || undefined,
        correctCount: session!.correctCount,
        totalCount: QUESTION_COUNT,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.byStudent(selectedStudentId ?? "") });
      setSession(null);
    },
  });

  function startSession() {
    setSession({
      correctAnswers: Array.from({ length: QUESTION_COUNT }, () => randomOption()),
      currentIndex: 0,
      correctCount: 0,
    });
  }

  function answer(selected: string) {
    if (!session) return;
    const isCorrect = selected === session.correctAnswers[session.currentIndex];
    setSession({
      ...session,
      currentIndex: session.currentIndex + 1,
      correctCount: session.correctCount + (isCorrect ? 1 : 0),
    });
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "STUDENT" && me.role !== "PARENT") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Pratik Quiz yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Öğrenci kaydı bulunamadı.
      </div>
    );
  }

  const attempts = attemptsQuery.data?.attempts ?? [];
  const achievementOptions = achievements.filter((a) => a.subject === subject);
  const isFinished = session && session.currentIndex >= QUESTION_COUNT;
  const isAsking = session && session.currentIndex < QUESTION_COUNT;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Pratik Quiz</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
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
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

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

      {isAsking && (
        <div className="rounded-xl border border-slate-200 p-4 max-w-lg dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {subject} · Soru {session!.currentIndex + 1}/{QUESTION_COUNT}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-50">
            Soru {session!.currentIndex + 1}: {achievementOptions.find((a) => a.id === achievementId)?.label ?? subject} ile ilgili bir soru.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => answer(opt)}
                className="min-w-[52px] rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFinished && (
        <div className="max-w-sm rounded-xl border border-slate-200 p-8 text-center dark:border-slate-800">
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-50">
            {session!.correctCount}/{QUESTION_COUNT}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Doğru cevap</p>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="mt-4 w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {saveMutation.isPending ? "Kaydediliyor…" : "Bitir ve Kaydet"}
          </button>
        </div>
      )}

      {!session && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Pratik Başlat</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Resmi sınavlar dışında hızlı pratik yapın.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Ders</label>
                <select
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setAchievementId("");
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kazanım (opsiyonel)</label>
                <select
                  value={achievementId}
                  onChange={(e) => setAchievementId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Genel ({subject})</option>
                  {achievementOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={startSession}
                disabled={!subject}
                className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
              >
                Pratiğe Başla ({QUESTION_COUNT} Soru)
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Geçmiş Denemelerim</h2>
            {attemptsQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
            {!attemptsQuery.isLoading && attempts.length === 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz deneme yok.</p>
            )}
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
              {attempts.map((a) => (
                <div key={a.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">
                      {a.subject}
                      {a.achievementLabel && ` · ${a.achievementLabel}`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(a.createdAt)}</div>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-slate-50">
                    {a.correctCount}/{a.totalCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
