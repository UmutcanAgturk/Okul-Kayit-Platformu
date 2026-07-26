/**
 * Basitleştirilmiş, gösterim amaçlı bordro hesaplayıcısı (bkz. schema.prisma
 * PayrollRecord). RESMİ BİR BORDRO MOTORU DEĞİLDİR — şu ayrıntılar kasıtlı
 * olarak MODELLENMEMİŞTİR:
 *  - Kümülatif yıllık gelir vergisi dilimi takibi (her ay yalnızca ilk dilim
 *    oranı — %15 — uygulanır; gerçekte yıl içinde kümülatif matrah arttıkça
 *    %20/%27/%35/%40 dilimlerine geçilir).
 *  - Asgari ücret gelir/damga vergisi istisnası (2022'den beri yürürlükte).
 *  - SGK teşvikleri (5510 sayılı Kanun'daki çeşitli işveren prim indirimleri).
 * Oranlar sabit tutulmuştur; gerçek bir bordro sistemi bunları yürürlükteki
 * yasal parametrelere göre yıl/ay bazında güncellemelidir.
 */

export const PAYROLL_RATES = {
  sgkEmployee: 0.14,
  unemploymentEmployee: 0.01,
  sgkEmployer: 0.205,
  unemploymentEmployer: 0.02,
  incomeTaxFirstBracket: 0.15,
  stampDuty: 0.00759,
} as const;

export function computePayroll(grossSalary: number) {
  const sgkEmployeeShare = round2(grossSalary * PAYROLL_RATES.sgkEmployee);
  const unemploymentEmployeeShare = round2(grossSalary * PAYROLL_RATES.unemploymentEmployee);
  const incomeTaxBase = grossSalary - sgkEmployeeShare - unemploymentEmployeeShare;
  const incomeTaxWithheld = round2(incomeTaxBase * PAYROLL_RATES.incomeTaxFirstBracket);
  const stampDutyWithheld = round2(grossSalary * PAYROLL_RATES.stampDuty);
  const netSalary = round2(grossSalary - sgkEmployeeShare - unemploymentEmployeeShare - incomeTaxWithheld - stampDutyWithheld);

  const sgkEmployerShare = round2(grossSalary * PAYROLL_RATES.sgkEmployer);
  const unemploymentEmployerShare = round2(grossSalary * PAYROLL_RATES.unemploymentEmployer);
  const employerCost = round2(grossSalary + sgkEmployerShare + unemploymentEmployerShare);

  return {
    sgkEmployeeShare,
    unemploymentEmployeeShare,
    incomeTaxWithheld,
    stampDutyWithheld,
    netSalary,
    sgkEmployerShare,
    unemploymentEmployerShare,
    employerCost,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
