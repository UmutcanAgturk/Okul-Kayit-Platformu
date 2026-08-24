"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  completeEnrollment,
  enrollmentKeys,
  fetchEnrollments,
  GENDER_OPTIONS,
  GRADE_LEVEL_LABEL,
  PAYMENT_METHOD_LABEL,
  type CompleteEnrollmentResult,
  type PaymentMethodChoice,
} from "@/lib/api/enrollments";
import { fetchBusRoutes } from "@/lib/api/bus-routes";
import { fetchBranchClassrooms } from "@/lib/api/students-roster";
import { Icon } from "@/components/ui/icons";
import { BulkImportPanel } from "./BulkImportPanel";
import { RegistrationCredentialsModal } from "./RegistrationCredentialsModal";
import { PrintDocumentViewer } from "@/components/documents/PrintDocumentViewer";
import { EnrollmentContractPrintBody } from "@/components/documents/DocumentPrintBodies";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const LOCKED_STAGES = ["KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];
const ACCEPTED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PHOTO_FILE_SIZE = 2_500_000;

/**
 * Normal Kayıt (Tekli Dönüştürme) — demo/seviye360-app.html'deki
 * "branch:normalkayit" ekranının gerçek karşılığı. Demo'nun kendi notunda
 * bile belirttiği gibi ("apps/web/app/api/branch/enrollments/[id]/complete
 * — gerçek Postgres + RLS'ye karşı doğrulandı") bu, Öğrenci Ön Kayıt
 * (bkz. components/enrollments/EnrollmentsDashboard.tsx) sayfasındaki
 * "Kaydı Tamamla" ile AYNI API'dir — burada tam CRUD listesi yerine tek bir
 * adaya odaklanan, demo'daki "liste + panel" düzenini birebir yansıtan
 * ayrı bir giriş noktası sunulur (Toplu Yükleme modu ayrı bir modülde).
 */
export function NormalKayitView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"tekli" | "toplu">("tekli");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState("1");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [nationalId, setNationalId] = useState("");
  const [guardianNationalId, setGuardianNationalId] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [targetClassroomId, setTargetClassroomId] = useState("");
  const [busRouteId, setBusRouteId] = useState("");
  const [paymentMethodType, setPaymentMethodType] = useState<PaymentMethodChoice>("KREDI_KARTI");
  const [contractAccepted, setContractAccepted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CompleteEnrollmentResult["credentials"] | null>(null);
  const [lastCompleted, setLastCompleted] = useState<CompleteEnrollmentResult | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

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

  const enrollmentsQuery = useQuery({ queryKey: enrollmentKeys.list(), queryFn: () => fetchEnrollments(), enabled: !!me });
  const busRoutesQuery = useQuery({ queryKey: ["bus-routes"], queryFn: fetchBusRoutes, enabled: !!me });
  const classroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms, enabled: !!me });

  const completeMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof completeEnrollment>[1] }) => completeEnrollment(vars.id, vars.input),
    onSuccess: (result) => {
      setCredentials(result.credentials);
      setLastCompleted(result);
      setShowCredentials(true);
      setFormError(null);
      setPhotoDataUrl(null);
      setPhotoError(null);
      setNationalId("");
      setGuardianNationalId("");
      setGuardianEmail("");
      setBirthDate("");
      setGender("");
      setPhone("");
      setTargetClassroomId("");
      setBusRouteId("");
      setContractAccepted(false);
      queryClient.invalidateQueries({ queryKey: enrollmentKeys.list() });
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kayıt tamamlanamadı."),
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Normal Kayıt yalnızca Şube Yöneticisi/Rehber Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const allEnrollments = enrollmentsQuery.data?.enrollments ?? [];
  const pending = allEnrollments.filter((e) => !LOCKED_STAGES.includes(e.stage));
  // Tamamlama sonrası aday `pending`den çıkar (stage artık KAYIT_TAMAMLANDI) —
  // yine de `allEnrollments` içinde arayarak panelin başka bir adaya
  // ATLAMASINI önlüyoruz, az önce üretilen kimlik bilgileri doğru adayla
  // birlikte görünmeye devam etsin diye.
  const selected = allEnrollments.find((e) => e.id === selectedId) ?? pending[0] ?? null;
  const selectedIsCompleted = selected ? LOCKED_STAGES.includes(selected.stage) : false;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setPhotoError(null);
    if (!file) return;
    if (!ACCEPTED_PHOTO_MIME_TYPES.includes(file.type)) {
      setPhotoError("Yalnızca JPEG, PNG, WEBP veya GIF görsel yükleyebilirsiniz.");
      return;
    }
    if (file.size > MAX_PHOTO_FILE_SIZE) {
      setPhotoError("Fotoğraf dosyası çok büyük (limit ~2,5MB).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Dosya okunamadı."));
      reader.readAsDataURL(file);
    });
    setPhotoDataUrl(dataUrl);
  }

  function submitComplete() {
    if (!selected) return;
    const count = Number(installmentCount);
    const amount = Number(installmentAmount);
    if (!count || count < 1 || !amount || amount <= 0 || !firstDueDate) {
      setFormError("Taksit sayısı, tutarı ve ilk vade tarihi zorunludur.");
      return;
    }
    if (!/^\d{11}$/.test(nationalId)) {
      setFormError("Öğrencinin T.C. Kimlik Numarası 11 haneli olmalıdır.");
      return;
    }
    if (!/^\d{11}$/.test(guardianNationalId)) {
      setFormError("Velinin T.C. Kimlik Numarası 11 haneli olmalıdır (giriş bununla yapılır).");
      return;
    }
    if (!contractAccepted) {
      setFormError("Devam etmek için veli, kayıt sözleşmesini onaylamalıdır.");
      return;
    }
    setFormError(null);
    completeMutation.mutate({
      id: selected.id,
      input: {
        installmentCount: count,
        installmentAmount: amount,
        firstDueDate,
        nationalId,
        guardianNationalId,
        guardianEmail: guardianEmail.trim() || undefined,
        birthDate: birthDate || undefined,
        gender: gender || undefined,
        phone: phone || undefined,
        targetClassroomId: targetClassroomId || undefined,
        busRouteId: busRouteId || undefined,
        contractAccepted,
        paymentMethodType,
        photoDataUrl: photoDataUrl || undefined,
      },
    });
  }

  return (
    <div className="screen">
      <h1>Normal Kayıt</h1>
      <p className="lede">
        {mode === "tekli"
          ? "Ön kaydı olan bir adayı sözleşme ve ödeme planıyla tam kayda dönüştürün."
          : "CSV'den birden çok öğrenciyi tek seferde içe aktarın — ön kayıt gerektirmez, doğrudan tam kayıt oluşturur."}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button type="button" className={`btn sm ${mode === "tekli" ? "primary" : ""}`} onClick={() => setMode("tekli")}>
          Tekli Dönüştürme
        </button>
        <button type="button" className={`btn sm ${mode === "toplu" ? "primary" : ""}`} onClick={() => setMode("toplu")}>
          Toplu Yükleme
        </button>
      </div>

      {mode === "toplu" ? (
        <BulkImportPanel />
      ) : (
      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Ön Kayıtlı Adaylar</h3>
            <span className="hint">Dönüştürülmeyi bekliyor</span>
          </div>
          {enrollmentsQuery.isLoading ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
          ) : pending.length === 0 ? (
            <div className="empty-state">
              <Icon name="check" />
              <p>Dönüştürülmeyi bekleyen aday yok.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pending.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(e.id);
                    setCredentials(null);
                    setFormError(null);
                    setPhotoDataUrl(null);
                    setPhotoError(null);
                  }}
                  className={`nav-item ${selected?.id === e.id ? "active" : ""}`}
                  style={{ textAlign: "left" }}
                >
                  <span>
                    <b>{e.candidateFullName}</b>
                    <span className="sub">{e.guardianFullName} · {e.guardianPhone}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card card-pad">
          {!selected ? (
            <div className="empty-state">
              <Icon name="users" />
              <p>Soldan bir aday seçin.</p>
            </div>
          ) : (
            <>
              <div className="card-head">
                <h3>{selected.candidateFullName} — Kaydı Tamamla</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {selectedIsCompleted && !credentials ? (
                  <div className="empty-state">
                    <Icon name="check" />
                    <p>Bu aday zaten tam kayda dönüştürülmüş.</p>
                  </div>
                ) : (
                  <>
                    <div className="field">
                      <label>Öğrenci Fotoğrafı (opsiyonel)</label>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {photoDataUrl && (
                          <img
                            src={photoDataUrl}
                            alt="Önizleme"
                            style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border-strong)", flexShrink: 0 }}
                          />
                        )}
                        <input type="file" accept="image/*" onChange={handlePhotoChange} />
                      </div>
                      {photoError && <p style={{ margin: "4px 0 0", fontSize: "var(--text-2xs)", color: "var(--critical)" }}>{photoError}</p>}
                    </div>
                    <div className="grid cols-2">
                      <div className="field">
                        <label>
                          Öğrenci T.C. Kimlik Numarası <span style={{ color: "var(--critical)" }}>*</span>
                        </label>
                        <input value={nationalId} onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="11 haneli" inputMode="numeric" />
                      </div>
                      <div className="field">
                        <label>
                          Veli T.C. Kimlik Numarası <span style={{ color: "var(--critical)" }}>*</span>
                        </label>
                        <input value={guardianNationalId} onChange={(e) => setGuardianNationalId(e.target.value.replace(/\D/g, ""))} maxLength={11} placeholder="11 haneli" inputMode="numeric" />
                      </div>
                    </div>
                    <div className="field">
                      <label>Veli E-postası (opsiyonel)</label>
                      <input
                        type="email"
                        value={guardianEmail}
                        onChange={(e) => setGuardianEmail(e.target.value)}
                        placeholder="ornek@eposta.com"
                        inputMode="email"
                        autoCapitalize="none"
                      />
                      <p style={{ margin: "4px 0 0", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
                        Girilirse öğrenci ve veli giriş bilgileri kayıt tamamlanınca bu adrese otomatik gönderilir.
                      </p>
                    </div>
                    <div className="grid cols-2">
                      <div className="field">
                        <label>Doğum Tarihi</label>
                        <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Cinsiyet</label>
                        <select value={gender} onChange={(e) => setGender(e.target.value)}>
                          <option value="">Seçiniz</option>
                          {GENDER_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid cols-2">
                      <div className="field">
                        <label>Servis/Ulaşım (opsiyonel)</label>
                        <select value={busRouteId} onChange={(e) => setBusRouteId(e.target.value)}>
                          <option value="">Servis yok</option>
                          {(busRoutesQuery.data?.routes ?? []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label>Telefon Numarası (opsiyonel)</label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xx xxx xx xx" />
                      </div>
                    </div>
                    <div className="grid cols-2">
                      <div className="field">
                        <label>Hedef Sınıf (opsiyonel)</label>
                        <select value={targetClassroomId} onChange={(e) => setTargetClassroomId(e.target.value)}>
                          <option value="">— Atanmamış —</option>
                          {(classroomsQuery.data?.classrooms ?? [])
                            .filter((c) => c.gradeLevel === selected.candidateGradeLevel)
                            .map((c) => {
                              const full = c.studentCount >= c.capacity;
                              return (
                                <option key={c.id} value={c.id} disabled={full}>
                                  {c.name} ({c.studentCount}/{c.capacity}){full ? " — Dolu" : ""}
                                </option>
                              );
                            })}
                        </select>
                        {(classroomsQuery.data?.classrooms ?? []).filter((c) => c.gradeLevel === selected.candidateGradeLevel).length === 0 && (
                          <p style={{ margin: "4px 0 0", fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
                            Bu düzeyde şube yok — Sınıf Atama&apos;dan oluşturabilirsiniz.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid cols-3">
                      <div className="field">
                        <label>Taksit Sayısı</label>
                        <input type="number" min="1" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>Taksit Tutarı (₺)</label>
                        <input type="number" min="0" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
                      </div>
                      <div className="field">
                        <label>İlk Vade</label>
                        <input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Ödeme Yöntemi</label>
                      <select value={paymentMethodType} onChange={(e) => setPaymentMethodType(e.target.value as PaymentMethodChoice)}>
                        {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethodChoice[]).map((k) => (
                          <option key={k} value={k}>
                            {PAYMENT_METHOD_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                      <input type="checkbox" checked={contractAccepted} onChange={(e) => setContractAccepted(e.target.checked)} />
                      Veli, kayıt sözleşmesini onayladı
                    </label>
                    {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
                    <button
                      type="button"
                      onClick={submitComplete}
                      disabled={completeMutation.isPending}
                      className="btn success solid"
                      style={{ alignSelf: "flex-start" }}
                    >
                      {completeMutation.isPending ? "Tamamlanıyor…" : "Onayla ve Tamamla"}
                    </button>
                  </>
                )}

                {credentials && (
                  <div className="card card-pad" style={{ borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
                    <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--strong)" }}>
                      Kayıt Tamamlandı
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                      Giriş bilgileri penceresi açıldı.
                    </p>
                    <button type="button" className="btn xs" style={{ marginTop: 10 }} onClick={() => setShowCredentials(true)}>
                      Giriş Bilgilerini Tekrar Göster
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}
      {showCredentials && lastCompleted && (
        <RegistrationCredentialsModal
          result={lastCompleted}
          onClose={() => setShowCredentials(false)}
          onPrintContract={() => { setShowCredentials(false); setShowContract(true); }}
        />
      )}
      <PrintDocumentViewer open={showContract && !!lastCompleted} onClose={() => setShowContract(false)} documentNo={lastCompleted?.enrollment.candidateFullName ?? ""}>
        {lastCompleted && (
          <EnrollmentContractPrintBody
            enrollment={{
              candidateFullName: lastCompleted.enrollment.candidateFullName,
              candidateGradeLevel: lastCompleted.enrollment.candidateGradeLevel,
              guardianFullName: lastCompleted.enrollment.guardianFullName,
              guardianPhone: lastCompleted.enrollment.guardianPhone,
              contractSignedAt: lastCompleted.enrollment.contractSignedAt,
              installments: lastCompleted.installments.map((i) => ({ installmentNo: i.installmentNo, amount: String(i.amount), dueDate: i.dueDate })),
            }}
            gradeLabel={GRADE_LEVEL_LABEL[lastCompleted.enrollment.candidateGradeLevel] ?? lastCompleted.enrollment.candidateGradeLevel}
          />
        )}
      </PrintDocumentViewer>
    </div>
  );
}
