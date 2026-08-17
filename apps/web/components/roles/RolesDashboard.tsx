"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStaff, staffKeys, updateStaffRole, updateStaffUsername, type StaffUserRole } from "@/lib/api/staff";
import { fetchRoleGuardians, fetchRoleStudents, roleKeys, updateGuardianUsername, updateStudentUsername } from "@/lib/api/roles";
import { fetchHqRoleGuardians, fetchHqRoleStaff, fetchHqRoleStudents, hqKeys } from "@/lib/api/hq";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

const ROLE_LABEL: Record<StaffUserRole, string> = {
  BRANCH_ADMIN: "Şube Yöneticisi",
  ACCOUNTING: "Muhasebe Görevlisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
};

const TABS = [
  { id: "personel", label: "Personel" },
  { id: "ogrenciler", label: "Öğrenciler" },
  { id: "veliler", label: "Veliler" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** Satır bazında inline kullanıcı adı düzenleme — üç sekmede de ortak. */
function UsernameCell({
  id,
  username,
  isPending,
  onSave,
}: {
  id: string;
  username: string;
  isPending: boolean;
  onSave: (id: string, value: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(username);
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{username}</span>
        <button
          type="button"
          className="btn xs"
          onClick={() => {
            setValue(username);
            setError(null);
            setEditing(true);
          }}
        >
          Düzenle
        </button>
      </div>
    );
  }

  async function handleSave() {
    if (!value.trim() || !value.includes("@")) {
      setError("Geçerli bir e-posta girin.");
      return;
    }
    try {
      await onSave(id, value.trim());
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kullanıcı adı güncellenemedi.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, minWidth: 200 }}
        />
        <button type="button" className="btn primary xs" disabled={isPending} onClick={handleSave}>
          Kaydet
        </button>
        <button type="button" className="btn xs" onClick={() => setEditing(false)}>
          Vazgeç
        </button>
      </div>
      {error && <span style={{ fontSize: 11, color: "var(--critical)" }}>{error}</span>}
    </div>
  );
}

function PersonelTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const staffQuery = useQuery({ queryKey: staffKeys.list(), queryFn: fetchStaff });

  const roleMutation = useMutation({
    mutationFn: ({ staffId, role }: { staffId: string; role: StaffUserRole }) => updateStaffRole(staffId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.list() }),
  });
  const usernameMutation = useMutation({
    mutationFn: ({ staffId, username }: { staffId: string; username: string }) => updateStaffUsername(staffId, username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.list() }),
  });

  const staff = useMemo(() => {
    const rows = (staffQuery.data?.staff ?? []).filter((s) => s.isActive);
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.email.toLocaleLowerCase("tr-TR").includes(q));
  }, [staffQuery.data, search]);

  if (staffQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (staff.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen personel yok.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Ünvan</th>
            <th>Sistem Rolü</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.title}</td>
              <td>
                <select
                  value={s.role}
                  disabled={roleMutation.isPending}
                  onChange={(e) => roleMutation.mutate({ staffId: s.id, role: e.target.value as StaffUserRole })}
                >
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <UsernameCell
                  id={s.id}
                  username={s.email}
                  isPending={usernameMutation.isPending}
                  onSave={(staffId, username) => usernameMutation.mutateAsync({ staffId, username })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OgrencilerTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({ queryKey: roleKeys.students(), queryFn: fetchRoleStudents });

  const usernameMutation = useMutation({
    mutationFn: ({ studentId, username }: { studentId: string; username: string }) => updateStudentUsername(studentId, username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.students() }),
  });

  const students = useMemo(() => {
    const rows = studentsQuery.data?.students ?? [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.username.toLocaleLowerCase("tr-TR").includes(q));
  }, [studentsQuery.data, search]);

  if (studentsQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (students.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen öğrenci yok.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Sınıf</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.classroomName ?? "—"}</td>
              <td>
                <UsernameCell
                  id={s.id}
                  username={s.username}
                  isPending={usernameMutation.isPending}
                  onSave={(studentId, username) => usernameMutation.mutateAsync({ studentId, username })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VelilerTab({ search }: { search: string }) {
  const queryClient = useQueryClient();
  const guardiansQuery = useQuery({ queryKey: roleKeys.guardians(), queryFn: fetchRoleGuardians });

  const usernameMutation = useMutation({
    mutationFn: ({ parentId, username }: { parentId: string; username: string }) => updateGuardianUsername(parentId, username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.guardians() }),
  });

  const guardians = useMemo(() => {
    const rows = guardiansQuery.data?.guardians ?? [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows;
    return rows.filter(
      (g) => g.guardianName.toLocaleLowerCase("tr-TR").includes(q) || g.studentName.toLocaleLowerCase("tr-TR").includes(q) || g.username.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [guardiansQuery.data, search]);

  if (guardiansQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (guardians.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen veli yok.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Veli Adı</th>
            <th>Öğrenci</th>
            <th>Yakınlık</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {guardians.map((g) => (
            <tr key={`${g.parentId}-${g.studentName}`}>
              <td style={{ fontWeight: 600 }}>{g.guardianName}</td>
              <td>{g.studentName}</td>
              <td>{g.relation}</td>
              <td>
                <UsernameCell
                  id={g.parentId}
                  username={g.username}
                  isPending={usernameMutation.isPending}
                  onSave={(parentId, username) => usernameMutation.mutateAsync({ parentId, username })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Roller — Tüm Şubeler (task #100) — bare SUPERADMIN (henüz "Bu Şube Olarak
 * Yönet" ile hiçbir şubeye geçmemiş Genel Merkez kullanıcısı) için salt-okunur
 * çapraz-şube görünümü. Demo denetimindeki bulgu: Roller ekranı önceden
 * yalnızca BRANCH_ADMIN'e (veya tek bir şubeye geçmiş SUPERADMIN'e) açıktı —
 * Genel Merkez'in TÜM şubelerdeki personel/öğrenci/veli kullanıcı adlarını
 * tek ekrandan görebileceği bir yol yoktu. HQ Öğrenciler panelinin (task #44,
 * bkz. HqDashboard.tsx HqStudentsPanel) AYNI salt-okunur deseni: rol/kullanıcı
 * adı DEĞİŞTİRME burada YOK — bunun için hâlâ ilgili şubeye "Bu Şube Olarak
 * Yönet" ile geçmek gerekir (yanlış şubede değişiklik riskini azaltır).
 */
function HqPersonelTab({ search }: { search: string }) {
  const query = useQuery({ queryKey: hqKeys.roleStaff(), queryFn: fetchHqRoleStaff });
  const rows = useMemo(() => {
    const all = (query.data?.staff ?? []).filter((s) => s.isActive);
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return all;
    return all.filter(
      (s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.email.toLocaleLowerCase("tr-TR").includes(q) || s.tenantName.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [query.data, search]);

  if (query.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen personel yok.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Şube</th>
            <th>Ünvan</th>
            <th>Sistem Rolü</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.tenantName}</td>
              <td>{s.title}</td>
              <td>{ROLE_LABEL[s.role as StaffUserRole] ?? s.role}</td>
              <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{s.email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HqOgrencilerTab({ search }: { search: string }) {
  const query = useQuery({ queryKey: hqKeys.roleStudents(), queryFn: fetchHqRoleStudents });
  const rows = useMemo(() => {
    const all = query.data?.students ?? [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return all;
    return all.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.username.toLocaleLowerCase("tr-TR").includes(q) || s.tenantName.toLocaleLowerCase("tr-TR").includes(q));
  }, [query.data, search]);

  if (query.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen öğrenci yok.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Ad Soyad</th>
            <th>Şube</th>
            <th>Sınıf</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.tenantName}</td>
              <td>{s.classroomName ?? "—"}</td>
              <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{s.username}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HqVelilerTab({ search }: { search: string }) {
  const query = useQuery({ queryKey: hqKeys.roleGuardians(), queryFn: fetchHqRoleGuardians });
  const rows = useMemo(() => {
    const all = query.data?.guardians ?? [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return all;
    return all.filter(
      (g) =>
        g.guardianName.toLocaleLowerCase("tr-TR").includes(q) ||
        g.studentName.toLocaleLowerCase("tr-TR").includes(q) ||
        g.username.toLocaleLowerCase("tr-TR").includes(q) ||
        g.tenantName.toLocaleLowerCase("tr-TR").includes(q),
    );
  }, [query.data, search]);

  if (query.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <Icon name="users" />
        <p>Aramanızla eşleşen veli yok.</p>
      </div>
    );
  }
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Veli Adı</th>
            <th>Şube</th>
            <th>Öğrenci</th>
            <th>Yakınlık</th>
            <th>Kullanıcı Adı</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={`${g.parentId}-${g.studentName}-${g.tenantId}`}>
              <td style={{ fontWeight: 600 }}>{g.guardianName}</td>
              <td>{g.tenantName}</td>
              <td>{g.studentName}</td>
              <td>{g.relation}</td>
              <td style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>{g.username}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Roller — demo/seviye360-app.html'deki "roller" ekranının gerçek karşılığı
 * (branch portalda `restricted: true`, yalnızca Şube Yöneticisi'ne açık).
 * Demo üç sekme sunar (Personel/Öğrenciler/Veliler) — her birinde arama ve
 * inline kullanıcı adı (bu depoda login e-postası) düzenleme. Personel
 * sekmesi ayrıca sistem rolünü değiştirir (Personel'in oluşturma sırasında
 * sabitlediği rolü SONRADAN değiştirmeyi sağlar).
 */
export function RolesDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("personel");
  const [search, setSearch] = useState("");

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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  const isHqCrossBranch = me.role === "SUPERADMIN" && !me.actingTenantId;
  if (!ALLOWED_ROLES.includes(me.role) && !(me.role === "SUPERADMIN" && me.actingTenantId) && !isHqCrossBranch) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Roller yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>{isHqCrossBranch ? "Roller — Tüm Şubeler" : "Roller"}</h1>
      <p className="lede">
        {isHqCrossBranch
          ? "Genel Merkez, tüm şubelerdeki personel/öğrenci/veli kullanıcı adlarını salt-okunur olarak görüntüler. Rol veya kullanıcı adı değiştirmek için Kurum Yönetimi'nden ilgili şubeye \"Bu Şube Olarak Yönet\" ile geçin."
          : "Personel sistem rolünü ve personel/öğrenci/veli kullanıcı adlarını yönetin."}
      </p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`screen-tab ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card card-pad">
        <div className="field" style={{ maxWidth: 340, marginBottom: 16 }}>
          <label>Ara</label>
          <input
            type="text"
            placeholder={isHqCrossBranch ? "İsim, kullanıcı adı veya şube…" : "İsim veya kullanıcı adı…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isHqCrossBranch ? (
          <>
            {tab === "personel" && <HqPersonelTab search={search} />}
            {tab === "ogrenciler" && <HqOgrencilerTab search={search} />}
            {tab === "veliler" && <HqVelilerTab search={search} />}
          </>
        ) : (
          <>
            {tab === "personel" && <PersonelTab search={search} />}
            {tab === "ogrenciler" && <OgrencilerTab search={search} />}
            {tab === "veliler" && <VelilerTab search={search} />}
          </>
        )}
      </div>
    </div>
  );
}
