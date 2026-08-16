"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createStaff, deactivateStaff, fetchStaff, staffKeys, StaffUserRole } from "@/lib/api/staff";
import { Icon } from "@/components/ui/icons";

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
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Personel yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const staff = staffQuery.data?.staff ?? [];

  return (
    <div className="screen">
      <h1>Personel</h1>
      <p className="lede">
        {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : me.role === "SUPERADMIN" ? "Genel Merkez (Şube Yöneticisi yetkisiyle)" : "Muhasebe"}
      </p>

      <div className="grid cols-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Personel Ekle</h3>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              Öğretmenler burada listelenmez — öğretmen kaydı için ayrı bir akış kullanılır (bkz. Bordro sekmesindeki
              öğretmen seçici). Bu form yalnızca öğretmen dışı personeli (Şube Müdürü, Ön Büro, Muhasebe, Rehber
              Öğretmen vb.) kapsar.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Ad Soyad</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Sistem Rolü</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as StaffUserRole)}>
                    <option value="ACCOUNTING">Muhasebe Görevlisi</option>
                    <option value="GUIDANCE_COORDINATOR">Rehber Öğretmen</option>
                    <option value="BRANCH_ADMIN">Şube Yöneticisi</option>
                  </select>
                </div>
                <div className="field">
                  <label>İşe Başlama</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Unvan</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Örn. Ön Büro Görevlisi, Muhasebe Görevlisi"
                />
              </div>
              <div className="field">
                <label>Departman (opsiyonel)</label>
                <input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Örn. Rehberlik, İdari İşler"
                />
              </div>
              <div className="field">
                <label>Brüt Maaş (₺)</label>
                <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} />
              </div>

              {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

              <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
                {createMutation.isPending ? "Oluşturuluyor…" : "Personeli Kaydet"}
              </button>
            </form>
          </div>

          {credentials && (
            <div className="card card-pad" style={{ borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--strong)" }}>
                Giriş Bilgileri Oluşturuldu
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                Bu şifre yalnızca burada gösterilir — hemen personele iletin, tekrar görüntülenemez.
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
            </div>
          )}
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Personel Listesi</h3>
          </div>

          {staffQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!staffQuery.isLoading && staff.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Henüz personel kaydı yok. Soldaki formdan ilk personelinizi ekleyin.</p>
            </div>
          )}

          <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {staff.map((s) => (
              <div
                key={s.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {s.name}
                    {!s.isActive && <span className="chip neutral">Devre Dışı</span>}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {s.title} · {ROLE_LABEL[s.role]}
                    {s.department && ` · ${s.department}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>{tl(Number(s.salary))}</span>
                  {s.isActive && (
                    <button
                      type="button"
                      onClick={() => deactivateMutation.mutate(s.id)}
                      className="btn xs"
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
