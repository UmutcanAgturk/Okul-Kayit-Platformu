import { NextRequest, NextResponse } from "next/server";
import { toCsv } from "@/lib/csv";
import { toXlsx } from "@/lib/xlsx";

/**
 * Rapor dışa aktarımı — hem CSV hem gerçek .xlsx (Excel). .xlsx üretimi
 * bağımlılıksızdır (bkz. lib/xlsx.ts). Çağıran taraf yalnızca başlıkları +
 * satırları verir; `?format=xlsx` (veya `excel`) ise Excel, aksi halde CSV döner.
 */
export function reportResponse(
  request: NextRequest,
  filenameBase: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][],
): NextResponse {
  const format = (request.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format === "xlsx" || format === "excel") {
    const buf = toXlsx(sheetName, headers, rows);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(headers, rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
