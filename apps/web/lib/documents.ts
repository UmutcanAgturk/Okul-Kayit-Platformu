/**
 * Fatura/Dekont/Senet belge numarası üretimi — demo/seviye360-app.html'deki
 * `pad6(b.invoiceSeq++)` deseninin gerçek karşılığı. Şubede tutulan bir sayaç
 * yerine (concurrency güvenli olmayan bir alan eklemek yerine) tenant+yıl
 * bazında MEVCUT KAYIT SAYISI + 1 kullanılır; `@@unique([tenantId, no])`
 * çakışması durumunda bir sonraki sayıyla yeniden dener (generateStudentNo'daki
 * retry-on-conflict deseniyle aynı yaklaşım, bkz. lib/enrollment.ts).
 */
export function formatDocumentNo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}

/**
 * KDV Kanunu 17/2-b istisnası (kdvRate=null) hariç, faturayı KDV HARİÇ
 * (net) tutar üzerinden düzenler: kdvAmount = subtotal * kdvRate,
 * total = subtotal + kdvAmount. Bu, AccountingLedgerEntry.vatRate'in
 * "amount KDV DAHİL" varsayımının (bkz. lib/tax.ts) TERSİ yöndür — fatura
 * tutarları standart olarak KDV hariç yazılır.
 */
export function invoiceTotals(subtotal: number, kdvRate: number | null) {
  const kdvAmount = kdvRate === null ? 0 : round2(subtotal * kdvRate);
  return { kdvAmount, total: round2(subtotal + kdvAmount) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
