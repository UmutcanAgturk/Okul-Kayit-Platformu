"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, verifyLogin2fa } from "@/lib/api/auth";
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
 *
 * İki faktörlü doğrulama açık bir hesapta giriş iki adımlıdır: şifre doğru
 * girilince backend `mfaRequired` döner, form ikinci adıma (authenticator
 * kodu) geçer (bkz. /api/auth/login/verify, lib/totp.ts).
 */
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // İkinci adım (2FA) durumu
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await login(identifier, password);
      if ("mfaRequired" in res && res.mfaRequired) {
        setMfaToken(res.mfaToken);
        setSubmitting(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı. Lütfen tekrar deneyin.");
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await verifyLogin2fa(mfaToken, code);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.");
      setSubmitting(false);
    }
  }

  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--surface-2)", padding: "16px" }}>
      <div className="card card-pad" style={{ width: "100%", maxWidth: 380 }}>
        <div className="brand-block" style={{ padding: 0, marginBottom: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/seviye360-logo.png" alt="Seviye 360" style={{ height: 60, width: "auto", display: "block" }} />
          <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            {mfaToken ? "İki faktörlü doğrulama" : "Kurum yönetim paneline giriş yapın."}
          </p>
        </div>

        {!mfaToken ? (
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
        ) : (
          <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
              Authenticator uygulamanızdaki 6 haneli kodu girin.
            </p>
            <div className="field">
              <label htmlFor="code">Doğrulama Kodu</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                autoFocus
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }}
              />
            </div>

            {error && (
              <p className="chip critical" style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "8px 12px", fontWeight: 600 }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={submitting} className="btn primary" style={{ width: "100%", justifyContent: "center" }}>
              {submitting ? "Doğrulanıyor…" : "Doğrula ve Giriş Yap"}
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => { setMfaToken(null); setCode(""); setError(null); }}
            >
              Geri
            </button>
          </form>
        )}

        <p style={{ marginTop: 16, fontSize: 11.5, color: "var(--ink-muted)", textAlign: "center" }}>
          Giriş yaparak <a href="/kvkk" style={{ color: "var(--brand, #208AEF)" }}>KVKK Aydınlatma Metni</a>ni okuduğunuzu kabul edersiniz.
        </p>
      </div>
    </main>
  );
}
