"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { completeEnrollment, enrollmentKeys, fetchEnrollments, GRADE_LEVEL_LABEL, type CompleteEnrollmentResult } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";
import { BulkImportPanel } from "./BulkImportPanel";
import { PrintDocumentViewer } from "@/components/documents/PrintDocumentViewer";
import { EnrollmentContractPrintBody } from "@/components/documents/DocumentPrintBodies";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR"];
const LOCKED_STAGES = ["KAYIT_TAMAMLANDI", "IPTAL_EDILDI"];

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
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CompleteEnrollmentResult["credentials"] | null>(null);
  const [lastCompleted, setLastCompleted] = useState<CompleteEnrollmentResult | null>(null);
  const [showContract, setShowContract] = useState(false);

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

  const completeMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof completeEnrollment>[1] }) => completeEnrollment(vars.id, vars.input),
    onSuccess: (result) => {
      setCredentials(result.credentials);
      setLastCompleted(result);
      setFormError(null);
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
  if (!ALLOWED_ROLES.includes(me.role)) {
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

  function submitComplete() {
    if (!selected) return;
    const count = Number(installmentCount);
    const amount = Number(installmentAmount);
    if (!count || count < 1 || !amount || amount <= 0 || !firstDueDate) {
      setFormError("Taksit sayısı, tutarı ve ilk vade tarihi zorunludur.");
      return;
    }
    setFormError(null);
    completeMutation.mutate({ id: selected.id, input: { installmentCount: count, installmentAmount: amount, firstDueDate } });
  }

  return (
    <div className="screen">
      <h1>Normal Kayıt</h1>
      <p className="lede">
        {mode === "tekli"
          ? "Ön kaydı olan bir adayı sözleşme ve ödeme planıyla tam kayda dönüştürün."
          : "CSV'den birden çok öğrenciyi tek seferde içe aktarın — ön kayıt gerektirmez, doğrudan tam kayıt oluşturur."}
      </p>

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
                      Kayıt Tamamlandı — Giriş Bilgileri
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                      Bu şifre yalnızca burada gösterilir — hemen veliye/öğrenciye iletin.
                    </p>
                    <dl style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <dt>Kullanıcı adı</dt>
                        <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.username}</dd>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <dt>Şifre</dt>
                        <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.password}</dd>
                      </div>
                    </dl>
                    <button type="button" className="btn xs" style={{ marginTop: 10 }} onClick={() => setShowContract(true)}>
                      Kayıt Sözleşmesini Yazdır
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      )}
      <PrintDocumentViewer open={showContract && !!lastCompleted} onClose={() => setShowContract(false)} documentNo={lastCompleted?.enrollment.candidateFullName ?? ""}>
        {lastCompleted && (
          <EnrollmentContractPrintBody
            enrollment={{
              candidateFullName: lastCompleted.enrollment.candidateFullName,
              candidateGradeLevel: lastCompleted.enrollment.candidateGradeLevel,
              guardianFullName: lastCompleted.enrollment.guardianFullName,
              guardianPhone: lastCompleted.enrollment.guardianPhone,
              contractSignedAt: null,
              installments: lastCompleted.installments.map((i) => ({ installmentNo: i.installmentNo, amount: String(i.amount), dueDate: i.dueDate })),
            }}
            gradeLabel={GRADE_LEVEL_LABEL[lastCompleted.enrollment.candidateGradeLevel] ?? lastCompleted.enrollment.candidateGradeLevel}
          />
        )}
      </PrintDocumentViewer>
    </div>
  );
}
