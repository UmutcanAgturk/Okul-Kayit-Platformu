"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  fetchSelfPaymentReceipts,
  fetchStudentInstallments,
  paySelfInstallment,
  submitPaymentReceipt,
  type SelfInstallmentRow,
} from "@/lib/api/self-payments";
import {
  fetchPaymentMethodCatalog,
  INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL,
  type InstitutionPaymentMethodRow,
} from "@/lib/api/payment-methods";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import { useHqStudentRoster } from "@/lib/hq-student-roster";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_FILE_SIZE = 2_500_000;
const DEMO_OTP_CODE = "123456";

function ReceiptUploadForm({
  studentId,
  installmentId,
  onDone,
}: {
  studentId: string;
  installmentId: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError(400, "Lütfen dekont dosyanızı yükleyin.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new ApiError(400, "Dosya okunamadı."));
        reader.readAsDataURL(file);
      });
      return submitPaymentReceipt(studentId, { installmentId, fileName: file.name, mimeType: file.type, dataUrl, note: note || undefined });
    },
    onSuccess: () => onDone(),
    onError: (e) => setError(e instanceof ApiError ? e.message : "Dekont gönderilemedi."),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError(null);
    if (f && !ACCEPTED_MIME_TYPES.includes(f.type)) {
      setError("Yalnızca resim veya PDF dosyaları kabul edilir.");
      setFile(null);
      return;
    }
    if (f && f.size > MAX_FILE_SIZE) {
      setError("Dosya çok büyük (limit ~2,5MB).");
      setFile(null);
      return;
    }
    setFile(f);
  }

  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--surface-sunken, var(--surface))", border: "1px solid var(--border)" }}>
      <div className="field">
        <label>Dekont / Makbuz Yükle</label>
        <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
      </div>
      <div className="field" style={{ marginTop: 8 }}>
        <label>Not (opsiyonel)</label>
        <input type="text" placeholder="Örn. Havale saat 14:20'de yapıldı" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      <button
        type="button"
        className="btn primary xs"
        style={{ marginTop: 8 }}
        disabled={submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? "Gönderiliyor…" : "Dekontu Gönder — Şube Onayına Sun"}
      </button>
    </div>
  );
}

type PaymentMethodChoice = "KART" | "HAVALE" | "NAKIT";

/**
 * Kredi kartı akışı — demo/seviye360-app.html'deki renderGuardianCardFlow'un
 * karşılığı: sahte kart formu + sahte 3D Secure OTP adımı (gerçek bir ödeme
 * sağlayıcısı YOKTUR, OTP kodu demo'daki gibi sabit "123456"). Doğrulama
 * başarılı olunca gerçek taksit-öde endpoint'i (paySelfInstallment) çağrılır.
 */
