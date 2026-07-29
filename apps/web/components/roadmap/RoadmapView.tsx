"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchRoadmap, roadmapKeys } from "@/lib/api/roadmap";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

/**
 * "Seviye 360 Akademik Yol Haritam" — demo/seviye360-app.html'deki
 * SCREENS["student:roadmap"]'in gerçek karşılığı. Karne'nin (bkz.
 * components/report-card/ReportCardView.tsx) çoklu-çocuk seçici desenini
 * birebir tekrarlar.
 */
export function RoadmapView() {
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

  const roadmapQuery = useQuery({
    queryKey: roadmapKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchRoadmap(selectedStudentId!),
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
          Bu modüle erişim yetkiniz yok. Akademik Yol Haritası yalnızca Öğrenci/Veli rolüne açıktır.
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

  const roadmap = roadmapQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Seviye 360 Akademik Yol Haritam</h1>
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

      {roadmapQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {roadmap && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Net Ortalama</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {roadmap.latestNet !== null ? `${Math.round(roadmap.latestNet * 10) / 10} net` : "Henüz sınav verisi yok"}
              </span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-3 rounded-full bg-[#0071ce]" style={{ width: `${roadmap.netPct}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{roadmap.gradeLevel}</span>
              <span>Şu an: {roadmap.latestNet !== null ? `${Math.round(roadmap.latestNet * 10) / 10} Net` : "—"}</span>
              <span>Hedef: {roadmap.maxPossibleNet !== null ? `${roadmap.maxPossibleNet} Net (Tam Puan)` : "—"}</span>
            </div>
            {roadmap.targetGoal && (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                Hedef: <span className="font-medium text-slate-900 dark:text-slate-50">{roadmap.targetGoal}</span>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-[#0071ce]/30 bg-[#0071ce]/5 p-4 dark:border-blue-800 dark:bg-blue-950/30">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">AI Tavsiyesi</h2>
            {roadmap.criticalAchievements.length > 0 ? (
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Şu konulara odaklanırsan netin artacak:{" "}
                {roadmap.criticalAchievements.map((a, i) => (
                  <span key={a.achievementId}>
                    <span className="font-semibold">{a.label}</span>
                    {i < roadmap.criticalAchievements.length - 1 ? ", " : ""}
                  </span>
                ))}
                . Bu konular için Etüt Randevularım bölümünden VIP Etüt talebi oluşturabilirsin.
              </p>
            ) : roadmap.examCount > 0 ? (
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Kritik seviyede zayıf bir kazanım görünmüyor — mevcut performansını korumaya devam et.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                Henüz kazanım analizi yok — ilk optik form işlendiğinde AI tavsiyesi burada belirir.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
