"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { examAnalyticsKeys, fetchClassXRay } from "@/lib/api/examAnalytics";
import { HeatmapLegend } from "./HeatmapLegend";
import { AchievementHeatmapGrid } from "./AchievementHeatmapGrid";
import { ClassSummaryStats } from "./ClassSummaryStats";
import { StudentDetailDrawer } from "./StudentDetailDrawer";
import type { AchievementCell, AchievementColumn, StudentRow } from "@/types/xray";

interface ClassXRayHeatmapProps {
  examId: string;
  classroomId: string;
}

interface SelectedCellState {
  student: StudentRow;
  cell: AchievementCell;
}

/**
 * AI Sınıf Röntgeni — sınav sonrası sınıfın kazanım bazlı ısı haritası.
 *
 * Bileşen ağacı:
 * ClassXRayHeatmap
 *  ├─ Header (sınav adı, sınıf adı, yenileme zamanı)
 *  ├─ ClassSummaryStats            (ortalama net, en zayıf/en güçlü kazanım kartları)
 *  ├─ HeatmapLegend                (kritik / geliştirilmeli / kazanılmış renk kodları)
 *  ├─ AchievementHeatmapGrid       (öğrenci x kazanım matrisi)
 *  │   └─ HeatmapCell (n adet)     (tıklanabilir, renk kodlu hücre)
 *  └─ StudentDetailDrawer          (seçilen hücrenin detayı + VIP Etüt talebi CTA'sı)
 */
export function ClassXRayHeatmap({ examId, classroomId }: ClassXRayHeatmapProps) {
  const [selected, setSelected] = useState<SelectedCellState | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: examAnalyticsKeys.classXRay(examId, classroomId),
    queryFn: () => fetchClassXRay(examId, classroomId),
    staleTime: 5 * 60 * 1000,
  });

  const selectedAchievement: AchievementColumn | undefined = useMemo(() => {
    if (!selected || !data) return undefined;
    return data.achievementColumns.find((a) => a.achievementId === selected.cell.achievementId);
  }, [selected, data]);

  function handleCellSelect(student: StudentRow, cell: AchievementCell) {
    setSelected({ student, cell });
    setDrawerOpen(true);
  }

  async function handleAssignStudySession(student: StudentRow, achievement: AchievementColumn) {
    await fetch("/api/teacher/study-sessions/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: student.studentId,
        achievementId: achievement.achievementId,
        examId,
      }),
    });
    setDrawerOpen(false);
  }

  if (isLoading) {
    return <ClassXRaySkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          {error instanceof Error ? error.message : "Sınıf röntgeni yüklenemedi."}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">AI Sınıf Röntgeni</h1>
        <p className="text-sm text-muted-foreground">
          {data.examName} · {data.classroomName} · Güncelleme:{" "}
          {new Date(data.generatedAt).toLocaleString("tr-TR")}
        </p>
      </div>

      <ClassSummaryStats summary={data.classSummary} />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Ortak Eksik Kazanım Matrisi</h2>
        <HeatmapLegend />
      </div>

      <AchievementHeatmapGrid
        achievementColumns={data.achievementColumns}
        students={data.students}
        onCellSelect={handleCellSelect}
      />

      <StudentDetailDrawer
        student={selected?.student ?? null}
        cell={selected?.cell ?? null}
        achievement={selectedAchievement}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAssignStudySession={handleAssignStudySession}
      />
    </div>
  );
}

function ClassXRaySkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 w-64 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}
