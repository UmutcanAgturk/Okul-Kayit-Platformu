"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { fetchBranchClassrooms } from "@/lib/api/students-roster";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { parseCsv } from "@/lib/csv";
import { detectColumns, matchGradeLevel, submitBulkImport, type BulkImportRow, type BulkImportResultRow } from "@/lib/api/bulk-import";
import { Icon } from "@/components/ui/icons";

interface PreviewRow extends BulkImportRow {
  valid: boolean;
  issue?: string;
}

function buildPreviewRow(cells: string[], idx: Record<string, number>, classroomByName: Map<string, string>): PreviewRow {
  const get = (key: string) => (idx[key] !== undefined ? (cells[idx[key]] ?? "").trim() : "");
  const candidateFullName = [get("ad"), get("soyad")].filter(Boolean).join(" ") || get("ad");
  const gradeLevel = matchGradeLevel(get("gradeLevel"));
  const classroomName = get("classroom");
  const classroomId = classroomName ? classroomByName.get(classroomName.toLocaleUpperCase("tr-TR")) : undefined;
  const nationalId = get("nationalId").replace(/\D/g, "");
  const guardianFullName = get("guardianFullName");
  const guardianPhone = get("guardianPhone");
  const installmentCount = parseInt(get("installmentCount"), 10) || 0;
  const installmentAmount = Number(get("installmentAmount").replace(/[^\d.,]/g, "").replace(",", ".")) || 0;
  const firstDueDate = get("firstDueDate");
  const parsedDate = firstDueDate && !isNaN(Date.parse(firstDueDate)) ? firstDueDate : "";

  let issue: string | undefined;
  if (!candidateFullName) issue = "Ad/Soyad eksik";
  else if (!gradeLevel) issue = "Sınıf düzeyi tanınamadı";
  else if (!/^\d{11}$/.test(nationalId)) issue = "T.C. Kimlik No eksik/geçersiz (11 hane)";
  else if (!guardianFullName) issue = "Veli adı eksik";
  else if (!guardianPhone) issue = "Veli telefonu eksik";
  else if (!installmentCount || !installmentAmount || !parsedDate) issue = "Taksit bilgisi eksik/geçersiz";

  return {
    candidateFullName,
    candidateGradeLevel: gradeLevel ?? "",
    nationalId,
    guardianFullName,
    guardianPhone,
    classroomId,
    installmentCount,
    installmentAmount,
    firstDueDate: parsedDate,
    valid: !issue,
    issue,
  };
}

/**
 * Toplu Yükleme — demo/seviye360-app.html'deki "branch:normalkayit"
 * ekranının Toplu Yükleme modu. Demo .xlsx bekliyordu; burada CSV kullanılır
 * (bkz. app/api/branch/students/bulk-import route'undaki not — npm'deki
 * `xlsx` paketinin düzeltmesi olmayan bilinen güvenlik açıkları var).
 */
export function BulkImportPanel() {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const classroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms });
  const classroomByName = new Map((classroomsQuery.data?.classrooms ?? []).map((c) => [c.name.toLocaleUpperCase("tr-TR"), c.id]));

  const importMutation = useMutation({
    mutationFn: (validRows: BulkImportRow[]) => submitBulkImport(validRows),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    importMutation.reset();
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const table = parseCsv(text);
        if (table.length < 2) {
          setParseError("Dosyada başlık satırı + en az 1 veri satırı olmalı.");
          setRows([]);
          return;
        }
        const idx = detectColumns(table[0]);
        if (idx.ad === undefined && idx.soyad === undefined) {
          setParseError('"Ad" ve "Soyad" sütunları algılanamadı — başlık satırını kontrol edin.');
          setRows([]);
          return;
        }
        const preview = table.slice(1).map((cells) => buildPreviewRow(cells, idx, classroomByName));
        setRows(preview);
      } catch {
        setParseError("Dosya okunamadı — geçerli bir CSV olduğundan emin olun.");
        setRows([]);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  const validRows = rows.filter((r) => r.valid);
  const resultByRowIndex = new Map((importMutation.data?.results ?? []).map((r) => [r.rowIndex, r]));

  function handleImport() {
    importMutation.mutate(validRows);
  }

  return (
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>CSV Dosyası Yükle</h3>
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", margin: "0 0 10px" }}>
          Sütun başlıkları: Ad, Soyad, T.C. Kimlik No, Veli Adı Soyadı, Veli Telefonu, Sınıf Düzeyi (opsiyonel: Şube,
          Taksit Sayısı, Taksit Tutarı, İlk Vade). T.C. Kimlik No giriş için zorunludur (11 hane). Dosya tamamen
          tarayıcınızda işlenir, sunucuya yüklenmez.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        {fileName && <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)", marginTop: 6 }}>{fileName}</p>}
        {parseError && <p style={{ fontSize: "var(--text-xs)", color: "var(--critical)", marginTop: 6 }}>{parseError}</p>}

        {rows.length > 0 && (
          <>
            <div className="grid cols-2" style={{ margin: "14px 0" }}>
              <div className="card stat-card tone-strong">
                <p className="stat-label">Geçerli Satır</p>
                <p className="stat-value">{validRows.length}</p>
              </div>
              <div className="card stat-card tone-critical">
                <p className="stat-label">Hatalı Satır</p>
                <p className="stat-value">{rows.length - validRows.length}</p>
              </div>
            </div>
            <button type="button" className="btn primary" disabled={validRows.length === 0 || importMutation.isPending} onClick={handleImport}>
              {importMutation.isPending ? "İçe aktarılıyor…" : `${validRows.length} Öğrenciyi İçe Aktar`}
            </button>
            {importMutation.isError && (
              <p style={{ fontSize: "var(--text-xs)", color: "var(--critical)", marginTop: 6 }}>
                {importMutation.error instanceof ApiError ? importMutation.error.message : "İçe aktarma başarısız."}
              </p>
            )}
          </>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Önizleme</h3>
          <span className="hint">{rows.length} satır</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty-state">
            <Icon name="attach" />
            <p>Önizlemek için bir CSV dosyası seçin.</p>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: 420, overflowY: "auto" }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th>T.C. Kimlik No</th>
                  <th>Sınıf</th>
                  <th>Veli</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const result = resultByRowIndex.get(i);
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{r.candidateFullName || "—"}</td>
                      <td style={{ fontFamily: "monospace" }}>{r.nationalId || "—"}</td>
                      <td>{GRADE_LEVEL_LABEL[r.candidateGradeLevel] ?? "—"}</td>
                      <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                        {r.guardianFullName} {r.guardianPhone && `· ${r.guardianPhone}`}
                      </td>
                      <td>
                        {result ? (
                          result.kind === "ok" ? (
                            <span className="chip strong" title={`${result.username} / ${result.password}`}>
                              Oluşturuldu — {result.studentNo}
                            </span>
                          ) : (
                            <span className="chip critical">{result.message}</span>
                          )
                        ) : r.valid ? (
                          <span className="chip neutral">Hazır</span>
                        ) : (
                          <span className="chip critical">{r.issue}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {importMutation.data && (
          <p style={{ marginTop: 10, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            {importMutation.data.successCount} başarılı, {importMutation.data.errorCount} hatalı. Şifreler yalnızca bu
            oturumda görünür — satır üzerine gelerek (title) görüntüleyebilirsiniz, hemen velilere iletin.
          </p>
        )}
      </div>
    </div>
  );
}
