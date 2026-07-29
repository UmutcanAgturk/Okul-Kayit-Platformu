"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createTenant, fetchHqAccountingSummary, fetchHqStudents, fetchHqTenants, hqKeys, toggleTenantActive, type HqTenant } from "@/lib/api/hq";

const ALLOWED_ROLES = ["SUPERADMIN"];
const TENANT_TYPE_LABEL: Record<string, string> = { GENEL_MERKEZ: "Genel Merkez", SUBE: "Şube", BOLUM: "Bölüm" };

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TenantCard({ tenant, onToggleActive, toggling }: { tenant: HqTenant; onToggleActive: (tenantId: string) => void; toggling: boolean }) {
  const occupancyPct = tenant.capacity && tenant.capacity > 0 ? Math.round((tenant.studentCount / tenant.capacity) * 100) : null;
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
          <p className="font-medium text-slate-900 dark:text-slate-50">
            {tenant.studentCount}
            {tenant.capacity ? ` / ${tenant.capacity}` : ""}
          </p>
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
      {occupancyPct !== null && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-[#0071ce]" style={{ width: `${Math.min(100, occupancyPct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Doluluk %{occupancyPct}</p>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Şube Müdürü: <span className="font-medium text-slate-700 dark:text-slate-300">{tenant.branchAdminName ?? "Atanmamış"}</span>
      </p>
      {tenant.type !== "GENEL_MERKEZ" && (
        <button
          type="button"
          onClick={() => onToggleActive(tenant.id)}
          disabled={toggling}
          className="mt-3 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {tenant.isActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
        </button>
      )}
    </div>
  );
}

function CreateTenantForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [capacity, setCapacity] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: hqKeys.tenants() });
      setName("");
      setCity("");
      setDistrict("");
      setAddress("");
      setPhone("");
      setEmail("");
      setCapacity("");
      setTaxNo("");
      setManagerFirstName("");
      setManagerLastName("");
      setFormError(null);
      setCredentials(data.credentials);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kurum oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !city.trim() || !district.trim() || !managerFirstName.trim() || !managerLastName.trim()) {
      setFormError("Kurum adı, şehir, ilçe ve şube müdürü adı/soyadı zorunludur.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      city: city.trim(),
      district: district.trim(),
      managerFirstName: managerFirstName.trim(),
      managerLastName: managerLastName.trim(),
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      taxNo: taxNo.trim() || undefined,
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Kurum Ekle</h2>
      <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kurum Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Şehir</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">İlçe</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Açık Adres (opsiyonel)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Telefon (opsiyonel)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">E-posta (opsiyonel)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Öğrenci Kapasitesi (opsiyonel)</label>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min="1" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Vergi No (opsiyonel)</label>
            <input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Şube Müdürü Adı</label>
            <input value={managerFirstName} onChange={(e) => setManagerFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Şube Müdürü Soyadı</label>
            <input value={managerLastName} onChange={(e) => setManagerLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
          </div>
        </div>

        {formError && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Kurumu Ekle"}
          </button>
        </div>
      </form>

      {credentials && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Şube Müdürü Giriş Bilgileri Oluşturuldu</h3>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            Bu şifre yalnızca burada gösterilir — hemen şube müdürüne iletin, tekrar görüntülenemez.
          </p>
          <dl className="mt-2 space-y-1 text-xs text-emerald-800 dark:text-emerald-300">
            <div className="flex justify-between">
              <dt>Kullanıcı adı</dt>
              <dd className="font-mono">{credentials.username}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Şifre</dt>
              <dd className="font-mono">{credentials.password}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function HqStudentsPanel({ tenants }: { tenants: HqTenant[] }) {
  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const query = useQuery({ queryKey: hqKeys.students(q, tenantId), queryFn: () => fetchHqStudents({ q, tenantId }) });
  const data = query.data;

  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Öğrenciler — Tüm Şubeler</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Genel Merkez, tüm şubelerdeki her öğrenciyi tek tek görebilir — şube bazlı kısıtlama uygulanmaz.
      </p>

      {data && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Toplam Öğrenci</p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{data.summary.totalStudents}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Şube Sayısı</p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{data.summary.branchCount}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">En Kalabalık Şube</p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">
              {data.summary.busiestBranch ? `${data.summary.busiestBranch.name} (${data.summary.busiestBranch.count})` : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Sınıfa Atanmamış</p>
            <p className="font-semibold text-slate-900 dark:text-slate-50">{data.summary.unassignedCount}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="İsim veya öğrenci no ile ara…"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <select
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Tüm Şubeler</option>
          {tenants.filter((t) => t.type !== "GENEL_MERKEZ").map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {query.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
      {data && (
        <div className="mt-3 max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 bg-white text-left text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                <th className="pb-2">Öğrenci</th>
                <th className="pb-2">Öğrenci No</th>
                <th className="pb-2">Şube</th>
                <th className="pb-2">Sınıf</th>
                <th className="pb-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {data.students.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-3 text-center text-slate-500 dark:text-slate-400">
                    Öğrenci bulunamadı
                  </td>
                </tr>
              )}
              {data.students.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1.5 font-medium text-slate-900 dark:text-slate-50">{s.name}</td>
                  <td className="py-1.5">{s.studentNo}</td>
                  <td className="py-1.5">{s.tenantName}</td>
                  <td className="py-1.5">
                    {s.classroomName ?? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">Atanmadı</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{s.avgNet ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Kurum Yönetimi — demo/seviye360-app.html'deki "hq:kurumlar" ekranının
 * gerçek karşılığı: yeni kurum ekleme (otomatik oluşturulan Şube Yöneticisi
 * hesabıyla birlikte, bkz. app/api/hq/tenants POST) ve devre dışı bırakma/
 * yeniden etkinleştirme (StaffProfile deaktivasyonuyla aynı desen — gerçek
 * silme yerine `Tenant.isActive`). Mali Özet, zaten var olan
 * app/api/hq/accounting-ledger'ın (Superadmin konsolide görünüm) ilk
 * gerçek frontend tüketicisidir.
 */
export function HqDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const toggleActiveMutation = useMutation({
    mutationFn: toggleTenantActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hqKeys.tenants() }),
  });

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
            <TenantCard key={t.id} tenant={t} onToggleActive={(id) => toggleActiveMutation.mutate(id)} toggling={toggleActiveMutation.isPending} />
          ))}
        </div>
      </div>

      <CreateTenantForm />

      <HqStudentsPanel tenants={tenants} />

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
