"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accountingKeys, createPayroll, fetchPayroll } from "@/lib/api/accounting";
import { fetchTeachers, teacherKeys } from "@/lib/api/teachers";
import { fetchStaff, staffKeys } from "@/lib/api/staff";
import { ApiError } from "@/lib/api/client";

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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Bordro Oluştur</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kişi Türü</label>
            <select
              value={personKind}
              onChange={(e) => {
                setPersonKind(e.target.value as "TEACHER" | "STAFF");
                setPersonId("");
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="TEACHER">Öğretmen</option>
              <option value="STAFF">Öğretmen Dışı Personel</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              {personKind === "TEACHER" ? "Öğretmen" : "Personel"}
            </label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Dönem (YYYY-MM)</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="2026-07"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Brüt Maaş (₺)</label>
              <input
                type="number"
                min="0"
                value={grossSalary}
                onChange={(e) => setGrossSalary(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Bordroyu Oluştur"}
          </button>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            SGK işçi payı %14 + işsizlik sigortası işçi payı %1 brüt maaştan düşülür; kalan tutar üzerinden
            basitleştirilmiş tek dilim %15 gelir vergisi hesaplanır; damga vergisi brüt maaşın binde 7,59&apos;udur.
            Onaylandığında işveren toplam maliyeti (brüt + işveren payları) Kayıt Defteri&apos;ne otomatik gider olarak yazılır.
          </p>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Oluşturulan Bordrolar</h2>
        {payrollQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!payrollQuery.isLoading && records.length === 0 && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Henüz bordro oluşturulmadı.</p>
        )}
        <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto">
          {records.map((r) => (
            <div key={r.id} className="border-b border-slate-100 py-2 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900 dark:text-slate-50">
                  {r.personName} · {r.period}
                </span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">{tl(Number(r.netSalary))} net</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
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
