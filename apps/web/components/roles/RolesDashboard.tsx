"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchStaff, staffKeys, updateStaffRole, type StaffUserRole } from "@/lib/api/staff";
import { Icon } from "@/components/ui/icons";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

const ROLE_LABEL: Record<StaffUserRole, string> = {
  BRANCH_ADMIN: "Şube Yöneticisi",
  ACCOUNTING: "Muhasebe Görevlisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
};

/**
 * Roller — demo/seviye360-app.html'deki "roller" ekranının gerçek karşılığı
 * (branch portalda `restricted: true`, yalnızca Şube Yöneticisi'ne açık).
 * Personel'in (bkz. components/personel/PersonelDashboard.tsx) oluşturma
 * sırasında sabitlediği sistem rolünü SONRADAN değiştirmeyi sağlar.
 */
export function RolesDashboard() {
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

  const roleMutation = useMutation({
    mutationFn: ({ staffId, role }: { staffId: string; role: StaffUserRole }) => updateStaffRole(staffId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffKeys.list() }),
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
          Bu modüle erişim yetkiniz yok. Roller yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const staff = (staffQuery.data?.staff ?? []).filter((s) => s.isActive);

  return (
    <div className="screen">
      <h1>Roller</h1>
      <p className="lede">Personelin sistem rolünü (yetki seviyesini) değiştirin.</p>

      <div className="card card-pad">
        {staffQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : staff.length === 0 ? (
          <div className="empty-state">
            <Icon name="users" />
            <p>Henüz aktif personel yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Ünvan</th>
                  <th>Sistem Rolü</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
