// demo/seviye360/seviye360-app.html'deki ICONS objesinden birebir taşındı
// (bkz. o dosyadaki `ic()` yardımcı fonksiyonu) — aynı ikon adları, aynı path'ler.
import type { SVGProps } from "react";

const PATHS: Record<string, React.ReactNode> = {
  map: <><path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2Z" /><path d="M9 3v16M15 5v16" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2V5Z" /><path d="M6 19h13V3" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="18" cy="9" r="2.6" /><path d="M15.5 14c2.9.3 5 2.4 5 6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  send: <path d="m3 11 18-8-8 18-2.5-7.5L3 11Z" />,
  chart: <><path d="M4 20V10M12 20V4M20 20v-7" /><path d="M2 20h20" /></>,
  kanban: <><rect x="3" y="4" width="4" height="16" rx="1" /><rect x="10" y="4" width="4" height="10" rx="1" /><rect x="17" y="4" width="4" height="13" rx="1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>,
  seat: <><rect x="4" y="4" width="16" height="10" rx="1.5" /><path d="M6 14v5M18 14v5M4 8h16" /></>,
  heart: <path d="M12 20s-7-4.3-9.5-9C1 7.6 3 4.5 6.3 4.5c2 0 3.3 1 4.7 2.7C12.4 5.5 13.7 4.5 15.7 4.5 19 4.5 21 7.6 19.5 11 17 15.7 12 20 12 20Z" />,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" /><circle cx="12" cy="13.5" r="3.3" /></>,
  road: <path d="M9 3 4 21M15 3l5 18M11.5 10h1M11 15h2" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="14.2" r="1.1" fill="currentColor" stroke="none" /></>,
  qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM19 14v3M14 19h3" /></>,
  check: <path d="M4 12.5 9.5 18 20 6" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  cardIcon: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></>,
  bank: <path d="M3 10 12 4l9 6M4 10v9M20 10v9M8 10v9M16 10v9M2 20h20" />,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></>,
  ledger: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7M9 8h3" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5.2 2 7 2 7H4s2-1.8 2-7Z" /><path d="M9.5 20a2.5 2.5 0 0 0 5 0" /></>,
  attach: <path d="M17 7 8.4 15.6a3 3 0 0 0 4.24 4.24L21 11.5a5 5 0 0 0-7.07-7.07L5.5 12.86" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  trophy: <><path d="M7 4h10v6a5 5 0 0 1-10 0V4Z" /><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5M12 15v3M8 21h8M9 21v-2.5h6V21" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.8-4.8" /></>,
  star: <path d="m12 3 2.7 5.9 6.3.7-4.7 4.4 1.3 6.2L12 17l-5.6 3.2 1.3-6.2L3 9.6l6.3-.7L12 3Z" />,
  shield: <><path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></>,
  flag: <path d="M5 21V4M5 5h13l-3 4 3 4H5" />,
  bus: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M3 10h18M7 17v3M17 17v3" /><circle cx="7.5" cy="17" r="1.2" fill="currentColor" stroke="none" /><circle cx="16.5" cy="17" r="1.2" fill="currentColor" stroke="none" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9.5a2.8 2.8 0 1 1 3.8 2.6c-.9.4-1.4 1-1.4 1.9" /><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none" /></>,
  download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>,
  sun: <><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  inbox: <><path d="M4 12h4.5l1.5 3h4l1.5-3H20" /><path d="M5.5 5h13l1.5 7v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6l1.5-7Z" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
};

export function Icon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg className="icon" viewBox="0 0 24 24" {...props}>
      {PATHS[name] ?? PATHS.grid}
    </svg>
  );
}
