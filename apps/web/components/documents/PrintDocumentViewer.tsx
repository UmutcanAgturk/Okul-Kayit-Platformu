"use client";

/**
 * demo/seviye360-app.html'deki #doc-viewer modal'ının (printInvoice/
 * printDekont/printSenet/printEnrollmentContract) karşılığı — Muhasebe →
 * Belgeler'deki (ve Normal Kayıt'taki sözleşme) kayıtları temiz,
 * yazdırmaya hazır bir düzende gösterir. Veri zaten gerçek (Fatura/Dekont/
 * Senet/Enrollment tabloları) — burada eklenen tek şey görsel sunum.
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
  if (!open) return null;

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
          <p style={{ flex: 1, minWidth: 200, margin: 0, fontSize: 11.5, color: "#6b7280" }}>
            Yazdırmak için &quot;Doğrudan Yazdır&quot;a basın veya klavyeden Ctrl/Cmd+P kullanın.
          </p>
          <button type="button" className="btn primary" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={() => window.print()}>
            Doğrudan Yazdır (Ctrl+P)
          </button>
          <button type="button" className="btn" style={{ padding: "6px 14px", fontSize: 12.5 }} onClick={onClose}>
            Kapat
          </button>
        </div>
        <div className="print-area" style={{ overflowY: "auto", padding: "36px 40px", color: "#111", userSelect: "text" }}>
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
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Seviye 360 Eğitim Kurumları</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{title}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{no}</p>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>{new Date(date).toLocaleDateString("tr-TR")}</p>
      </div>
    </div>
  );
}
