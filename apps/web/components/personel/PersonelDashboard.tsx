"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createStaff, deactivateStaff, fetchStaff, staffKeys, StaffUserRole } from "@/lib/api/staff";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

const ROLE_LABEL: Record<StaffUserRole, string> = {
  BRANCH_ADMIN: "Şube Yöneticisi",
  ACCOUNTING: "Muhasebe Görevlisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
};

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

/**
 * Personel (öğretmen dışı) modülünün ilk gerçek (Postgres'e karşı çalışan)
 * ekranı — bkz. prisma/schema.prisma'daki StaffProfile modeli ve
 * app/api/branch/staff route'ları. Bordro'nun (bkz. components/muhasebe/
 * PayrollPanel) "hangi öğretmen dışı personel için?" seçicisini de burada
 * oluşturulan kayıtlar besler.
 */
export function PersonelDashboard() {
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

  const staffQuery = useQuery({ queryKey: staffKeys.list(), queryFn: fetchStaff, enabled: !!me });

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffUserRole>("ACCOUNTING");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salary, setSalary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
      setFullName("");
      setTitle("");
      setDepartment("");
      setSalary("");
      setFormError(null);
      setCredentials(data.credentials);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Personel oluşturulamadı."),
  });

  const deactivateMutation = useMutation({
    mutationFn: deactivateStaff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.list() }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salaryNum = Number(salary);
    if (!fullName.trim() || !title.trim() || !salaryNum || salaryNum <= 0) {
      setFormError("Ad soyad, unvan ve pozitif bir maaş zorunludur.");
      return;
    }
    createMutation.mutate({
      fullName: fullName.trim(),
      role,
      title: title.trim(),
      department: department.trim() || undefined,
      startDate,
      salary: salaryNum,
    });
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          Bu modüle erişim yetkiniz yok. Personel yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const staff = staffQuery.data?.staff ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Personel</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : "Muhasebe"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Ana Sayfa
          </a>
          <a
            href="/muhasebe"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Muhasebe
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Personel Ekle</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Öğretmenler burada listelenmez — öğretmen kaydı için ayrı bir akış kullanılır (bkz. Bordro sekmesindeki
              öğretmen seçici). Bu form yalnızca öğretmen dışı personeli (Şube Müdürü, Ön Büro, Muhasebe, Rehber
              Öğretmen vb.) kapsar.
            </p>
            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Ad Soyad</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Sistem Rolü</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as StaffUserRole)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="ACCOUNTING">Muhasebe Görevlisi</option>
                    <option value="GUIDANCE_COORDINATOR">Rehber Öğretmen</option>
                    <option value="BRANCH_ADMIN">Şube Yöneticisi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">İşe Başlama</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Unvan</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn. Ön Büro Görevlisi, Muhasebe Görevlisi"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Departman (opsiyonel)</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Örn. Rehberlik, İdari İşler"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Brüt Maaş (₺)</label>
                <input
                  type="number"
                  min="0"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              {formError && <p className="text-xs text-red-600 dark:text-red-400">{formError}</p>}

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60"
              >
                {createMutation.isPending ? "Oluşturuluyor…" : "Personeli Kaydet"}
              </button>
            </form>
          </div>

          {credentials && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                Giriş Bilgileri Oluşturuldu
              </h2>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                Bu şifre yalnızca burada gösterilir — hemen personele iletin, tekrar görüntülenemez.
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

        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Personel Listesi</h2>

          {staffQuery.isLoading && <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
          {!staffQuery.isLoading && staff.length === 0 && (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              Henüz personel kaydı yok. Soldaki formdan ilk personelinizi ekleyin.
            </p>
          )}

          <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800"
              >
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    {s.name}
                    {!s.isActive && (
                      <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Devre Dışı
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {s.title} · {ROLE_LABEL[s.role]}
                    {s.department && ` · ${s.department}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-900 dark:text-slate-50">{tl(Number(s.salary))}</span>
                  {s.isActive && (
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(s.id)}
                      className="text-xs text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      aria-label="Devre Dışı Bırak"
                    >
                      Devre Dışı Bırak
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
