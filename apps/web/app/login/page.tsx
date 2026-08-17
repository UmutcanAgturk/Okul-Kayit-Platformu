"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * Bu depodaki ilk gerçek giriş ekranı — demo/seviye360-app.html'in
 * localStorage tabanlı sahte giriş formunun aksine, doğrudan
 * /api/auth/login'e (bcrypt + imzalı oturum çerezi) karşı çalışır.
 *
 * Tek bir "identifier" alanı hem personel e-postasını/kullanıcı adını hem
 * de Öğrenci/Veli'nin T.C. Kimlik No'sunu kabul eder (bkz.
 * app/api/auth/login/route.ts) — Öğrenci/Veli rolleri yalnızca TC Kimlik No
 * ile girebilir, e-postalarını bilseler bile backend reddeder.
 */
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı. Lütfen tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--surface-2)", padding: "16px" }}>
      <div className="card card-pad" style={{ width: "100%", maxWidth: 380 }}>
        <div className="brand-block" style={{ padding: 0, marginBottom: 22 }}>
          <div className="mark" style={{ fontSize: 20 }}>Seviye 360</div>
          <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            Kurum yönetim paneline giriş yapın.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label htmlFor="identifier">Kullanıcı Adı / T.C. Kimlik No</label>
            <input
              id="identifier"
              type="text"
              required
              autoComplete="username"
              placeholder="Personel: kullanıcı adı · Öğrenci/Veli: T.C. Kimlik No"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Şifre</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="chip critical" style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "8px 12px", fontWeight: 600 }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={submitting} className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
            {submitting ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </div>
    </main>
  );
}
