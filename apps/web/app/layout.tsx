import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "./providers";
import { AppChrome } from "@/components/layout/AppChrome";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Seviye 360",
  description: "Seviye 360 - Kurum Yönetim Platformu",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={poppins.variable} suppressHydrationWarning>
      <head>
        <script
          // Elle seçilmiş temayı hidrasyon/ilk boyamadan ÖNCE uygular — aksi halde
          // localStorage'da "dark" kayıtlıyken sayfa bir an açık temayla çizilip
          // sonra koyuya geçer (flash-of-wrong-theme).
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("seviye360-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}`,
          }}
        />
      </head>
      <body style={{ fontFamily: "var(--font-poppins), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
