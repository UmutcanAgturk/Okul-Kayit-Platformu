"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchHqAccountingSummary, fetchHqTenants, hqKeys, type HqTenant } from "@/lib/api/hq";

const ALLOWED_ROLES = ["SUPERADMIN"];
const TENANT_TYPE_LABEL: Record<string, string> = { GENEL_MERKEZ: "Genel Merkez", SUBE: "Şube", BOLUM: "Bölüm" };

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TenantCard({ tenant }: { tenant: HqTenant }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{tenant.name}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {TENANT_TYPE_LABEL[tenant.type] ?? tenant.type} · {tenant.code}
            {tenant.city && ` · ${tenant.city}${tenant.district ? "/" + tenant.district : ""}`}
          </p>
        </div>
        {!tenant.isActive && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">Pasif</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Öğrenci</p>
          <p className="font-medium text-slate-900 dark:text-slate-50">{tenant.studentCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Öğretmen</p>
          <p className="font-medium text-slate-900 dark:text-slate-50">{tenant.teacherCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Personel</p>
          <p className="font-medium text-slate-900 dark:text-slate-50">{tenant.staffCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Sınıf</p>
          <p className="font-medium text-slate-900 dark:text-slate-50">{tenant.classroomCount}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Şube Müdürü: <span className="font-medium text-slate-700 dark:text-slate-300">{tenant.branchAdminName ?? "Atanmamış"}</span>
      </p>
    </div>
  );
}

/**
 * Kurum Yönetimi — demo/seviye360-app.html'deki "hq:kurumlar" ekranının
 * SALT OKUNUR karşılığı: yeni kurum oluşturma/silme (gerçek bir müdür hesabı +
 * kimlik bilgisi üretimi gerektirir) bu sürümün kapsamında değildir — bkz.
 * app/api/hq/tenants route'undaki not. Mali Özet, zaten var olan
 * app/api/hq/accounting-ledger'ın (Superadmin konsolide görünüm) ilk
 * gerçek frontend tüketicisidir.
 */
export function HqDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

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

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  const tenantsQuery = useQuery({ queryKey: hqKeys.tenants(), queryFn: fetchHqTenants, enabled: !!me });
  const ledgerQuery = useQuery({ queryKey: hqKeys.accountingSummary(), queryFn: fetchHqAccountingSummary, enabled: !!me });

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Kurum Yönetimi yalnızca Genel Merkez (Superadmin) rolüne açıktır.
        </p>
      </div>
    );
  }

  const tenants = tenantsQuery.data?.tenants ?? [];
  const branches = tenants.filter((t) => t.type !== "GENEL_MERKEZ");
  const totalStudents = branches.reduce((s, t) => s + t.studentCount, 0);
  const totalStaff = branches.reduce((s, t) => s + t.staffCount + t.teacherCount, 0);
  const ledger = ledgerQuery.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Kurum Yönetimi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Ana Sayfa
          </a>
          <button type="button" onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Çıkış Yap
          </button>
        </div>
      </div>

      {tenantsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Şube</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{branches.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Öğrenci</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{totalStudents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Öğretmen + Personel</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-50">{totalStaff}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-50">Tüm Kurumlar</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tenants.map((t) => (
            <TenantCard key={t.id} tenant={t} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Konsolide Mali Özet</h2>
        {ledgerQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {ledger && (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                    <th className="pb-2">Kurum</th>
                    <th className="pb-2 text-right">Kayıt</th>
                    <th className="pb-2 text-right">Gelir</th>
                    <th className="pb-2 text-right">Gider</th>
                    <th className="pb-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.tenants.map((t) => (
                    <tr key={t.tenantId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5">{t.tenantName}</td>
                      <td className="py-1.5 text-right">{t.entryCount}</td>
                      <td className="py-1.5 text-right">{formatTl(t.totalGelir)}</td>
                      <td className="py-1.5 text-right">{formatTl(t.totalGider)}</td>
                      <td className="py-1.5 text-right">{formatTl(t.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-base font-semibold dark:border-slate-800">
              <span>Genel Toplam Net</span>
              <span>{formatTl(ledger.grandTotal.net)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
