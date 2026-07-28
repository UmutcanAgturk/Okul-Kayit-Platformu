"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Bu depodaki ilk gerçek giriş ekranı — demo/seviye360-app.html'in
 * localStorage tabanlı sahte giriş formunun aksine, doğrudan
 * /api/auth/login'e (bcrypt + imzalı oturum çerezi) karşı çalışır.
 * Seed verisiyle örnek giriş: merve.aslan@seviye360.com / seviye360dev-pw
 * (bkz. kök README.md "Yerel Geliştirme").
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Seviye 360</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kurum yönetim paneline giriş yapın.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              E-posta
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0071ce] focus:outline-none focus:ring-1 focus:ring-[#0071ce] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Şifre
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#0071ce] focus:outline-none focus:ring-1 focus:ring-[#0071ce] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#0071ce] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00558f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}
