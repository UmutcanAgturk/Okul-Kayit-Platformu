"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

const STORAGE_KEY = "seviye360-theme";

type Theme = "light" | "dark";

function applyTheme(theme: Theme | null) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Demo'daki #theme-toggle butonunun karşılığı — şu ana kadar apps/web yalnızca
 * OS'un prefers-color-scheme tercihini takip ediyordu, elle değiştirilebilen
 * bir anahtar yoktu. localStorage'da kalıcı; yoksa OS tercihini kullanır
 * (bkz. app/layout.tsx'teki flash-önleyici inline script).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    setTheme(stored ?? (systemPrefersDark() ? "dark" : "light"));
  }, []);

  function toggle() {
    const next: Theme = (theme ?? (systemPrefersDark() ? "dark" : "light")) === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="btn sm"
      onClick={toggle}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      title={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
    >
      <Icon name={isDark ? "sun" : "moon"} />
    </button>
  );
}
