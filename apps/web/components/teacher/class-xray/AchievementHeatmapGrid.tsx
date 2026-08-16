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
    <div className="table-wrap" style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th
              className="sticky left-0 z-10 min-w-[180px] p-3 text-sm font-semibold"
              style={{ background: "var(--surface)", color: "var(--ink)" }}
            >
              Öğrenci
            </th>
            {achievementColumns.map((achievement) => (
              <th
                key={achievement.achievementId}
                className="min-w-16 whitespace-nowrap p-2 align-bottom"
              >
                <div
                  className="origin-bottom-left -rotate-45 text-xs font-medium"
                  style={{ color: "var(--ink-faint)" }}
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
            <tr key={student.studentId} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="sticky left-0 z-10 p-3" style={{ background: "var(--surface)" }}>
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
                    style={{ background: "var(--surface-3)", color: "var(--ink-muted)" }}
                  >
                    {student.fullName
                      .split(" ")
                      .map((p) => p[0])
                      .join("")}
                  </span>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{student.fullName}</p>
                    <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Net: {student.overallNet}</p>
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
