"use client";

// Shadcn primitifleri: `npx shadcn-ui@latest add sheet badge` ile üretilir.
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { AchievementCell, AchievementColumn, StudentRow } from "@/types/xray";

const MASTERY_LABEL: Record<AchievementCell["masteryLevel"], string> = {
  CRITICAL: "Kritik Eksik",
  WEAK: "Geliştirilmeli",
  STRONG: "Kazanılmış",
};

const MASTERY_VARIANT: Record<AchievementCell["masteryLevel"], "destructive" | "warning" | "success"> = {
  CRITICAL: "destructive",
  WEAK: "warning",
  STRONG: "success",
};

interface StudentDetailDrawerProps {
  student: StudentRow | null;
  cell: AchievementCell | null;
  achievement: AchievementColumn | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssignStudySession: (student: StudentRow, achievement: AchievementColumn) => void;
}

export function StudentDetailDrawer({
  student,
  cell,
  achievement,
  open,
  onOpenChange,
  onAssignStudySession,
}: StudentDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {student && cell && achievement && (
          <>
            <SheetHeader>
              <SheetTitle>{student.fullName}</SheetTitle>
              <SheetDescription>{achievement.subject} · {achievement.label}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm text-muted-foreground">Doğru Oranı</p>
                  <p className="text-2xl font-semibold text-foreground">
                    %{Math.round(cell.correctRatio * 100)}
                  </p>
                </div>
                <Badge variant={MASTERY_VARIANT[cell.masteryLevel]}>
                  {MASTERY_LABEL[cell.masteryLevel]}
                </Badge>
              </div>

              <p className="text-sm text-muted-foreground">
                Bu kazanım için {cell.questionCount} soru sorulmuştur. Kritik eksik tespit edilen
                öğrenciler için tek tıkla VIP Etüt talebi oluşturabilirsiniz; Seviye 360 AI Otomatik
                Etüt Atama servisi öğretmenin uygun saatini bularak rezervasyonu tamamlar.
              </p>

              {cell.masteryLevel !== "STRONG" && (
                <button
                  type="button"
                  onClick={() => onAssignStudySession(student, achievement)}
                  className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                  VIP Etüt Talebi Oluştur
                </button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
