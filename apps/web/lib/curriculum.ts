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
