"use client";

import { useRef, useState } from "react";
import { downloadElementAsPdf } from "@/lib/pdf";

/**
 * demo/seviye360-app.html'deki #doc-viewer modal'ının (printInvoice/
 * printDekont/printSenet/printEnrollmentContract) karşılığı — Muhasebe →
 * Belgeler'deki (ve Normal Kayıt'taki sözleşme) kayıtları temiz,
 * yazdırmaya hazır bir düzende gösterir. Veri zaten gerçek (Fatura/Dekont/
 * Senet/Enrollment tabloları) — burada eklenen tek şey görsel sunum.
 *
 * Çıktı almanın birincil yolu artık tarayıcının yazdırma diyaloğu değil,
 * "PDF İndir" — belge lib/pdf.ts ile doğrudan bir .pdf dosyası olarak iner
 * (dosya adı belge numarasından türetilir). Yazdırma, yedek seçenek olarak
 * duruyor.
 */
export function PrintDocumentViewer({
  open,
  onClose,
  documentNo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  documentNo: string;
  children: React.ReactNode;
}) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!open) return null;

  async function handleDownloadPdf() {
    if (!printAreaRef.current || pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await downloadElementAsPdf(printAreaRef.current, documentNo || "belge");
    } catch {
      setPdfError("PDF oluşturulamadı — lütfen tekrar deneyin.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <>
      <div
        className="print-hide"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(10,14,20,.45)", zIndex: 90 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
          width: "min(680px, 92vw)", maxHeight: "88vh", background: "#ffffff", color: "#111",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)", zIndex: 91,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        <div className="print-hide" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderBottom: "1px solid #e5e7eb", background: "#f8f9fb", flexWrap: "wrap" }}>
          <p style={{ flex: 1, minWidth: 200, margin: 0, fontSize: 11.5, color: pdfError ? "#b91c1c" : "#6b7280" }}>
            {pdfError ?? "Belgeyi PDF dosyası olarak indirin; dilerseniz yazdırmayı da kullanabilirsiniz."}
          </p>
          <button type="button" className="btn primary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={handleDownloadPdf} disabled={pdfBusy}>
            {pdfBusy ? "PDF hazırlanıyor…" : "PDF İndir"}
          </button>
          <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={() => window.print()}>
            Yazdır
          </button>
          <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={onClose}>
            Kapat
          </button>
        </div>
        <div ref={printAreaRef} className="print-area" style={{ overflowY: "auto", padding: "36px 40px", color: "#111", userSelect: "text", background: "#ffffff" }}>
          {children}
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: fixed; inset: 0; padding: 24px !important; max-height: none !important; overflow: visible !important; }
          .print-hide { display: none !important; }
        }
      `}</style>
    </>
  );
}

export function DocRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #eee", fontSize: 13 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export function DocHeader({ title, no, date }: { title: string; no: string; date: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 16, borderBottom: "2px solid #111" }}>
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/seviye360-logo.png" alt="Seviye 360" style={{ height: 40, width: "auto", display: "block", marginBottom: 6 }} />
        <p style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Seviye 360 Eğitim Kurumları</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{title}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{no}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{new Date(date).toLocaleDateString("tr-TR")}</p>
      </div>
    </div>
  );
}
