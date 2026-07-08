import { cn } from "@/lib/utils";
import type { MasteryLevel } from "@/types/xray";

const LEGEND_ITEMS: { level: MasteryLevel; label: string; swatchClass: string }[] = [
  { level: "CRITICAL", label: "Kritik Eksik (< %40)", swatchClass: "bg-red-500" },
  { level: "WEAK", label: "Geliştirilmeli (%40 - %70)", swatchClass: "bg-amber-400" },
  { level: "STRONG", label: "Kazanılmış (> %70)", swatchClass: "bg-emerald-500" },
];

export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.level} className="flex items-center gap-2">
          <span className={cn("h-3 w-3 rounded-sm", item.swatchClass)} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
