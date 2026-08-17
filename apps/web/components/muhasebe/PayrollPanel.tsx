"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import { accountingKeys, createPayroll, fetchPayroll, PayrollRecord } from "@/lib/api/accounting";
import { fetchTeachers, teacherKeys, TeacherOption } from "@/lib/api/teachers";
import { fetchStaff, staffKeys, StaffMember } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/client";
import { Icon } from "@/components/ui/icons";
import { computePayroll } from "@/lib/payroll";

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function periodLabel(period: string) {
  return new Date(`${period}-01`).toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
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
      queryClient.invalidateQueries({ queryKey: ["accounting", "ledger"] });
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
    <div>
      <SalaryPaymentsCard teachers={teachers} staff={staff} records={records} createMutation={createMutation} />

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
    </div>
  );
}

type SalaryRow =
  | { kind: "TEACHER"; id: string; name: string; subtitle: string }
  | { kind: "STAFF"; id: string; name: string; subtitle: string; salary: number };

/**
 * "Bu ayki durum, tek tıkla öde" akışı (bkz. demo renderMaasOdemeleriCard) —
 * Personel'in (StaffProfile.salary zaten kayıtlı) brüt maaşı otomatik
 * doldurulur; Öğretmen'in ise kayıtlı bir maaş alanı olmadığından (bkz.
 * TeacherProfile) brüt tutar satır içi girilir. Aynı Öde aksiyonu, mevcut
 * "Yeni Bordro Oluştur" formuyla birebir aynı POST /api/branch/payroll uç
 * noktasına gider — ledger'a gider yazma da dahil aynı sunucu mantığı işler.
 */
function SalaryPaymentsCard({
  teachers,
  staff,
  records,
  createMutation,
}: {
  teachers: TeacherOption[];
  staff: StaffMember[];
  records: PayrollRecord[];
  createMutation: UseMutationResult<
    { record: PayrollRecord },
    unknown,
    { teacherId?: string; staffProfileId?: string; period: string; grossSalary: number }
  >;
}) {
  const period = currentPeriod();
  const [teacherAmounts, setTeacherAmounts] = useState<Record<string, string>>({});
  const [payingId, setPayingId] = useState<string | null>(null);

  const rows: SalaryRow[] = [
    ...teachers.map((t): SalaryRow => ({ kind: "TEACHER", id: t.id, name: t.name, subtitle: `Öğretmen · ${t.branch}` })),
    ...staff.map((s): SalaryRow => ({ kind: "STAFF", id: s.id, name: s.name, subtitle: s.title, salary: Number(s.salary) })),
  ];

  function paidRecord(row: SalaryRow) {
    return records.find(
      (r) => r.period === period && (row.kind === "TEACHER" ? r.teacherId === row.id : r.staffProfileId === row.id),
    );
  }

  function handlePay(row: SalaryRow, gross: number) {
    if (!gross || gross <= 0) return;
    setPayingId(row.id);
    createMutation.mutate(
      row.kind === "TEACHER" ? { teacherId: row.id, period, grossSalary: gross } : { staffProfileId: row.id, period, grossSalary: gross },
      { onSettled: () => setPayingId(null) },
    );
  }

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <h3>Maaş Ödemeleri</h3>
        <span className="hint">{periodLabel(period)}</span>
      </div>
      <p style={{ margin: "-6px 0 10px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Ödeme onaylandığında Kayıt Defteri&apos;ne brüt maliyet kadar gider yazılır — dekont oluşturmak için Belgeler &gt; Dekontlar&apos;daki
        &quot;Kayıt Defterinden Doldur&quot; seçiciyi kullanabilirsiniz.
      </p>
      {rows.length === 0 ? (
        <div className="empty-state">
          <Icon name="cash" />
          <p>Henüz öğretmen veya personel kaydı yok.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--ink-faint)" }}>
                <th style={{ padding: "4px 8px 4px 0" }}>Personel</th>
                <th style={{ padding: "4px 8px" }}>Brüt</th>
                <th style={{ padding: "4px 8px" }}>SGK+İşsizlik</th>
                <th style={{ padding: "4px 8px" }}>Gelir V.</th>
                <th style={{ padding: "4px 8px" }}>Damga V.</th>
                <th style={{ padding: "4px 8px" }}>Net</th>
                <th style={{ padding: "4px 0 4px 8px" }}>{periodLabel(period)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const record = paidRecord(row);
                if (record) {
                  return (
                    <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px 6px 0" }}>
                        {row.name}
                        <div style={{ color: "var(--ink-faint)", fontSize: "var(--text-2xs)" }}>{row.subtitle}</div>
                      </td>
                      <td style={{ padding: "6px 8px" }}>{tl(Number(record.grossSalary))}</td>
                      <td style={{ padding: "6px 8px" }}>{tl(Number(record.sgkEmployeeShare) + Number(record.unemploymentEmployeeShare))}</td>
                      <td style={{ padding: "6px 8px" }}>{tl(Number(record.incomeTaxWithheld))}</td>
                      <td style={{ padding: "6px 8px" }}>{tl(Number(record.stampDutyWithheld))}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600 }}>{tl(Number(record.netSalary))}</td>
                      <td style={{ padding: "6px 0 6px 8px" }}>
                        <span className="chip strong">
                          <Icon name="check" /> Ödendi
                        </span>
                      </td>
                    </tr>
                  );
                }
                const gross = row.kind === "STAFF" ? row.salary : Number(teacherAmounts[row.id] || 0);
                const preview = gross > 0 ? computePayroll(gross) : null;
                return (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 8px 6px 0" }}>
                      {row.name}
                      <div style={{ color: "var(--ink-faint)", fontSize: "var(--text-2xs)" }}>{row.subtitle}</div>
                    </td>
                    <td style={{ padding: "6px 8px" }}>
                      {row.kind === "STAFF" ? (
                        tl(row.salary)
                      ) : (
                        <input
                          type="number"
                          min="0"
                          placeholder="Brüt maaş"
                          value={teacherAmounts[row.id] ?? ""}
                          onChange={(e) => setTeacherAmounts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          style={{ width: 96 }}
                        />
                      )}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{preview ? tl(preview.sgkEmployeeShare + preview.unemploymentEmployeeShare) : "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{preview ? tl(preview.incomeTaxWithheld) : "—"}</td>
                    <td style={{ padding: "6px 8px" }}>{preview ? tl(preview.stampDutyWithheld) : "—"}</td>
                    <td style={{ padding: "6px 8px", fontWeight: 600 }}>{preview ? tl(preview.netSalary) : "—"}</td>
                    <td style={{ padding: "6px 0 6px 8px" }}>
                      <button
                        type="button"
                        className="btn xs success solid"
                        disabled={!gross || (createMutation.isPending && payingId === row.id)}
                        onClick={() => handlePay(row, gross)}
                      >
                        {createMutation.isPending && payingId === row.id ? "Ödeniyor…" : "Öde"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
