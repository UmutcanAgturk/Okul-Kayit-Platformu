"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createStaff,
  deactivateStaff,
  fetchStaff,
  permanentlyDeleteStaff,
  staffKeys,
  StaffMember,
  StaffStatus,
  StaffUserRole,
  updateStaffProfile,
} from "@/lib/api/staff";
import {
  createTeacher,
  deactivateTeacher,
  fetchTeachers,
  fetchTeachersFull,
  permanentlyDeleteTeacher,
  TeacherFull,
  teacherKeys,
  updateTeacherProfile,
  updateTeacherUsername,
} from "@/lib/api/teachers";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

const ROLE_LABEL: Record<StaffUserRole, string> = {
  BRANCH_ADMIN: "Şube Yöneticisi",
  ACCOUNTING: "Muhasebe Görevlisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
};

const STATUS_LABEL: Record<StaffStatus, string> = {
  ACTIVE: "Aktif",
  ON_LEAVE: "İzinli",
  RESIGNED: "Ayrıldı",
};

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

function StaffDetailPanel({ staff, onClose }: { staff: StaffMember; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nameParts, ...restParts] = staff.name.split(" ");
  const [firstName, setFirstName] = useState(nameParts);
  const [lastName, setLastName] = useState(restParts.join(" "));
  const [title, setTitle] = useState(staff.title);
  const [department, setDepartment] = useState(staff.department ?? "");
  const [salary, setSalary] = useState(String(Number(staff.salary)));
  const [phone, setPhone] = useState(staff.phone ?? "");
  const [startDate, setStartDate] = useState(staff.startDate.slice(0, 10));
  const [status, setStatus] = useState<StaffStatus>(staff.status);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateStaffProfile(staff.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim(),
        department: department.trim(),
        salary: Number(salary),
        phone: phone.trim(),
        startDate,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Güncellenemedi."),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => updateStaffProfile(staff.id, { status: "ACTIVE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.list() }),
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentlyDeleteStaff(staff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Kalıcı olarak silinemedi."),
  });

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>{staff.name} — Düzenle</h3>
        <button type="button" className="btn xs" onClick={onClose}>
          Kapat
        </button>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        {staff.email} · {ROLE_LABEL[staff.role]} · {STATUS_LABEL[staff.status]}
      </p>
      <div className="grid cols-2">
        <div className="field">
          <label>Ad</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label>Soyad</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label>Unvan</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Departman</label>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} />
        </div>
        <div className="field">
          <label>Brüt Maaş (₺)</label>
          <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
        </div>
        <div className="field">
          <label>İşe Başlama Tarihi</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Durum</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as StaffStatus)}>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          {updateMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {!staff.isActive && (
          <button type="button" className="btn" disabled={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate()}>
            Yeniden Aktifleştir
          </button>
        )}
        {!confirmingDelete ? (
          <button type="button" className="btn danger" style={{ marginLeft: "auto" }} onClick={() => setConfirmingDelete(true)}>
            Kalıcı Olarak Sil
          </button>
        ) : (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)" }}>
            Emin misiniz? Bordro geçmişi varsa silinemez.
            <button type="button" className="btn danger xs" disabled={permanentDeleteMutation.isPending} onClick={() => permanentDeleteMutation.mutate()}>
              Evet, Sil
            </button>
            <button type="button" className="btn xs" onClick={() => setConfirmingDelete(false)}>
              Vazgeç
            </button>
          </span>
        )}
      </div>
    </div>
  );
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
  const teachersQuery = useQuery({ queryKey: teacherKeys.list(), queryFn: fetchTeachers, enabled: !!me });

  const [tab, setTab] = useState<"personel" | "ogretmenler">("personel");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<StaffUserRole>("ACCOUNTING");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salary, setSalary] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<StaffUserRole | "">("");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffKeys.list() });
      setFullName("");
      setTitle("");
      setDepartment("");
      setSalary("");
      setPhone("");
      setEmail("");
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
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    });
  }

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Personel yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  if (tab === "ogretmenler") {
    return (
      <div className="screen">
        <h1>Personel</h1>
        <p className="lede">
          {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : me.role === "SUPERADMIN" ? "Genel Merkez (Şube Yöneticisi yetkisiyle)" : "Muhasebe"}
        </p>
        <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />
        <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
          <button type="button" className="screen-tab" onClick={() => setTab("personel")}>
            Personel
          </button>
          <button type="button" className="screen-tab active">
            Öğretmenler
          </button>
        </div>
        <TeachersPanel />
      </div>
    );
  }

  const staff = staffQuery.data?.staff ?? [];
  const activeStaff = staff.filter((s) => s.isActive);
  const selectedStaff = staff.find((s) => s.id === selectedStaffId) ?? null;
  const filteredStaff = staff.filter((s) => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (roleFilter && s.role !== roleFilter) return false;
    if (q && !s.name.toLocaleLowerCase("tr-TR").includes(q)) return false;
    return true;
  });

  return (
    <div className="screen">
      <h1>Personel</h1>
      <p className="lede">
        {me.firstName} {me.lastName} · {me.role === "BRANCH_ADMIN" ? "Şube Yöneticisi" : me.role === "SUPERADMIN" ? "Genel Merkez (Şube Yöneticisi yetkisiyle)" : "Muhasebe"}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        <button type="button" className="screen-tab active">
          Personel
        </button>
        <button type="button" className="screen-tab" onClick={() => setTab("ogretmenler")}>
          Öğretmenler
        </button>
      </div>

      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat-card">
          <p className="stat-label">Toplam Personel</p>
          <p className="stat-value">{staff.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Öğretmen</p>
          <p className="stat-value">{teachersQuery.data?.teachers.length ?? 0}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Aktif</p>
          <p className="stat-value">{activeStaff.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Toplam Aylık Maaş Yükü</p>
          <p className="stat-value">{tl(activeStaff.reduce((sum, s) => sum + Number(s.salary), 0))}</p>
        </div>
      </div>

      {selectedStaff && <StaffDetailPanel staff={selectedStaff} onClose={() => setSelectedStaffId(null)} />}

      <div className="grid cols-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Personel Ekle</h3>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              Öğretmenler burada listelenmez — öğretmen ekleme/düzenleme için yukarıdaki &quot;Öğretmenler&quot;
              sekmesini kullanın. Bu form yalnızca öğretmen dışı personeli (Şube Müdürü, Ön Büro, Muhasebe, Rehber
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Brüt Maaş (₺)</label>
                  <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} />
                </div>
                <div className="field">
                  <label>Telefon (opsiyonel)</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
                </div>
              </div>
              <div className="field">
                <label>E-posta (opsiyonel — boş bırakılırsa otomatik oluşturulur)</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad.soyad@sube.seviye360.com" />
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

          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Ara</label>
              <input type="text" placeholder="İsim…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="field">
              <label>Rol</label>
              <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as StaffUserRole | "")}>
                <option value="">Tümü</option>
                {Object.entries(ROLE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {staffQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!staffQuery.isLoading && staff.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Henüz personel kaydı yok. Soldaki formdan ilk personelinizi ekleyin.</p>
            </div>
          )}
          {!staffQuery.isLoading && staff.length > 0 && filteredStaff.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Aramanızla eşleşen personel yok.</p>
            </div>
          )}

          <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredStaff.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedStaffId(s.id)}
                className="row-clickable"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {s.name}
                    {s.status !== "ACTIVE" && <span className="chip neutral">{STATUS_LABEL[s.status]}</span>}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {s.title} · {ROLE_LABEL[s.role]}
                    {s.department && ` · ${s.department}`}
                    {s.phone && ` · ${s.phone}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }} onClick={(e) => e.stopPropagation()}>
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

function TeacherDetailPanel({ teacher, onClose }: { teacher: TeacherFull; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [nameParts, ...restParts] = teacher.name.split(" ");
  const [firstName, setFirstName] = useState(nameParts);
  const [lastName, setLastName] = useState(restParts.join(" "));
  const [branch, setBranch] = useState(teacher.branch);
  const [title, setTitle] = useState(teacher.title ?? "");
  const [phone, setPhone] = useState(teacher.phone ?? "");
  const [isMentor, setIsMentor] = useState(teacher.isMentor);
  const [salary, setSalary] = useState(teacher.salary ?? "");
  const [username, setUsername] = useState(teacher.email);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: teacherKeys.full() });
    queryClient.invalidateQueries({ queryKey: teacherKeys.list() });
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateTeacherProfile(teacher.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        branch: branch.trim(),
        title: title.trim() || null,
        phone: phone.trim() || null,
        isMentor,
        salary: salary === "" ? null : Number(salary),
      }),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Güncellenemedi."),
  });

  const usernameMutation = useMutation({
    mutationFn: () => updateTeacherUsername(teacher.id, username.trim()),
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Kullanıcı adı güncellenemedi."),
  });

  const reactivateMutation = useMutation({
    mutationFn: () => updateTeacherProfile(teacher.id, { isActive: true }),
    onSuccess: invalidate,
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateTeacher(teacher.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: () => permanentlyDeleteTeacher(teacher.id),
    onSuccess: () => {
      invalidate();
      onClose();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Kalıcı olarak silinemedi."),
  });

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>{teacher.name} — Düzenle</h3>
        <button type="button" className="btn xs" onClick={onClose}>
          Kapat
        </button>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        {teacher.email} · {teacher.isActive ? "Aktif" : "Pasif"}
        {teacher.isMentor && " · Seviye Mentör"}
      </p>
      <div className="grid cols-2">
        <div className="field">
          <label>Ad</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label>Soyad</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <label>Branş (zümre)</label>
          <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Örn. Matematik" />
        </div>
        <div className="field">
          <label>Unvan (opsiyonel)</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Zümre Başkanı" />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
        </div>
        <div className="field">
          <label>Maaş (₺, opsiyonel)</label>
          <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Örn. 32000" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)", alignSelf: "end", paddingBottom: 8 }}>
          <input type="checkbox" checked={isMentor} onChange={(e) => setIsMentor(e.target.checked)} />
          Seviye Mentör havuzunda
        </label>
      </div>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn primary" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          {updateMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        {!teacher.isActive && (
          <button type="button" className="btn" disabled={reactivateMutation.isPending} onClick={() => reactivateMutation.mutate()}>
            Yeniden Aktifleştir
          </button>
        )}
        {teacher.isActive && (
          <button type="button" className="btn" disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate()}>
            Devre Dışı Bırak
          </button>
        )}
        {!confirmingDelete ? (
          <button type="button" className="btn danger" style={{ marginLeft: "auto" }} onClick={() => setConfirmingDelete(true)}>
            Kalıcı Olarak Sil
          </button>
        ) : (
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)" }}>
            Emin misiniz? Ders programı/menti/bordro geçmişi varsa silinemez.
            <button type="button" className="btn danger xs" disabled={permanentDeleteMutation.isPending} onClick={() => permanentDeleteMutation.mutate()}>
              Evet, Sil
            </button>
            <button type="button" className="btn xs" onClick={() => setConfirmingDelete(false)}>
              Vazgeç
            </button>
          </span>
        )}
      </div>
      <div className="field" style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <label>Kullanıcı Adı (giriş e-postası)</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={username} onChange={(e) => setUsername(e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn sm" disabled={usernameMutation.isPending} onClick={() => usernameMutation.mutate()}>
            {usernameMutation.isPending ? "Kaydediliyor…" : "Kullanıcı Adını Değiştir"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Öğretmen ekleme/düzenleme (task #88) — Personel'in (StaffProfile) yanına,
 * aynı "Personel" ekranı içinde ayrı bir sekme olarak eklenir. Demo'nun
 * unified Personel listesindeki (rol="Öğretmen") aynı işlevi, gerçek
 * backend'in TeacherProfile/StaffProfile ayrımını koruyarak sağlar (bkz.
 * app/api/branch/teachers/route.ts POST + [teacherId]/route.ts).
 */
function TeachersPanel() {
  const queryClient = useQueryClient();
  const teachersQuery = useQuery({ queryKey: teacherKeys.full(), queryFn: fetchTeachersFull });

  const [fullName, setFullName] = useState("");
  const [branch, setBranch] = useState("");
  const [title, setTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [salary, setSalary] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createTeacher,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.full() });
      queryClient.invalidateQueries({ queryKey: teacherKeys.list() });
      setFullName("");
      setBranch("");
      setTitle("");
      setPhone("");
      setEmail("");
      setSalary("");
      setFormError(null);
      setCredentials(data.credentials);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Öğretmen oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !branch.trim()) {
      setFormError("Ad soyad ve branş (zümre) zorunludur.");
      return;
    }
    createMutation.mutate({
      fullName: fullName.trim(),
      branch: branch.trim(),
      title: title.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      salary: salary.trim() ? Number(salary) : undefined,
    });
  }

  const teachers = teachersQuery.data?.teachers ?? [];
  const activeTeachers = teachers.filter((t) => t.isActive);
  const mentorCount = teachers.filter((t) => t.isMentor).length;
  const branches = Array.from(new Set(teachers.map((t) => t.branch))).sort((a, b) => a.localeCompare(b, "tr"));
  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId) ?? null;
  const filteredTeachers = teachers.filter((t) => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (branchFilter && t.branch !== branchFilter) return false;
    if (q && !t.name.toLocaleLowerCase("tr-TR").includes(q)) return false;
    return true;
  });

  return (
    <div>
      <div className="grid cols-4" style={{ marginBottom: 14 }}>
        <div className="card stat-card">
          <p className="stat-label">Toplam Öğretmen</p>
          <p className="stat-value">{teachers.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Aktif</p>
          <p className="stat-value">{activeTeachers.length}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Seviye Mentör</p>
          <p className="stat-value">{mentorCount}</p>
        </div>
        <div className="card stat-card">
          <p className="stat-label">Branş Sayısı</p>
          <p className="stat-value">{branches.length}</p>
        </div>
      </div>

      {selectedTeacher && <TeacherDetailPanel teacher={selectedTeacher} onClose={() => setSelectedTeacherId(null)} />}

      <div className="grid cols-2">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card card-pad">
            <div className="card-head">
              <h3>Yeni Öğretmen Ekle</h3>
            </div>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Ad Soyad</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Branş (zümre)</label>
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Örn. Matematik" />
                </div>
                <div className="field">
                  <label>Unvan (opsiyonel)</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Zümre Başkanı" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="field">
                  <label>Telefon (opsiyonel)</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XX XXX XX XX" />
                </div>
                <div className="field">
                  <label>E-posta (opsiyonel)</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad.soyad@sube.seviye360.com" />
                </div>
              </div>
              <div className="field">
                <label>Maaş (₺, opsiyonel)</label>
                <input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="Örn. 32000" />
              </div>

              {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

              <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ justifyContent: "center" }}>
                {createMutation.isPending ? "Oluşturuluyor…" : "Öğretmeni Kaydet"}
              </button>
            </form>
          </div>

          {credentials && (
            <div className="card card-pad" style={{ borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--strong)" }}>
                Giriş Bilgileri Oluşturuldu
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                Bu şifre yalnızca burada gösterilir — hemen öğretmene iletin, tekrar görüntülenemez.
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
            <h3>Öğretmen Listesi</h3>
          </div>

          <div className="grid cols-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Ara</label>
              <input type="text" placeholder="İsim…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="field">
              <label>Branş</label>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
                <option value="">Tümü</option>
                {branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {teachersQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!teachersQuery.isLoading && teachers.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Henüz öğretmen kaydı yok. Soldaki formdan ilk öğretmeninizi ekleyin.</p>
            </div>
          )}
          {!teachersQuery.isLoading && teachers.length > 0 && filteredTeachers.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Aramanızla eşleşen öğretmen yok.</p>
            </div>
          )}

          <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
            {filteredTeachers.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTeacherId(t.id)}
                className="row-clickable"
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0", cursor: "pointer" }}
              >
                <div>
                  <div style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    {t.name}
                    {!t.isActive && <span className="chip neutral">Pasif</span>}
                    {t.isMentor && <span className="chip strong">Mentör</span>}
                  </div>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                    {t.branch}
                    {t.title && ` · ${t.title}`}
                    {t.phone && ` · ${t.phone}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
