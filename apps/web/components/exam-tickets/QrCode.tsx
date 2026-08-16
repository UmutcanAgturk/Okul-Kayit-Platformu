"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div style={{ width: size, height: size, background: "var(--surface-sunken)", borderRadius: "var(--radius-sm)" }} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} width={size} height={size} alt="QR kod" style={{ borderRadius: "var(--radius-sm)" }} />;
}
