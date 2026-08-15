"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingKeys, createPayroll, fetchPayroll } from "@/lib/api/accounting";
import { fetchTeachers, teacherKeys } from "@/lib/api/teachers";
import { fetchStaff, staffKeys } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Basitleştirilmiş bordro (bkz. lib/payroll.ts) — hem TeacherProfile'ı olan
 * öğretmenleri hem de StaffProfile'ı olan öğretmen dışı personeli (şube
 * müdürü, ön büro, muhasebe görevlisi, rehber öğretmen vb.) kapsar (bkz.
 * app/api/branch/staff ve PayrollRecord'daki teacherId/staffProfileId
 * ayrımı — tam olarak biri dolu olmalıdır).
 */
export function PayrollPanel() {
  const queryClient = useQueryClient();
  const teachersQuery = useQuery({ queryKey: teacherKeys.list(), queryFn: fetchTeachers });
  const staffQuery = useQuery({ queryKey: staffKeys.list(), queryFn: fetchStaff });
  const payrollQuery = useQuery({ queryKey: accountingKeys.payroll(), queryFn: fetchPayroll });

  const [personKind, setPersonKind] = useState<"TEACHER" | "STAFF">("TEACHER");
  const [personId, setPersonId] = useState("");
  const [period, setPeriod] = useState(currentPeriod());
  const [grossSalary, setGrossSalary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createPayroll,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountingKeys.payroll() });
      queryClient.invalidateQueries({ queryKey: accountingKeys.ledger() });
      setGrossSalary("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Bordro oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const gross = Number(grossSalary);
    if (!personId || !period || !gross || gross <= 0) {
      setFormError("Kişi, dönem ve pozitif bir brüt maaş zorunludur.");
      return;
    }
    createMutation.mutate(
      personKind === "TEACHER"
        ? { teacherId: personId, period, grossSalary: gross }
        : { staffProfileId: personId, period, grossSalary: gross },
    );
  }

  const teachers = teachersQuery.data?.teachers ?? [];
  const staff = (staffQuery.data?.staff ?? []).filter((s) => s.isActive);
  const records = payrollQuery.data?.records ?? [];

  return (
    <div className="grid cols-2">
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Bordro Oluştur</h3>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Kişi Türü</label>
            <select
              value={personKind}
              onChange={(e) => {
                setPersonKind(e.target.value as "TEACHER" | "STAFF");
                setPersonId("");
              }}
            >
              <option value="TEACHER">Öğretmen</option>
              <option value="STAFF">Öğretmen Dışı Personel</option>
            </select>
          </div>
          <div className="field">
            <label>{personKind === "TEACHER" ? "Öğretmen" : "Personel"}</label>
            <select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">— Seçin —</option>
              {personKind === "TEACHER"
                ? teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.branch})
                    </option>
                  ))
                : staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.title})
                    </option>
                  ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="field">
              <label>Dönem (YYYY-MM)</label>
              <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-07" />
            </div>
            <div className="field">
              <label>Brüt Maaş (₺)</label>
              <input type="number" min="0" value={grossSalary} onChange={(e) => setGrossSalary(e.target.value)} />
            </div>
          </div>

          {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
            {createMutation.isPending ? "Oluşturuluyor…" : "Bordroyu Oluştur"}
          </button>
          <p style={{ margin: 0, fontSize: "var(--text-2xs)", lineHeight: 1.6, color: "var(--ink-faint)" }}>
            SGK işçi payı %14 + işsizlik sigortası işçi payı %1 brüt maaştan düşülür; kalan tutar üzerinden
            basitleştirilmiş tek dilim %15 gelir vergisi hesaplanır; damga vergisi brüt maaşın binde 7,59&apos;udur.
            Onaylandığında işveren toplam maliyeti (brüt + işveren payları) Kayıt Defteri&apos;ne otomatik gider olarak yazılır.
          </p>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Oluşturulan Bordrolar</h3>
        </div>
        {payrollQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!payrollQuery.isLoading && records.length === 0 && (
          <div className="empty-state">
            <Icon name="cash" />
            <p>Henüz bordro oluşturulmadı.</p>
          </div>
        )}
        <div style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {records.map((r) => (
            <div key={r.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                  {r.personName} · {r.period}
                </span>
                <span style={{ fontWeight: 700, color: "var(--strong)" }}>{tl(Number(r.netSalary))} net</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                Brüt {tl(Number(r.grossSalary))} · SGK+İşsizlik {tl(Number(r.sgkEmployeeShare) + Number(r.unemploymentEmployeeShare))} ·
                Gelir V. {tl(Number(r.incomeTaxWithheld))} · Damga V. {tl(Number(r.stampDutyWithheld))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