function CardPaymentFlow({ onPay, paying, error }: { onPay: () => void; paying: boolean; error?: string }) {
  const [step, setStep] = useState<"form" | "otp">("form");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [otp, setOtp] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  function handleSubmitCard(e: React.FormEvent) {
    e.preventDefault();
    const digits = cardNumber.replace(/\s/g, "");
    if (!cardName.trim() || !/^\d{16}$/.test(digits) || !/^\d{2}\/\d{2}$/.test(expiry) || !/^\d{3}$/.test(cvc)) {
      setFormError("Kart bilgilerini kontrol edin: 16 haneli kart no, AA/YY son kullanma, 3 haneli CVC.");
      return;
    }
    setFormError(null);
    setStep("otp");
  }

  function handleSubmitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp !== DEMO_OTP_CODE) {
      setOtpError(`Kod hatalı. (Demo kodu: ${DEMO_OTP_CODE})`);
      return;
    }
    setOtpError(null);
    onPay();
  }

  if (step === "otp") {
    return (
      <form onSubmit={handleSubmitOtp} style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--surface-sunken, var(--surface))", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          3D Secure — bankanızın gönderdiği tek kullanımlık kodu girin. (Demo ortamı: <b>{DEMO_OTP_CODE}</b>)
        </p>
        <div className="field">
          <label>SMS Doğrulama Kodu</label>
          <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="123456" />
        </div>
        {(otpError || error) && <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{otpError ?? error}</p>}
        <button type="submit" className="btn primary xs" disabled={paying}>
          {paying ? "Onaylanıyor…" : "Ödemeyi Onayla"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmitCard} style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--surface-sunken, var(--surface))", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="field">
        <label>Kart Üzerindeki Ad Soyad</label>
        <input value={cardName} onChange={(e) => setCardName(e.target.value)} />
      </div>
      <div className="field">
        <label>Kart Numarası</label>
        <input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="•••• •••• •••• ••••" maxLength={19} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Son Kullanma (AA/YY)</label>
          <input value={expiry} onChange={(e) => setExpiry(e.target.value)} placeholder="12/28" maxLength={5} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>CVC</label>
          <input value={cvc} onChange={(e) => setCvc(e.target.value)} placeholder="123" maxLength={3} />
        </div>
      </div>
      {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{formError}</p>}
      <button type="submit" className="btn primary xs">
        Devam Et — 3D Secure
      </button>
    </form>
  );
}

function TransferPaymentFlow({
  studentId,
  installmentId,
  catalog,
  onDone,
}: {
  studentId: string;
  installmentId: string;
  catalog: InstitutionPaymentMethodRow[];
  onDone: () => void;
}) {
  const method = catalog.find((m) => m.type === "BANKA_HAVALESI");
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ padding: 10, borderRadius: 8, background: "var(--surface-sunken, var(--surface))", border: "1px solid var(--border)" }}>
        {method ? (
          <>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600 }}>{method.label}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-sm)" }}>
              {INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL.BANKA_HAVALESI}: <b>{method.extra ?? "—"}</b>
            </p>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Şube henüz bir banka hesabı kaydetmedi.</p>
        )}
        <p style={{ margin: "6px 0 0", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
          Açıklama kısmına öğrenci adını ve taksit numarasını yazmayı unutmayın. Havale sonrası dekontunuzu aşağıdan yükleyin.
        </p>
      </div>
      <ReceiptUploadForm studentId={studentId} installmentId={installmentId} onDone={onDone} />
    </div>
  );
}

