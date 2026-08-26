/**
 * Resmi bordro motoru — kümülatif yıllık gelir vergisi dilimi takibi + asgari
 * ücret gelir/damga vergisi istisnası. Basit `computePayroll` (lib/payroll.ts)
 * yerine geçer; PayrollRecord ile aynı alanları döndürür.
 *
 * ⚠️ YASAL PARAMETRELER YILLIK GÜNCELLENİR. Aşağıdaki dilimler/oranlar ve
 * asgari ücret 2025 yılı yayımlanmış değerleridir; her yıl Resmî Gazete'de
 * yayımlanan güncel değerlerle değiştirilmelidir (PAYROLL_PARAMS).
 */

export interface PayrollParams {
  sgkEmployee: number;
  unemploymentEmployee: number;
  sgkEmployer: number;
  unemploymentEmployer: number;
  stampDutyRate: number;
  minWageGross: number; // asgari ücret aylık brüt (istisna hesabı)
  // Kümülatif yıllık gelir vergisi dilimleri (TL). `upTo` üst sınır (dahil).
  incomeTaxBrackets: { upTo: number; rate: number }[];
}

// 2025 yayımlanmış değerler — YILLIK GÜNCELLENMELİDİR.
export const PAYROLL_PARAMS: PayrollParams = {
  sgkEmployee: 0.14,
  unemploymentEmployee: 0.01,
  sgkEmployer: 0.205,
  unemploymentEmployer: 0.02,
  stampDutyRate: 0.00759,
  minWageGross: 26005.5,
  incomeTaxBrackets: [
    { upTo: 158000, rate: 0.15 },
    { upTo: 330000, rate: 0.2 },
    { upTo: 1200000, rate: 0.27 },
    { upTo: 4300000, rate: 0.35 },
    { upTo: Infinity, rate: 0.4 },
  ],
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Kümülatif matrah `base` üzerinden toplam gelir vergisi (dilimli). */
function cumulativeIncomeTax(base: number, brackets: PayrollParams["incomeTaxBrackets"]): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (base <= prev) break;
    const slice = Math.min(base, b.upTo) - prev;
    tax += slice * b.rate;
    prev = b.upTo;
  }
  return tax;
}

export interface OfficialPayrollResult {
  sgkEmployeeShare: number;
  unemploymentEmployeeShare: number;
  incomeTaxBase: number;
  incomeTaxGross: number; // istisnadan önce
  minWageExemptionIncome: number; // uygulanan gelir vergisi istisnası
  incomeTaxWithheld: number; // istisnadan sonra
  stampDutyWithheld: number;
  minWageExemptionStamp: number;
  netSalary: number;
  sgkEmployerShare: number;
  unemploymentEmployerShare: number;
  employerCost: number;
  cumulativeBaseAfter: number; // bu ay dahil yıllık kümülatif matrah
}

/**
 * @param grossSalary Bu ayın brüt ücreti
 * @param priorCumulativeBase Yıl içinde bu aydan ÖNCEKİ aylara ait toplam gelir
 *        vergisi matrahı (ilk ayda 0). Kümülatif dilim için gereklidir.
 */
export function computePayrollOfficial(grossSalary: number, priorCumulativeBase = 0, p: PayrollParams = PAYROLL_PARAMS): OfficialPayrollResult {
  const sgkEmployeeShare = round2(grossSalary * p.sgkEmployee);
  const unemploymentEmployeeShare = round2(grossSalary * p.unemploymentEmployee);
  const incomeTaxBase = round2(grossSalary - sgkEmployeeShare - unemploymentEmployeeShare);

  // Kümülatif dilim: bu ayın vergisi = f(önceki+bu) − f(önceki)
  const cumulativeBaseAfter = round2(priorCumulativeBase + incomeTaxBase);
  const incomeTaxGross = round2(cumulativeIncomeTax(cumulativeBaseAfter, p.incomeTaxBrackets) - cumulativeIncomeTax(priorCumulativeBase, p.incomeTaxBrackets));

  // Asgari ücret istisnası — asgari ücretin matrahı üzerinden (ilk dilim %15).
  const minWageBase = p.minWageGross * (1 - p.sgkEmployee - p.unemploymentEmployee);
  const minWageExemptionIncome = round2(Math.min(incomeTaxGross, minWageBase * p.incomeTaxBrackets[0].rate));
  const incomeTaxWithheld = round2(Math.max(0, incomeTaxGross - minWageExemptionIncome));

  // Damga vergisi — asgari ücret tutarı damgadan istisna.
  const stampGross = round2(grossSalary * p.stampDutyRate);
  const minWageExemptionStamp = round2(Math.min(stampGross, p.minWageGross * p.stampDutyRate));
  const stampDutyWithheld = round2(Math.max(0, stampGross - minWageExemptionStamp));

  const netSalary = round2(grossSalary - sgkEmployeeShare - unemploymentEmployeeShare - incomeTaxWithheld - stampDutyWithheld);

  const sgkEmployerShare = round2(grossSalary * p.sgkEmployer);
  const unemploymentEmployerShare = round2(grossSalary * p.unemploymentEmployer);
  const employerCost = round2(grossSalary + sgkEmployerShare + unemploymentEmployerShare);

  return {
    sgkEmployeeShare,
    unemploymentEmployeeShare,
    incomeTaxBase,
    incomeTaxGross,
    minWageExemptionIncome,
    incomeTaxWithheld,
    stampDutyWithheld,
    minWageExemptionStamp,
    netSalary,
    sgkEmployerShare,
    unemploymentEmployerShare,
    employerCost,
    cumulativeBaseAfter,
  };
}
