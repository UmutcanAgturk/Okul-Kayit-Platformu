import { DisciplineType } from "@prisma/client";

/**
 * demo/seviye360-app.html'deki DISCIPLINE_CATEGORIES ile birebir aynı —
 * kategori seçenekleri türe (olumlu/olumsuz) göre değişir.
 */
export const DISCIPLINE_CATEGORIES: Record<DisciplineType, string[]> = {
  OLUMLU: ["Derse Katılım", "Yardımseverlik", "Liderlik", "Ödev Tamamlama", "Diğer"],
  OLUMSUZ: ["Derse Geç Kalma", "Ödev Yapmama", "Kurallara Uymama", "Saygısız Davranış", "Diğer"],
};

// demo/seviye360-app.html'deki createDisciplineRecord()'daki varsayılanla aynı.
export function pointsForType(type: DisciplineType): number {
  return type === "OLUMLU" ? 5 : -5;
}
