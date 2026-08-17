import { apiFetch } from "./client";
import { GRADE_LEVEL_LABEL } from "./enrollments";

export interface BulkImportRow {
  candidateFullName: string;
  candidateGradeLevel: string;
  // T.C. Kimlik No — giriş artık yalnızca bununla yapılır (bkz. app/api/auth/login).
  nationalId: string;
  guardianFullName: string;
  guardianPhone: string;
  classroomId?: string;
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string;
}

export type BulkImportResultRow =
  | { rowIndex: number; kind: "ok"; candidateFullName: string; studentNo: string; username: string; password: string }
  | { rowIndex: number; kind: "error"; message: string };

export function submitBulkImport(rows: BulkImportRow[]) {
  return apiFetch<{ results: BulkImportResultRow[]; successCount: number; errorCount: number }>(
    "/api/branch/students/bulk-import",
    { method: "POST", body: JSON.stringify({ rows }) },
  );
}

// demo'daki detectStudentXlsxColumns'ın CSV karşılığı — başlık satırından
// sütun indekslerini Türkçe anahtar kelimelerle tanır.
export function detectColumns(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((raw, i) => {
    const s = raw.toLocaleLowerCase("tr-TR").trim();
    if (s.includes("veli") && s.includes("tel")) idx.guardianPhone = i;
    else if (s.includes("veli")) idx.guardianFullName = i;
    else if (s.includes("kimlik") || s.includes("t.c") || s === "tc" || s === "tckn") idx.nationalId = i;
    else if (s.includes("soyad")) idx.soyad = i;
    else if (s === "ad" || s === "adı" || s === "isim" || s === "öğrenci adı") idx.ad = i;
    else if (s.includes("şube") || s.includes("sube")) idx.classroom = i;
    else if (s.includes("sınıf") || s.includes("sinif")) idx.gradeLevel = i;
    else if (s.includes("taksit say") || s.includes("taksit adet")) idx.installmentCount = i;
    else if (s.includes("taksit tutar") || s.includes("ücret") || s.includes("ucret")) idx.installmentAmount = i;
    else if (s.includes("vade") || s.includes("tarih")) idx.firstDueDate = i;
    else if (s.includes("tel")) idx.guardianPhone = idx.guardianPhone ?? i;
  });
  return idx;
}

const GRADE_LEVEL_BY_LABEL = new Map(Object.entries(GRADE_LEVEL_LABEL).map(([code, label]) => [label, code]));

export function matchGradeLevel(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.toUpperCase() in GRADE_LEVEL_LABEL) return s.toUpperCase();
  const byLabel = GRADE_LEVEL_BY_LABEL.get(s);
  if (byLabel) return byLabel;
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return `SINIF_${num}`;
  return null;
}
