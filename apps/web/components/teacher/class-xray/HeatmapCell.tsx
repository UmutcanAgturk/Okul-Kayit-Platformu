"use client";

import { cn } from "@/lib/utils";
import type { AchievementCell } from "@/types/xray";

const MASTERY_STYLES: Record<AchievementCell["masteryLevel"], string> = {
  CRITICAL: "bg-red-500/90 hover:bg-red-500 text-white",
  WEAK: "bg-amber-400/90 hover:bg-amber-400 text-amber-950",
  STRONG: "bg-emerald-500/90 hover:bg-emerald-500 text-white",
};

interface HeatmapCellProps {
  cell: AchievementCell;
  onSelect: (cell: AchievementCell) => void;
}

export function HeatmapCell({ cell, onSelect }: HeatmapCellProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(cell)}
      title={`${Math.round(cell.correctRatio * 100)}% doğru (${cell.questionCount} soru)`}
      className={cn(
        "aspect-square w-full min-w-9 rounded-md text-xs font-medium",
        "transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "focus-visible:ring-slate-900 dark:focus-visible:ring-slate-100",
        "active:scale-95",
        MASTERY_STYLES[cell.masteryLevel],
      )}
    >
      {Math.round(cell.correctRatio * 100)}
    </button>
  );
}
