"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchReportCard, reportCardKeys } from "@/lib/api/report-card";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

function tl(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Karne — demo/seviye360-app.html'deki buildKarneHtml()'in gerçek karşılığı.
 * STUDENT'ın bu depodaki İLK gerçek modülüdür. Yeni bir veri modeli EKLEMEZ —
 * Ölçme-Değerlendirme (ExamResult/StudentAchievementResult) ve Devamsızlık
 * (AttendanceRecord) modüllerinin gerçek verisini tek ekranda birleştirir
 * (bkz. app/api/students/[studentId]/report-card).
 */
export function ReportCardView() {
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

  const reportCardQuery = useQuery({
    queryKey: reportCardKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchReportCard(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Karne yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }
  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        {me.role === "STUDENT" ? "Öğrenci profiliniz bulunamadı." : "Velisi olduğunuz bir öğrenci bulunamadı."}
      </div>
    );
  }

  const card = reportCardQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Karne</h1>
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

      {reportCardQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {card && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Devamsızlık Özeti</h2>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
              <dt>Toplam Kayıtlı Gün</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-50">{card.attendanceSummary.totalDays}</dd>
              <dt>Var</dt>
              <dd className="text-right font-medium text-emerald-600 dark:text-emerald-400">{card.attendanceSummary.presentDays}</dd>
              <dt>Geç</dt>
              <dd className="text-right font-medium text-amber-600 dark:text-amber-400">{card.attendanceSummary.lateDays}</dd>
              <dt>İzinli</dt>
              <dd className="text-right font-medium text-slate-600 dark:text-slate-300">{card.attendanceSummary.excusedDays}</dd>
              <dt>Yok (Devamsız)</dt>
              <dd className="text-right font-medium text-red-600 dark:text-red-400">{card.attendanceSummary.absentDays}</dd>
              <dt>Devamsızlık Oranı</dt>
              <dd className="text-right font-medium text-slate-900 dark:text-slate-50">%{card.attendanceSummary.absenceRatePct}</dd>
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Ders Bazlı Başarı</h2>
            {card.subjectBreakdown.length === 0 && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Henüz sınav sonucu yok.</p>
            )}
            <div className="mt-2 space-y-2">
              {card.subjectBreakdown.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                    <span>{s.subject}</span>
                    <span>%{s.avgMasteryPct}</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-[#0071ce]"
                      style={{ width: `${Math.min(100, Math.max(0, s.avgMasteryPct))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 lg:col-span-2 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sınav Geçmişi</h2>
            {card.examHistory.length === 0 && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Henüz sınava girilmedi.</p>
            )}
            <div className="mt-2 space-y-2">
              {card.examHistory.map((e) => (
                <div key={e.examId} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-50">{e.examName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(e.examDate).toLocaleDateString("tr-TR")} · {e.examType}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 dark:text-slate-50">{tl(e.netScore)} net</div>
                    {e.percentile !== null && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">%{Math.round(e.percentile)} yüzdelik</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
