"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchLeaderboard, fetchStudentGamification, gamificationKeys } from "@/lib/api/gamification";

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

function medal(i: number) {
  if (i === 0) return "🥇";
  if (i === 1) return "🥈";
  if (i === 2) return "🥉";
  return `${i + 1}.`;
}

function StudentOrParentAchievementsView({
  me,
  onLogout,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
  onLogout: () => void;
}) {
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const query = useQuery({
    queryKey: gamificationKeys.student(selectedStudentId ?? ""),
    queryFn: () => fetchStudentGamification(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (students.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Öğrenci kaydı bulunamadı.
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="space-y-6">
      <TopBar title="Başarı Rozetlerim" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

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

      {query.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Seviye</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.level}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {data.xpIntoLevel} / {data.xpForNextLevel} XP
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Toplam XP</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.xp}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Sınıf Sıralaması</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{data.classRank ? `#${data.classRank}` : "—"}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{data.classSize} kişi arasında</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sonraki Seviyeye İlerleme</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">%{data.progressPct}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-[#0071ce]" style={{ width: `${data.progressPct}%` }} />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Rozetler</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{data.badges.filter((b) => b.earned).length}/{data.badges.length} kazanıldı</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.badges.map((b) => (
                <div key={b.id} className={`rounded-xl border p-3 text-center dark:border-slate-800 ${b.earned ? "border-slate-200" : "border-slate-100 opacity-40 dark:border-slate-900"}`}>
                  <div className="text-2xl">🏆</div>
                  <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-50">{b.label}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function LeaderboardView({ me, onLogout, title }: { me: { firstName: string; lastName: string }; onLogout: () => void; title: string }) {
  const query = useQuery({ queryKey: gamificationKeys.leaderboard(), queryFn: fetchLeaderboard });
  const rows = query.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <TopBar title={title} firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Sıralama</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{rows.length} öğrenci</span>
        </div>
        {query.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!query.isLoading && rows.length === 0 && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Öğrenci bulunamadı.</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                <th className="pb-2">Sıra</th>
                <th className="pb-2">Öğrenci</th>
                <th className="pb-2">Sınıf</th>
                <th className="pb-2">Seviye</th>
                <th className="pb-2 text-right">XP</th>
                <th className="pb-2 text-right">Rozet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.studentId} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 text-base">{medal(i)}</td>
                  <td className="py-1.5 font-medium text-slate-900 dark:text-slate-50">{r.name}</td>
                  <td className="py-1.5">{r.classroom ?? "—"}</td>
                  <td className="py-1.5">
                    <span className="rounded-full bg-[#0071ce]/10 px-2 py-0.5 text-xs font-medium text-[#0071ce]">Seviye {r.level}</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{r.xp} XP</td>
                  <td className="py-1.5 text-right">🏆 {r.badgeCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Gamification (XP/Seviye/Rozet/Lider Tablosu) — demo/seviye360-app.html'deki
 * "branch:leaderboard"/"teacher:leaderboard"/"student:basari" ekranlarının
 * gerçek karşılığı. Yeni bir Prisma modeli EKLEMEZ — XP, gerçek sınav/
 * devamsızlık/etüt/disiplin/kulüp/quiz verisinden hesaplanır (bkz.
 * lib/gamification.ts).
 */
export function GamificationDashboard() {
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

  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentOrParentAchievementsView me={me} onLogout={handleLogout} />;
  if (me.role === "BRANCH_ADMIN") return <LeaderboardView me={me} onLogout={handleLogout} title="Lider Tablosu" />;
  if (me.role === "TEACHER") return <LeaderboardView me={me} onLogout={handleLogout} title="Sınıf Lider Tablosu" />;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        Bu modüle erişim yetkiniz yok. Lider Tablosu/Başarı Rozetleri yalnızca Öğrenci/Veli/Öğretmen/Şube Yöneticisi
        rolüne açıktır.
      </p>
    </div>
  );
}
