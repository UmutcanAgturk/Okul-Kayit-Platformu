import type { Invoice, PromissoryNote, Receipt } from "@/lib/api/documents";
import { DocHeader, DocRow } from "./PrintDocumentViewer";

function tl(n: number | string) {
  return "₺" + Math.round(Number(n)).toLocaleString("tr-TR");
}

export function InvoicePrintBody({ invoice }: { invoice: Invoice }) {
  return (
    <div>
      <DocHeader title="FATURA" no={invoice.no} date={invoice.invoiceDate} />
      <DocRow label="Alıcı" value={invoice.buyerName} />
      {invoice.buyerTaxNo && <DocRow label="Vergi No" value={invoice.buyerTaxNo} />}
      {invoice.buyerAddress && <DocRow label="Adres" value={invoice.buyerAddress} />}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111" }}>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Açıklama</th>
            <th style={{ textAlign: "right", padding: "6px 4px" }}>Miktar</th>
            <th style={{ textAlign: "right", padding: "6px 4px" }}>Birim Fiyat</th>
            <th style={{ textAlign: "right", padding: "6px 4px" }}>Tutar</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 4px" }}>{it.description}</td>
              <td style={{ textAlign: "right", padding: "6px 4px" }}>{it.quantity}</td>
              <td style={{ textAlign: "right", padding: "6px 4px" }}>{tl(it.unitPrice)}</td>
              <td style={{ textAlign: "right", padding: "6px 4px" }}>{tl(it.quantity * it.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 16, marginLeft: "auto", width: 220 }}>
        <DocRow label="Ara Toplam" value={tl(invoice.subtotal)} />
        <DocRow label={invoice.kdvRate !== null ? `KDV (%${Math.round(Number(invoice.kdvRate) * 100)})` : "KDV"} value={invoice.kdvRate !== null ? tl(invoice.kdvAmount) : "İstisna"} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 16, fontWeight: 800 }}>
          <span>Genel Toplam</span>
          <span>{tl(invoice.total)}</span>
        </div>
      </div>
      {invoice.note && <p style={{ marginTop: 20, fontSize: 12, color: "#6b7280" }}>Not: {invoice.note}</p>}
    </div>
  );
}

export function ReceiptPrintBody({ receipt }: { receipt: Receipt }) {
  const methodLabel: Record<Receipt["method"], string> = {
    KREDI_KARTI: "Kredi Kartı", BANKA_HAVALESI: "Banka Havalesi", NAKIT: "Nakit", SENET: "Senet",
  };
  return (
    <div>
      <DocHeader title={receipt.type === "TAHSILAT" ? "TAHSİLAT DEKONTU" : "ÖDEME DEKONTU"} no={receipt.no} date={receipt.receiptDate} />
      <DocRow label={receipt.type === "TAHSILAT" ? "Tahsil Edilen Kişi" : "Ödeme Yapılan Kişi"} value={receipt.personName} />
      <DocRow label="Yöntem" value={methodLabel[receipt.method]} />
      {receipt.description && <DocRow label="Açıklama" value={receipt.description} />}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 0 0", fontSize: 20, fontWeight: 800 }}>
        <span>Tutar</span>
        <span>{tl(receipt.amount)}</span>
      </div>
      {receipt.note && <p style={{ marginTop: 20, fontSize: 12, color: "#6b7280" }}>Not: {receipt.note}</p>}
    </div>
  );
}

export function PromissoryNotePrintBody({ note }: { note: PromissoryNote }) {
  return (
    <div>
      <DocHeader title="SENET" no={note.no} date={note.issueDate} />
      <DocRow label="Borçlu" value={note.debtorName} />
      <DocRow label="Vade Tarihi" value={new Date(note.dueDate).toLocaleDateString("tr-TR")} />
      <DocRow label="Durum" value={note.status === "ODENDI" ? "Ödendi" : "Ödenmedi"} />
      <div style={{ display: "flex", justifyContent: "space-between", padding: "20px 0 0", fontSize: 20, fontWeight: 800 }}>
        <span>Tutar</span>
        <span>{tl(note.amount)}</span>
      </div>
      {note.note && <p style={{ marginTop: 20, fontSize: 12, color: "#6b7280" }}>Not: {note.note}</p>}
      <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div style={{ borderTop: "1px solid #111", paddingTop: 6, width: 180, textAlign: "center" }}>Borçlu İmza</div>
        <div style={{ borderTop: "1px solid #111", paddingTop: 6, width: 180, textAlign: "center" }}>Yetkili İmza</div>
      </div>
    </div>
  );
}

export interface EnrollmentContractData {
  candidateFullName: string;
  candidateGradeLevel: string;
  guardianFullName: string;
  guardianPhone: string;
  contractSignedAt: string | null;
  installments: { installmentNo: number; amount: string; dueDate: string }[];
}

export function EnrollmentContractPrintBody({ enrollment, gradeLabel }: { enrollment: EnrollmentContractData; gradeLabel: string }) {
  const total = enrollment.installments.reduce((s, i) => s + Number(i.amount), 0);
  return (
    <div>
      <DocHeader title="KAYIT SÖZLEŞMESİ" no={enrollment.candidateFullName} date={enrollment.contractSignedAt ?? new Date().toISOString()} />
      <DocRow label="Öğrenci" value={enrollment.candidateFullName} />
      <DocRow label="Sınıf Düzeyi" value={gradeLabel} />
      <DocRow label="Veli" value={enrollment.guardianFullName} />
      <DocRow label="Veli Telefonu" value={enrollment.guardianPhone} />
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #111" }}>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Taksit No</th>
            <th style={{ textAlign: "left", padding: "6px 4px" }}>Vade Tarihi</th>
            <th style={{ textAlign: "right", padding: "6px 4px" }}>Tutar</th>
          </tr>
        </thead>
        <tbody>
          {enrollment.installments.map((it) => (
            <tr key={it.installmentNo} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 4px" }}>{it.installmentNo}</td>
              <td style={{ padding: "6px 4px" }}>{new Date(it.dueDate).toLocaleDateString("tr-TR")}</td>
              <td style={{ textAlign: "right", padding: "6px 4px" }}>{tl(it.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0 0", fontSize: 16, fontWeight: 800 }}>
        <span>Toplam Kayıt Bedeli</span>
        <span>{tl(total)}</span>
      </div>
      <p style={{ marginTop: 24, fontSize: 12, color: "#6b7280" }}>
        Bu sözleşme, yukarıda belirtilen öğrencinin Seviye 360 Eğitim Kurumları&apos;na kaydını ve belirlenen ödeme planını
        veli/vasi tarafından kabul edildiğini gösterir.
      </p>
      <div style={{ marginTop: 60, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <div style={{ borderTop: "1px solid #111", paddingTop: 6, width: 180, textAlign: "center" }}>Veli/Vasi İmza</div>
        <div style={{ borderTop: "1px solid #111", paddingTop: 6, width: 180, textAlign: "center" }}>Kurum Yetkilisi İmza</div>
      </div>
    </div>
  );
}
