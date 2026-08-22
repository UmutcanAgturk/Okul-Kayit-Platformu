/**
 * Belge görünümünü (PrintDocumentViewer içeriği) tarayıcı yazdırma diyaloğuna
 * gerek kalmadan gerçek bir PDF dosyası olarak indirir — demo'daki
 * printInvoice/printDekont/printSenet akışlarının "otomatik PDF" karşılığı.
 *
 * Yöntem: DOM düğümü ekran dışına klonlanır (scroll/max-height kısıtları
 * kaldırılmış halde), html2canvas ile yüksek çözünürlükte rasterize edilir ve
 * jsPDF ile kenar boşluklu A4 sayfalara bölünerek kaydedilir. Sayfa bölme,
 * kanvası dilimleyerek yapılır — böylece bir satır iki sayfaya taşmaz,
 * içerik tekrarı olmaz.
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 12;

/** Dosya adında sorun çıkaracak karakterleri temizler (Türkçe harfler kalır). */
export function pdfFileName(base: string): string {
  const cleaned = base
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
  return `${cleaned || "belge"}.pdf`;
}

export async function downloadElementAsPdf(source: HTMLElement, fileNameBase: string): Promise<void> {
  // 1) Kaynağı ekran dışında, kısıtsız yükseklikte klonla — modal'ın
  //    max-height/overflow'u kanvasın kırpılmasına yol açmasın.
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-100000px";
  wrapper.style.top = "0";
  wrapper.style.width = `${source.offsetWidth || 640}px`;
  wrapper.style.background = "#ffffff";
  wrapper.style.zIndex = "-1";

  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.maxHeight = "none";
  clone.style.height = "auto";
  clone.style.overflow = "visible";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 2, // ~192dpi — metin baskıda net kalır
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const contentWmm = A4_WIDTH_MM - MARGIN_MM * 2;
    const contentHmm = A4_HEIGHT_MM - MARGIN_MM * 2;
    // Bir PDF sayfasına sığan kanvas yüksekliği (px)
    const pageHpx = Math.floor((canvas.width * contentHmm) / contentWmm);

    let rendered = 0;
    let pageIndex = 0;
    while (rendered < canvas.height) {
      const sliceHpx = Math.min(pageHpx, canvas.height - rendered);
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHpx;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D bağlamı alınamadı");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, rendered, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);

      if (pageIndex > 0) pdf.addPage();
      const sliceHmm = (sliceHpx * contentWmm) / canvas.width;
      pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", MARGIN_MM, MARGIN_MM, contentWmm, sliceHmm);

      rendered += sliceHpx;
      pageIndex += 1;
    }

    pdf.save(pdfFileName(fileNameBase));
  } finally {
    document.body.removeChild(wrapper);
  }
}
