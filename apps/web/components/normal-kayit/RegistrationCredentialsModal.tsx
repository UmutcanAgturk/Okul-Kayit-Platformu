"use client";

import { useState } from "react";
import type { CompleteEnrollmentResult } from "@/lib/api/enrollments";

/**
 * Kayıt tamamlanınca açılan öne çıkan (modal) giriş bilgileri penceresi —
 * Normal Kayıt ve Öğrenci Ön Kayıt akışlarının İKİSİ tarafından da kullanılır
 * (bkz. NormalKayitView, EnrollmentsDashboard). Öğrenci ve (yeni açıldıysa)
 * veli giriş bilgilerini büyük/okunur biçimde gösterir, tek tıkla kopyalatır ve
 * veli e-postasına gönderim durumunu bildirir. İlk şifreler T.C. Kimlik No'dur
 * ve ilk girişte değiştirilmesi zorunludur — pencere bunu açıkça belirtir.
 */
function CredentialRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // pano erişimi yoksa sessizce geç
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-muted)" }}>{label}</div>
        <div style={{ fontFamily: "monospace", fontSize: "var(--text-base)", fontWeight: 700, letterSpacing: "0.02em" }}>{value}</div>
      </div>
      <button type="button" className="btn xs" onClick={copy} style={{ flexShrink: 0 }}>
        {copied ? "Kopyalandı ✓" : "Kopyala"}
      </button>
    </div>
  );
}

export function RegistrationCredentialsModal({
  result,
  onClose,
  onPrintContract,
}: {
  result: CompleteEnrollmentResult;
  onClose: () => void;
  onPrintContract?: () => void;
}) {
  const studentName = result.enrollment.candidateFullName;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", padding: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.35)" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 800 }}>Kayıt Tamamlandı</h2>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{studentName} — Giriş Bilgileri</p>
          </div>
          <button type="button" className="btn xs" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        <div style={{ marginTop: 14 }}>
          <p style={{ margin: "0 0 6px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--strong)" }}>Öğrenci Girişi</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <CredentialRow label="T.C. Kimlik No (kullanıcı adı)" value={result.credentials.username} />
            <CredentialRow label="İlk Şifre" value={result.credentials.password} />
          </div>
        </div>

        {result.parentCredentials && (
          <div style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--strong)" }}>Veli Portalı Girişi</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <CredentialRow label="T.C. Kimlik No (kullanıcı adı)" value={result.parentCredentials.username} />
              <CredentialRow label="İlk Şifre" value={result.parentCredentials.password} />
            </div>
          </div>
        )}

        {result.parentLinkedExisting && (
          <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            Bu T.C. Kimlik No ile kayıtlı bir veli hesabı zaten vardı — yeni hesap açılmadı, öğrenci mevcut veli hesabına bağlandı (kardeş kaydı). Veli önceki şifresiyle giriş yapar.
          </p>
        )}

        <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 8, background: "var(--warn-bg, #fff7ed)", border: "1px solid var(--warn, #f59e0b)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink)" }}>
            <b>Önemli:</b> İlk şifre T.C. Kimlik Numarasıdır. Öğrenci ve veli ilk girişte sistem tarafından <b>yeni bir şifre belirlemeye</b> yönlendirilir.
          </p>
        </div>

        <div style={{ marginTop: 12, fontSize: "var(--text-xs)" }}>
          {!result.guardianEmailProvided ? (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              📧 Veli e-postası girilmediği için otomatik e-posta gönderilmedi. Bilgileri yukarıdan kopyalayıp iletebilirsiniz.
            </p>
          ) : result.emailSent ? (
            <p style={{ margin: 0, color: "var(--success, #16a34a)", fontWeight: 600 }}>
              ✓ Giriş bilgileri velinin e-posta adresine gönderildi.
            </p>
          ) : result.emailSkipped ? (
            <p style={{ margin: 0, color: "var(--ink-muted)" }}>
              📧 E-posta servisi henüz yapılandırılmadığından gönderim yapılamadı. Bilgileri yukarıdan kopyalayıp iletebilirsiniz.
            </p>
          ) : (
            <p style={{ margin: 0, color: "var(--critical)" }}>
              ⚠ Veli e-postasına gönderim başarısız oldu. Bilgileri yukarıdan kopyalayıp elle iletin.
            </p>
          )}
        </div>

        {result.promissoryNotes.length > 0 && (
          <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
            Senet ödeme yöntemi seçildi — {result.promissoryNotes.length} senet oluşturuldu (Muhasebe &gt; Belgeler &gt; Senetler).
          </p>
        )}

        <div style={{ marginTop: 18, display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {onPrintContract && (
            <button type="button" className="btn" onClick={onPrintContract}>Kayıt Sözleşmesini Yazdır</button>
          )}
          <button type="button" className="btn primary" onClick={onClose}>Tamam</button>
        </div>
      </div>
    </div>
  );
}
