"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStudentInstallments, paySelfInstallment, type SelfInstallmentRow } from "@/lib/api/self-payments";
import { Icon } from "@/components/ui/icons";

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

function tl(amount: string) {
  return "₺" + Math.round(Number(amount)).toLocaleString("tr-TR");
}

/**
 * Ödeme İşlemleri — demo/seviye360-app.html'deki "student:payment" (yalnızca
 * veli) ekranının gerçek karşılığı. Gerçek bir ödeme sağlayıcısı simülasyonu
 * (3D Secure vb.) YOKTUR — taksitler doğrudan ödendi olarak işaretlenir
 * (bkz. app/api/students/[id]/installments/[id]/pay), tıpkı personel
 * tarafındaki "Tahsil Et" akışının aynısı gibi.
 */
export function SelfPaymentsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [errorByInstallment, setErrorByInstallment] = useState<Record<string, string>>({});

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

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const installmentsQuery = useQuery({
    queryKey: ["self-installments", selectedStudentId],
    queryFn: () => fetchStudentInstallments(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const payMutation = useMutation({
    mutationFn: (installmentId: string) => paySelfInstallment(selectedStudentId!, installmentId),
    onSuccess: (_result, installmentId) => {
      setErrorByInstallment((prev) => ({ ...prev, [installmentId]: "" }));
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
  if (me.role !== "PARENT") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ödeme İşlemleri yalnızca Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const installments = installmentsQuery.data?.installments ?? [];

  return (
    <div className="screen">
      <h1>Ödeme İşlemleri</h1>
      <p className="lede">Çocuğunuzun taksit durumu ve ödeme işlemleri.</p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      <div className="card card-pad">
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
                  .map((i) => (
                    <tr key={i.id}>
                      <td>{i.installmentNo}</td>
                      <td>{new Date(i.dueDate).toLocaleDateString("tr-TR")}</td>
                      <td>{tl(i.amount)}</td>
                      <td>
                        <span className={`chip ${STATUS_CHIP[i.status]}`}>{STATUS_LABEL[i.status]}</span>
                      </td>
                      <td>
                        {i.status === "PENDING" || i.status === "OVERDUE" ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <button
                              type="button"
                              className="btn primary xs"
                              disabled={payMutation.isPending}
                              onClick={() => payMutation.mutate(i.id)}
                            >
                              Öde
                            </button>
                            {errorByInstallment[i.id] && (
                              <span style={{ fontSize: "var(--text-2xs)", color: "var(--critical)" }}>{errorByInstallment[i.id]}</span>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
