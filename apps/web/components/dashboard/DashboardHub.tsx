"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { modulesForActor, groupModules } from "@/lib/nav-config";
import { Icon } from "@/components/ui/icons";

/**
 * Bu depodaki tüm gerçek (Postgres'e bağlı) modüllerin tek bir yerden
 * erişilebildiği giriş noktası — demo/seviye360-app.html'deki "hub" ekranının
 * karşılığı (bkz. o dosyadaki SCREEN_ICONS/hub-grid). Rolün henüz gerçek bir
 * modülü yoksa (TEACHER/STUDENT/PARENT/SUPERADMIN/GUIDANCE_COORDINATOR bazı
 * modüllerde) bunu dürüstçe belirtir; bu roller için demo/seviye360-app.html
 * hâlâ tek kaynaktır (bkz. kök README.md).
 */
export function DashboardHub() {
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

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  const modules = modulesForActor(me.role, me.actingTenantId);
  const groups = groupModules(modules);

  return (
    <div className="screen">
      <h1>Modüller</h1>
      <p className="lede">
        {me.firstName} {me.lastName} için erişilebilir tüm modüller aşağıda listelenir.
      </p>

      {groups.length > 0 ? (
        groups.map((g) => (
          <div key={g.label}>
            <div className="hub-group-title">{g.label}</div>
            <div className="hub-grid">
              {g.items.map((m) => (
                <a key={m.href} href={m.href} className="hub-card">
                  <span className="icon-wrap">
                    <Icon name={m.icon} />
                  </span>
                  <span>
                    <b>{m.title}</b>
                    <span className="desc">{m.description}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="card card-pad">
          <p style={{ margin: 0, fontWeight: 600 }}>Bu rol için henüz gerçek (veritabanı bağlantılı) bir modül yok.</p>
          <p style={{ marginTop: 6, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
            Diğer tüm modüller, bu depodaki <code>demo/seviye360/seviye360-app.html</code> dosyasında (localStorage
            tabanlı, tarayıcıya özel) hâlâ mevcuttur — gerçek backend inşası devam ediyor.
          </p>
        </div>
      )}
    </div>
  );
}
