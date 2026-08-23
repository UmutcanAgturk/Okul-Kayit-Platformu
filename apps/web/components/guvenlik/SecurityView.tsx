"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, setup2fa, enable2fa, disable2fa } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/**
 * İki faktörlü doğrulama (TOTP) self-servis yönetimi — TÜM roller için.
 * demo'da karşılığı yoktu; gerçek güvenlik katmanı (bkz. lib/totp.ts,
 * app/api/me/2fa/*, /api/auth/login/verify).
 */
export function SecurityView() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });

  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Kapatma için
  const [disablePassword, setDisablePassword] = useState("");

  const enabled = !!meQuery.data?.twoFactorEnabled;

  async function startSetup() {
    setError(null); setNotice(null); setBusy(true);
    try {
      const d = await setup2fa();
      setSetupData({ qrDataUrl: d.qrDataUrl, secret: d.secret });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Kurulum başlatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await enable2fa(code);
      setSetupData(null); setCode("");
      setNotice("İki faktörlü doğrulama etkinleştirildi. Bundan sonraki girişlerde kod istenecek.");
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      // Güncel kod veya şifre ile kapatılabilir; burada şifreyi kullanıyoruz.
      await disable2fa({ password: disablePassword });
      setDisablePassword("");
      setNotice("İki faktörlü doğrulama kapatıldı.");
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kapatılamadı.");
    } finally {
      setBusy(false);
    }
  }

  if (meQuery.isLoading) {
    return <div className="screen"><p style={{ color: "var(--ink-muted)" }}>Yükleniyor…</p></div>;
  }

  return (
    <div className="screen">
      <h1>Güvenlik</h1>
      <p className="lede">İki faktörlü doğrulama (2FA), hesabınıza şifrenizin yanında bir de authenticator kodu gerektirir.</p>

      {notice && (
        <p className="chip success" style={{ display: "block", padding: "10px 14px", marginBottom: 16 }}>{notice}</p>
      )}
      {error && (
        <p className="chip critical" style={{ display: "block", padding: "10px 14px", marginBottom: 16, fontWeight: 600 }}>{error}</p>
      )}

      <div className="card card-pad" style={{ maxWidth: 520 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <strong>İki Faktörlü Doğrulama</strong>
          <span className={`chip ${enabled ? "success" : ""}`} style={{ fontSize: 12 }}>
            {enabled ? "Etkin" : "Kapalı"}
          </span>
        </div>

        {/* KAPALI ve kurulum başlamadı */}
        {!enabled && !setupData && (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 0 }}>
              Google Authenticator, Microsoft Authenticator veya Authy gibi bir uygulama gerekir.
            </p>
            <button className="btn primary" onClick={startSetup} disabled={busy}>
              {busy ? "Hazırlanıyor…" : "Kurulumu Başlat"}
            </button>
          </>
        )}

        {/* KURULUM: QR + kod doğrulama */}
        {!enabled && setupData && (
          <form onSubmit={confirmEnable} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: 13, margin: 0 }}>1) Authenticator uygulamanızla bu QR kodu tarayın:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setupData.qrDataUrl} alt="2FA QR" style={{ width: 200, height: 200, alignSelf: "center", border: "1px solid var(--border)", borderRadius: 8 }} />
            <p style={{ fontSize: 12, color: "var(--ink-muted)", margin: 0, textAlign: "center" }}>
              QR taranamıyorsa elle girin:<br />
              <code style={{ fontSize: 12, wordBreak: "break-all" }}>{setupData.secret}</code>
            </p>
            <div className="field">
              <label htmlFor="enable-code">2) Uygulamadaki 6 haneli kodu girin</label>
              <input
                id="enable-code" type="text" inputMode="numeric" maxLength={6} required autoFocus
                placeholder="000000" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                style={{ letterSpacing: "0.3em", fontSize: 18, textAlign: "center" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" className="btn primary" disabled={busy}>{busy ? "Doğrulanıyor…" : "Etkinleştir"}</button>
              <button type="button" className="btn" onClick={() => { setSetupData(null); setCode(""); }}>Vazgeç</button>
            </div>
          </form>
        )}

        {/* ETKİN: kapatma */}
        {enabled && (
          <form onSubmit={confirmDisable} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: 0 }}>
              Girişleriniz artık authenticator kodu gerektiriyor. Kapatmak için hesap şifrenizi girin.
            </p>
            <div className="field">
              <label htmlFor="disable-pw">Hesap Şifresi</label>
              <input
                id="disable-pw" type="password" required autoComplete="current-password"
                value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)}
              />
            </div>
            <button type="submit" className="btn" style={{ color: "var(--danger, #b91c1c)" }} disabled={busy}>
              {busy ? "Kapatılıyor…" : "İki Faktörlü Doğrulamayı Kapat"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