function CashPaymentFlow({ catalog }: { catalog: InstitutionPaymentMethodRow[] }) {
  const method = catalog.find((m) => m.type === "NAKIT");
  return (
    <div style={{ marginTop: 8, padding: 10, borderRadius: 8, background: "var(--surface-sunken, var(--surface))", border: "1px solid var(--border)" }}>
      <p style={{ margin: 0, fontSize: "var(--text-sm)" }}>
        Nakit ödemeler yalnızca şubede, elden teslim sırasında kayda alınır. Bu ekrandan nakit ödeme işaretlenemez.
      </p>
      {method?.extra && (
        <p style={{ margin: "6px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          {INSTITUTION_PAYMENT_METHOD_EXTRA_LABEL.NAKIT}: <b>{method.extra}</b>
        </p>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<SelfInstallmentRow["status"], string> = {
  PENDING: "Bekliyor",
  PAID: "Ödendi",
  OVERDUE: "Gecikti",
  CANCELLED: "İptal",
};
const STATUS_CHIP: Record<SelfInstallmentRow["status"], string> = {
  PENDING: "weak",
  PAID: "strong",
  OVERDUE: "critical",
  CANCELLED: "neutral",
};

const RECEIPT_STATUS_LABEL: Record<string, string> = {
  BEKLIYOR: "İnceleniyor",
  ONAYLANDI: "Onaylandı",
  REDDEDILDI: "Reddedildi",
};
const RECEIPT_STATUS_CHIP: Record<string, string> = {
  BEKLIYOR: "weak",
  ONAYLANDI: "strong",
  REDDEDILDI: "critical",
};

function tl(amount: string | number) {
  return "₺" + Math.round(Number(amount)).toLocaleString("tr-TR");
}

/**
 * Ödeme İşlemleri — demo/seviye360-app.html'deki "student:payment" (yalnızca
 * veli) ekranının gerçek karşılığı. Gerçek bir ödeme sağlayıcısı entegrasyonu
 * YOKTUR — KART akışı sahte bir 3D Secure adımından sonra taksidi doğrudan
 * ödendi işaretler (bkz. app/api/students/[id]/installments/[id]/pay);
 * HAVALE akışı şubenin kayıtlı IBAN'ını gösterip dekont yükletir (onay şube
 * personelinde); NAKİT akışı yalnızca bilgilendirme amaçlıdır (demo'daki gibi
 * nakit yalnızca elden teslimde kayda alınır, bu ekrandan işaretlenemez).
 */
export function SelfPaymentsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorByInstallment, setErrorByInstallment] = useState<Record<string, string>>({});
  const [openFlowId, setOpenFlowId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethodChoice | null>(null);

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const isHq = me?.role === "SUPERADMIN";
  const hqRoster = useHqStudentRoster(isHq && !!me?.actingTenantId);
  const students = isHq ? hqRoster : (me?.students ?? []);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (isHq) setSelectedStudentId(null);
  }, [isHq, me?.actingTenantId]);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const installmentsQuery = useQuery({
    queryKey: ["self-installments", selectedStudentId],
    queryFn: () => fetchStudentInstallments(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const receiptsQuery = useQuery({
    queryKey: ["self-payment-receipts", selectedStudentId],
    queryFn: () => fetchSelfPaymentReceipts(selectedStudentId!),
    enabled: !!selectedStudentId,
  });
  const catalogQuery = useQuery({
    queryKey: ["self-payment-method-catalog"],
    queryFn: fetchPaymentMethodCatalog,
    enabled: !!me,
  });

  const payMutation = useMutation({
    mutationFn: (installmentId: string) => paySelfInstallment(selectedStudentId!, installmentId),
    onSuccess: (_result, installmentId) => {
      setErrorByInstallment((prev) => ({ ...prev, [installmentId]: "" }));
      setOpenFlowId(null);
      setMethod(null);
      queryClient.invalidateQueries({ queryKey: ["self-installments", selectedStudentId] });
    },
    onError: (err, installmentId) => {
      setErrorByInstallment((prev) => ({
        ...prev,
        [installmentId]: err instanceof ApiError ? err.message : "Ödeme yapılamadı.",
      }));
    },
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (me.role !== "PARENT" && !isHq) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ödeme İşlemleri yalnızca Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const installments = installmentsQuery.data?.installments ?? [];
  const receipts = receiptsQuery.data?.receipts ?? [];
  const catalog = catalogQuery.data?.methods ?? [];

  const totalTuition = installments.reduce((sum, i) => sum + Number(i.amount), 0);
  const paidInstallments = installments.filter((i) => i.status === "PAID");
  const remainingBalance = installments.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED").reduce((sum, i) => sum + Number(i.amount), 0);
  const nextDue = installments
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  return (
    <div className="screen">
      <h1>Ödeme İşlemleri</h1>
      <p className="lede">Çocuğunuzun taksit durumu ve ödeme işlemleri.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => {
                setSelectedStudentId(s.studentId);
                setOpenFlowId(null);
                setMethod(null);
              }}
              className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {installments.length > 0 && (
        <div className="grid cols-3" style={{ marginBottom: 16 }}>
          <div className="card stat-card">
            <p className="stat-label">Toplam Ücret</p>
            <p className="stat-value">{tl(totalTuition)}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Ödenen</p>
            <p className="stat-value">
              {paidInstallments.length}/{installments.length} taksit
            </p>
          </div>
          <div className={`card stat-card ${remainingBalance > 0 ? "tone-weak" : ""}`}>
            <p className="stat-label">Kalan Bakiye</p>
            <p className="stat-value">{tl(remainingBalance)}</p>
            {nextDue && (
              <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                Sonraki vade: {new Date(nextDue.dueDate).toLocaleDateString("tr-TR")}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        {installmentsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : installments.length === 0 ? (
          <div className="empty-state">
            <Icon name="wallet" />
            <p>Henüz tanımlı bir taksit yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Vade</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {installments
                  .sort((a, b) => a.installmentNo - b.installmentNo)
                  .map((i) => {
                    const pendingReceipt = receipts.find((r) => r.installmentId === i.id && r.status === "BEKLIYOR");
                    const canAct = i.status === "PENDING" || i.status === "OVERDUE";
                    const flowOpen = openFlowId === i.id;
                    return (
                      <Fragment key={i.id}>
                        <tr>
                          <td>{i.installmentNo}</td>
                          <td>{new Date(i.dueDate).toLocaleDateString("tr-TR")}</td>
                          <td>{tl(i.amount)}</td>
                          <td>
                            <span className={`chip ${STATUS_CHIP[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                          </td>
                          <td>
                            {pendingReceipt ? (
                              <span className="chip weak">Dekont İnceleniyor</span>
                            ) : canAct ? (
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                                <button
                                  type="button"
                                  className={`btn xs ${flowOpen ? "primary" : ""}`}
                                  onClick={() => {
                                    if (flowOpen) {
                                      setOpenFlowId(null);
                                      setMethod(null);
                                    } else {
                                      setOpenFlowId(i.id);
                                      setMethod(null);
                                    }
                                  }}
                                >
                                  {flowOpen ? "Vazgeç" : "Öde"}
                                </button>
                                {errorByInstallment[i.id] && (
                                  <span style={{ fontSize: "var(--text-2xs)", color: "var(--critical)" }}>{errorByInstallment[i.id]}</span>
                                )}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                        {flowOpen && selectedStudentId && (
                          <tr>
                            <td colSpan={5}>
                              {!method ? (
                                <div style={{ display: "flex", gap: 8, padding: "8px 0" }}>
                                  <button type="button" className="btn sm" onClick={() => setMethod("KART")}>
                                    Kredi Kartı
                                  </button>
                                  <button type="button" className="btn sm" onClick={() => setMethod("HAVALE")}>
                                    Banka Havalesi
                                  </button>
                                  <button type="button" className="btn sm" onClick={() => setMethod("NAKIT")}>
                                    Nakit
                                  </button>
                                </div>
                              ) : method === "KART" ? (
                                <CardPaymentFlow
                                  onPay={() => payMutation.mutate(i.id)}
                                  paying={payMutation.isPending}
                                  error={errorByInstallment[i.id] || undefined}
                                />
                              ) : method === "HAVALE" ? (
                                <TransferPaymentFlow
                                  studentId={selectedStudentId}
                                  installmentId={i.id}
                                  catalog={catalog}
                                  onDone={() => {
                                    setOpenFlowId(null);
                                    setMethod(null);
                                    queryClient.invalidateQueries({ queryKey: ["self-payment-receipts", selectedStudentId] });
                                  }}
                                />
                              ) : (
                                <CashPaymentFlow catalog={catalog} />
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receipts.length > 0 && (
        <div className="card card-pad">
          <div className="card-head">
            <h3>Dekont Gönderim Geçmişim</h3>
            <span className="hint">{receipts.length} kayıt</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[...receipts]
              .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
              .map((r) => {
                const installment = installments.find((i) => i.id === r.installmentId);
                return (
                  <div
                    key={r.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
                        {installment ? `Taksit #${installment.installmentNo}` : "Taksit"}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                        {new Date(r.submittedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                        {r.note ? ` · ${r.note}` : ""}
                      </div>
                    </div>
                    <span className={`chip ${RECEIPT_STATUS_CHIP[r.status]}`}>{RECEIPT_STATUS_LABEL[r.status]}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
