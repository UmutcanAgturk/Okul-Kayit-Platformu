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
      <div className="card card-pad" style={{ textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          {error instanceof Error ? error.message : "Sınıf röntgeni yüklenemedi."}
        </p>
        <button type="button" onClick={() => refetch()} className="btn danger sm" style={{ marginTop: 12 }}>
          Tekrar Dene
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>AI Sınıf Röntgeni</h1>
      <p className="lede">
        {data.examName} · {data.classroomName} · Güncelleme:{" "}
        {new Date(data.generatedAt).toLocaleString("tr-TR")}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ClassSummaryStats summary={data.classSummary} />

        <div>
          <div className="card-head">
            <h3>Ortak Eksik Kazanım Matrisi</h3>
            <HeatmapLegend />
          </div>

          <AchievementHeatmapGrid
            achievementColumns={data.achievementColumns}
            students={data.students}
            onCellSelect={handleCellSelect}
          />
        </div>
      </div>

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
    <div className="screen">
      <div style={{ height: 24, width: 260, borderRadius: "var(--radius-sm)", background: "var(--surface-3)" }} />
      <div className="grid cols-3" style={{ marginTop: 20 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card" style={{ height: 80, background: "var(--surface-3)" }} />
        ))}
      </div>
      <div className="card" style={{ marginTop: 14, height: 288, background: "var(--surface-3)" }} />
    </div>
  );
}
