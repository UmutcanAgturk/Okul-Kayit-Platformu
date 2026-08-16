import type { MasteryLevel } from "@/types/xray";

// CurriculumNode'da ayrı bir "subject" alanı yok — MEB kazanım kodu
// (örn. "MAT.9.1.2.3") kuralı gereği ders, kodun ilk parçasından türetilir.
// Hem AI Sınıf Röntgeni (class-xray) hem de Karne (report-card) bu eşlemeyi
// kullanır.
const SUBJECT_LABELS: Record<string, string> = {
  MAT: "Matematik",
  FIZ: "Fizik",
  KIM: "Kimya",
  BIY: "Biyoloji",
  TUR: "Türkçe",
  TAR: "Tarih",
  ING: "İngilizce",
};

export function subjectFromCode(code: string): string {
  const prefix = code.split(".")[0];
  return SUBJECT_LABELS[prefix] ?? prefix;
}

// Kazanım Yükleme'de ders seçici için — prefix + Türkçe etiket çiftleri.
export const SUBJECT_PREFIXES = Object.entries(SUBJECT_LABELS).map(([prefix, label]) => ({ prefix, label }));

// AI Sınıf Röntgeni'nde tanımlanan eşikler — Ölçme-Değerlendirme Durum/Kazanım
// sekmelerindeki ustalık dağılımı (Kritik/Geliştirilmeli/Kazanılmış) hesabı
// da AYNI eşiği kullanır, tutarlılık için buradan paylaşılır.
export function ratioToMastery(ratio: number): MasteryLevel {
  if (ratio < 0.4) return "CRITICAL";
  if (ratio < 0.7) return "WEAK";
  return "STRONG";
}
