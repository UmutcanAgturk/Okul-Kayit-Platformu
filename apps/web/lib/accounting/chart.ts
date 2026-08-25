import { AccountType, NormalBalance } from "@prisma/client";

/**
 * Tekdüzen Hesap Planı — hizmet işletmesi (eğitim kurumu) için pratik alt küme.
 * Kod/isim/sınıf/normal bakiye (borç veya alacak) taşır. Cari hesaplar (120
 * Alıcılar, 320 Satıcılar) burada ANA hesap olarak durur; öğrenci/tedarikçi
 * bazlı alt hesaplar (120.0001 gibi) çalışma anında `ensureCariAccount` ile
 * açılır (bkz. posting.ts).
 */
export interface ChartAccount {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: string;
}

const B = NormalBalance.BORC;
const A = NormalBalance.ALACAK;

export const STANDARD_CHART: ChartAccount[] = [
  // 1 — DÖNEN VARLIKLAR (aktif, normal borç)
  { code: "100", name: "Kasa", type: AccountType.VARLIK, normalBalance: B },
  { code: "102", name: "Bankalar", type: AccountType.VARLIK, normalBalance: B },
  { code: "108", name: "Diğer Hazır Değerler (POS)", type: AccountType.VARLIK, normalBalance: B },
  { code: "120", name: "Alıcılar (Öğrenci/Veli Cari)", type: AccountType.VARLIK, normalBalance: B },
  { code: "153", name: "Ticari Mallar", type: AccountType.VARLIK, normalBalance: B },
  { code: "191", name: "İndirilecek KDV", type: AccountType.VARLIK, normalBalance: B },
  // 2 — DURAN VARLIKLAR
  { code: "255", name: "Demirbaşlar", type: AccountType.VARLIK, normalBalance: B },
  // 3 — KISA VADELİ YABANCI KAYNAKLAR (pasif, normal alacak)
  { code: "320", name: "Satıcılar (Tedarikçi Cari)", type: AccountType.YABANCI_KAYNAK, normalBalance: A },
  { code: "335", name: "Personele Borçlar", type: AccountType.YABANCI_KAYNAK, normalBalance: A },
  { code: "360", name: "Ödenecek Vergi ve Fonlar", type: AccountType.YABANCI_KAYNAK, normalBalance: A },
  { code: "361", name: "Ödenecek Sosyal Güvenlik Kesintileri", type: AccountType.YABANCI_KAYNAK, normalBalance: A },
  { code: "391", name: "Hesaplanan KDV", type: AccountType.YABANCI_KAYNAK, normalBalance: A },
  // 5 — ÖZKAYNAKLAR
  { code: "500", name: "Sermaye", type: AccountType.OZKAYNAK, normalBalance: A },
  { code: "590", name: "Dönem Net Kârı", type: AccountType.OZKAYNAK, normalBalance: A },
  { code: "591", name: "Dönem Net Zararı (-)", type: AccountType.OZKAYNAK, normalBalance: B },
  // 6 — GELİR TABLOSU: GELİRLER (normal alacak)
  { code: "600", name: "Yurtiçi Satışlar (Eğitim Gelirleri)", type: AccountType.GELIR, normalBalance: A },
  { code: "602", name: "Diğer Gelirler", type: AccountType.GELIR, normalBalance: A },
  { code: "679", name: "Diğer Olağandışı Gelir ve Kârlar", type: AccountType.GELIR, normalBalance: A },
  // 7 — GİDERLER (normal borç)
  { code: "770", name: "Genel Yönetim Giderleri", type: AccountType.GIDER, normalBalance: B },
  { code: "770.01", name: "Personel Giderleri", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.02", name: "Kira Giderleri", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.03", name: "Elektrik / Su / Doğalgaz", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.04", name: "İletişim / İnternet", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.05", name: "Kırtasiye / Ofis", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.06", name: "Reklam / Pazarlama", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "770.99", name: "Diğer Genel Yönetim Giderleri", type: AccountType.GIDER, normalBalance: B, parentCode: "770" },
  { code: "780", name: "Finansman Giderleri", type: AccountType.GIDER, normalBalance: B },
  { code: "689", name: "Diğer Olağandışı Gider ve Zararlar", type: AccountType.GIDER, normalBalance: B },
];

// Sık kullanılan hesap kodları (otomatik kayıt için).
export const ACC = {
  KASA: "100",
  BANKALAR: "102",
  POS: "108",
  ALICILAR: "120",
  IND_KDV: "191",
  SATICILAR: "320",
  PERSONELE_BORC: "335",
  OD_VERGI: "360",
  OD_SGK: "361",
  HES_KDV: "391",
  SERMAYE: "500",
  DONEM_KAR: "590",
  SATISLAR: "600",
  DIGER_GELIR: "602",
  GYG: "770",
  GYG_PERSONEL: "770.01",
  GYG_KIRA: "770.02",
  GYG_DIGER: "770.99",
  FIN_GIDER: "780",
} as const;

/** Serbest metin gider kategorisini bir 770.x alt hesabına eşler. */
export function expenseCategoryToAccount(category: string | null | undefined): string {
  const c = (category ?? "").toLocaleLowerCase("tr");
  if (/kira/.test(c)) return ACC.GYG_KIRA;
  if (/maaş|personel|bordro|ücret/.test(c)) return ACC.GYG_PERSONEL;
  if (/elektrik|su|doğalgaz|gaz|fatura/.test(c)) return "770.03";
  if (/internet|iletişim|telefon|hat/.test(c)) return "770.04";
  if (/kırtasiye|ofis|malzeme/.test(c)) return "770.05";
  if (/reklam|pazarlama|ilan|tanıtım/.test(c)) return "770.06";
  return ACC.GYG_DIGER;
}

/** Sınıf → mali tablo grubu etiketi (mizan/gelir tablosu/bilanço başlıkları). */
export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  VARLIK: "Varlıklar (Aktif)",
  YABANCI_KAYNAK: "Yabancı Kaynaklar (Borçlar)",
  OZKAYNAK: "Özkaynaklar",
  GELIR: "Gelirler",
  GIDER: "Giderler",
  MALIYET: "Maliyetler",
};
