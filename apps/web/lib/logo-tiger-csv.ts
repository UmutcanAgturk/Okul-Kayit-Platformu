import type { HqExamBranchBreakdownRow } from "@/lib/api/hq";

/**
 * demo/seviye360-app.html'deki exportLogoTigerCsv()'nin karşılığı — Genel
 * Sınav Merkezi'ndeki fatura verisini Logo/Tiger gibi Türk muhasebe
 * yazılımlarının içe aktarabileceği standart bir CSV formatında üretir.
 * Sunucuya hiçbir şey göndermez, dosya tamamen tarayıcıda oluşturulur.
 */
export function buildLogoTigerCsv(exam: { id: string; examDate: string; feePerStudent: number | null }, branches: HqExamBranchBreakdownRow[]) {
  const header = "FISTURU;EVRAKNO;TARIH;CARIKODU;CARIUNVAN;STOKKODU;STOKADI;MIKTAR;BIRIM;BIRIMFIYAT;KDVORANI;TUTAR";
  const rows = branches.map((b) =>
    [
      "FATURA",
      `SNV${exam.id}-${b.tenantCode}`,
      exam.examDate,
      `CARI${b.tenantCode}`,
      b.tenantName,
      "SINAV-OPTIK",
      "Deneme Sınavı Optik Değerlendirme Hizmeti",
      String(b.studentCount),
      "ADET",
      String(exam.feePerStudent ?? 0),
      "20",
      String(b.totalFee),
    ].join(";"),
  );
  return [header, ...rows].join("\r\n");
}

export function downloadLogoTigerCsv(exam: { id: string; examDate: string; feePerStudent: number | null }, branches: HqExamBranchBreakdownRow[]) {
  const csv = buildLogoTigerCsv(exam, branches);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `logo-tiger-fatura-${exam.id}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
