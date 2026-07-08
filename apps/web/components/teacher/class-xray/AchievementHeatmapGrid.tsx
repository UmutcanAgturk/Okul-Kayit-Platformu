"use client";

import { HeatmapCell } from "./HeatmapCell";
import type { AchievementCell, AchievementColumn, StudentRow } from "@/types/xray";

interface AchievementHeatmapGridProps {
  achievementColumns: AchievementColumn[];
  students: StudentRow[];
  onCellSelect: (student: StudentRow, cell: AchievementCell) => void;
}

export function AchievementHeatmapGrid({
  achievementColumns,
  students,
  onCellSelect,
}: AchievementHeatmapGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[180px] bg-background p-3 text-sm font-semibold text-foreground">
              Öğrenci
            </th>
            {achievementColumns.map((achievement) => (
              <th
                key={achievement.achievementId}
                className="min-w-16 whitespace-nowrap p-2 align-bottom"
              >
                <div
                  className="origin-bottom-left -rotate-45 text-xs font-medium text-muted-foreground"
                  title={achievement.label}
                >
                  {achievement.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.studentId} className="border-t border-border">
              <td className="sticky left-0 z-10 bg-background p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    {student.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{student.fullName}</p>
                    <p className="text-xs text-muted-foreground">Net: {student.overallNet}</p>
                  </div>
                </div>
              </td>
              {achievementColumns.map((achievement) => {
                const cell = student.cells.find(
                  (c) => c.achievementId === achievement.achievementId,
                );
                if (!cell) return <td key={achievement.achievementId} className="p-1.5" />;
                return (
                  <td key={achievement.achievementId} className="p-1.5">
                    <HeatmapCell cell={cell} onSelect={() => onCellSelect(student, cell)} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
