"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createQuizAttempt, fetchAchievements, fetchQuizAttempts, quizKeys } from "@/lib/api/quiz";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import { useHqStudentRoster } from "@/lib/hq-student-roster";

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

  const isHq = me?.role === "SUPERADMIN";
  const hqRoster = useHqStudentRoster(isHq && !!me?.actingTenantId);
  const students = isHq ? hqRoster : (me?.students ?? []);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (isHq) setSelectedStudentId(null);
  }, [isHq, me?.actingTenantId]);
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
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "STUDENT" && me.role !== "PARENT" && !isHq) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Pratik Quiz yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--weak)" }}>
          Öğrenci kaydı bulunamadı.
        </p>
      </div>
    );
  }

  const attempts = attemptsQuery.data?.attempts ?? [];
  const achievementOptions = achievements.filter((a) => a.subject === subject);
  const isFinished = session && session.currentIndex >= QUESTION_COUNT;
  const isAsking = session && session.currentIndex < QUESTION_COUNT;

  return (
    <div className="screen">
      <h1>Pratik Quiz</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className="btn sm"
              style={selectedStudentId === s.studentId ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : undefined}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {isAsking && (
        <div className="card card-pad" style={{ maxWidth: 480, marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            {subject} · Soru {session!.currentIndex + 1}/{QUESTION_COUNT}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-base)", fontWeight: 700 }}>
            Soru {session!.currentIndex + 1}: {achievementOptions.find((a) => a.id === achievementId)?.label ?? subject} ile ilgili bir soru.
          </p>
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {OPTIONS.map((opt) => (
              <button key={opt} type="button" onClick={() => answer(opt)} className="btn" style={{ minWidth: 52, justifyContent: "center" }}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFinished && (
        <div className="card card-pad" style={{ maxWidth: 360, textAlign: "center", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: "var(--text-3xl)", fontWeight: 800 }}>
            {session!.correctCount}/{QUESTION_COUNT}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Doğru cevap</p>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="btn primary"
            style={{ marginTop: 16, width: "100%", justifyContent: "center" }}
          >
            {saveMutation.isPending ? "Kaydediliyor…" : "Bitir ve Kaydet"}
          </button>
        </div>
      )}

      {!session && (
        <div className="grid cols-2">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Pratik Başlat</h3>
              <span className="hint">Resmi sınavlar dışında hızlı pratik yapın.</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Ders</label>
                <select
                  value={subject}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setAchievementId("");
                  }}
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Kazanım (opsiyonel)</label>
                <select value={achievementId} onChange={(e) => setAchievementId(e.target.value)}>
                  <option value="">Genel ({subject})</option>
                  {achievementOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" onClick={startSession} disabled={!subject} className="btn primary" style={{ justifyContent: "center" }}>
                Pratiğe Başla ({QUESTION_COUNT} Soru)
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Geçmiş Denemelerim</h3>
            </div>
            {attemptsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
            {!attemptsQuery.isLoading && attempts.length === 0 && (
              <div className="empty-state">
                <Icon name="chart" />
                <p>Henüz deneme yok.</p>
              </div>
            )}
            <div style={{ maxHeight: 384, overflowY: "auto", display: "flex", flexDirection: "column" }}>
              {attempts.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                  <div>
                    <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                      {a.subject}
                      {a.achievementLabel && ` · ${a.achievementLabel}`}
                    </div>
                    <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDate(a.createdAt)}</div>
                  </div>
                  <span style={{ fontWeight: 700 }}>
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
