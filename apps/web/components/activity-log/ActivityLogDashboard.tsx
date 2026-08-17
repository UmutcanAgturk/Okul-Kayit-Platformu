"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { activityLogKeys, fetchActivityLog } from "@/lib/api/activity-log";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Aktivite Akışı (Audit Log) — demo/seviye360-app.html'deki "branch:aktivite"
 * ekranının gerçek karşılığı. `AuditLogEntry` yalnızca BRANCH_ADMIN/SUPERADMIN
 * tarafından görülebilir (bkz. prisma/schema.prisma'daki not) — kayıt,
 * ödeme, disiplin ve atama gibi platformdaki kritik işlemlerin kronolojik
 * denetim izidir. Şu an yalnızca en yeni modüllerin (Disiplin, Veli
 * Görüşmesi, Kulüpler) yazma işlemleri bu akışa kaydedilir — demo'nun kendisi
 * de her mutasyonu değil, seçili kritik aksiyonları loglar.
 */
export function ActivityLogDashboard() {
  const router = useRouter();

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

  const logQuery = useQuery({ queryKey: activityLogKeys.list(), queryFn: fetchActivityLog, enabled: !!me });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Aktivite Akışı yalnızca Şube Yöneticisi rolüne açıktır.
        </p>
      </div>
    );
  }

  const entries = logQuery.data?.entries ?? [];

  return (
    <div className="screen">
      <h1>Aktivite Akışı</h1>
      <p className="lede">
        Kayıt, ödeme, disiplin ve atama gibi platformdaki kritik işlemlerin kronolojik denetim izi.
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad">
        {logQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!logQuery.isLoading && entries.length === 0 && (
          <div className="empty-state">
            <Icon name="clock" />
            <p>Henüz kayıt yok.</p>
          </div>
        )}
        <div style={{ maxHeight: 640, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {entries.map((e) => (
            <div key={e.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{e.action}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(e.createdAt)}</span>
              </div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {e.actorLabel}
                {e.detail && ` · ${e.detail}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
