/**
 * KDV ve stopaj (GVK md 94) hesaplama yardımcıları — AccountingLedgerEntry'nin
 * `vatRate`/`withholdingRate` alanlarına karşılık gelir (bkz. schema.prisma).
 *
 * `amount` her zaman KDV DAHİL brüt tutar olarak saklanır; `vatRate` yalnızca
 * bu tutarı matrah + KDV'ye ayrıştırmak için kullanılır, `amount`'un kendisini
 * değiştirmez (mevcut gelir/gider toplamları bu yüzden etkilenmez).
 */

export function vatBreakdown(amount: number, vatRate: number | null) {
  if (vatRate === null) {
    return { base: amount, vatAmount: 0 };
  }
  const base = amount / (1 + vatRate);
  return { base: round2(base), vatAmount: round2(amount - base) };
}

/**
 * `amount`, stopaj kesintisinden ÖNCEKİ (brüt/sözleşme) tutardır — kesilen
 * pay muhtasar beyanname ile vergi dairesine, kalanı hak sahibine ödenir.
 * Gider olarak deftere yazılan `amount` bundan etkilenmez.
 */
export function withholdingBreakdown(amount: number, withholdingRate: number | null) {
  if (withholdingRate === null) {
    return { withholdingAmount: 0, netPayable: amount };
  }
  const withholdingAmount = round2(amount * withholdingRate);
  return { withholdingAmount, netPayable: round2(amount - withholdingAmount) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
