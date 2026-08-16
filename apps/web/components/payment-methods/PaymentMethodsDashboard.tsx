"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchStudents } from "@/lib/api/students-roster";
import {
  PAYMENT_METHOD_TYPE_LABEL,
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  type PaymentMethodRow,
} from "@/lib/api/payment-methods";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

/**
 * Ödeme Yöntemleri — demo/seviye360-app.html'deki "odeme" ekranının gerçek
 * karşılığı. Gerçek bir ödeme sağlayıcısı entegrasyonu YOKTUR — yalnızca
 * hangi öğrencinin hangi ödeme aracını (kart/havale/nakit) "dosyada"
 * tuttuğunun kaydı (bkz. app/api/branch/students/[studentId]/payment-methods).
 */
export function PaymentMethodsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<PaymentMethodRow["type"]>("KREDI_KARTI");
  const [maskedCardNumber, setMaskedCardNumber] = useState("");
  const [isDefault, setIsDefault] = useState(false);

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

  const studentsQuery = useQuery({ queryKey: ["branch-students"], queryFn: fetchBranchStudents, enabled: !!me });
  const methodsQuery = useQuery({
    queryKey: ["payment-methods", studentId],
    queryFn: () => fetchPaymentMethods(studentId),
    enabled: !!studentId,
  });

  const createMutation = useMutation({
    mutationFn: () => createPaymentMethod(studentId, { type, maskedCardNumber: maskedCardNumber || undefined, isDefault }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods", studentId] });
      setMaskedCardNumber("");
      setIsDefault(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (methodId: string) => deletePaymentMethod(studentId, methodId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-methods", studentId] }),
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
          Bu modüle erişim yetkiniz yok. Ödeme Yöntemleri yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const students = studentsQuery.data?.students ?? [];
  const methods = methodsQuery.data?.methods ?? [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!studentId) return;
    createMutation.mutate();
  }

  return (
    <div className="screen">
      <h1>Ödeme Yöntemleri</h1>
      <p className="lede">Öğrencinin taksit tahsilatında kullanılacak ödeme aracını (kart/havale/nakit) dosyada tutun.</p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="field" style={{ maxWidth: 380 }}>
          <label>Öğrenci</label>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Öğrenci seçin —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.studentNo})
              </option>
            ))}
          </select>
        </div>
      </div>

      {studentId && (
        <div className="grid cols-2">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Ödeme Yöntemi</h3>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Tür</label>
                <select value={type} onChange={(e) => setType(e.target.value as PaymentMethodRow["type"])}>
                  {Object.entries(PAYMENT_METHOD_TYPE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {type === "KREDI_KARTI" && (
                <div className="field">
                  <label>Maskeli Kart No (opsiyonel)</label>
                  <input
                    type="text"
                    placeholder="•••• •••• •••• 4831"
                    value={maskedCardNumber}
                    onChange={(e) => setMaskedCardNumber(e.target.value)}
                  />
                </div>
              )}
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                Varsayılan ödeme yöntemi yap
              </label>
              <button type="submit" className="btn primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Ekleniyor…" : "Ekle"}
              </button>
            </form>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Kayıtlı Ödeme Yöntemleri</h3>
              <span className="hint">{methods.length} kayıt</span>
            </div>
            {methodsQuery.isLoading ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
            ) : methods.length === 0 ? (
              <div className="empty-state">
                <Icon name="cardIcon" />
                <p>Bu öğrenci için henüz bir ödeme yöntemi kayıtlı değil.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {methods.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                  >
                    <div>
                      <div style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        {PAYMENT_METHOD_TYPE_LABEL[m.type]}
                        {m.isDefault && <span className="chip strong">Varsayılan</span>}
                      </div>
                      {m.maskedCardNumber && (
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{m.maskedCardNumber} · {m.provider}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn danger xs"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(m.id)}
                    >
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
