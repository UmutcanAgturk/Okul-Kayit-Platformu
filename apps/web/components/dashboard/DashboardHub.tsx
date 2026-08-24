"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { modulesForActor, groupModules, type ModuleCard } from "@/lib/nav-config";
import { Icon } from "@/components/ui/icons";

const USAGE_KEY = "seviye360.hub-usage";

function loadUsage(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(USAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Tüm gerçek modüllerin tek yerden erişildiği giriş noktası. Kategorilere
 * ayrılmış ızgaraya ek olarak: bir arama kutusu (modülleri ada/açıklamaya göre
 * süzer) ve "Sık Kullanılanlar" (localStorage'daki tıklama sayacından, role
 * göre en çok açılan modüller) kısayol bölümü.
 */
export function DashboardHub() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    setUsage(loadUsage());
  }, []);

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

  const modules = useMemo(() => (me ? modulesForActor(me.role, me.actingTenantId) : []), [me]);

  const q = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = useMemo(
    () => (q ? modules.filter((m) => m.title.toLocaleLowerCase("tr-TR").includes(q) || m.description.toLocaleLowerCase("tr-TR").includes(q)) : modules),
    [modules, q],
  );
  const groups = useMemo(() => groupModules(filtered), [filtered]);

  const featured = useMemo(() => {
    if (q) return [];
    return [...modules]
      .filter((m) => (usage[m.href] ?? 0) > 0)
      .sort((a, b) => (usage[b.href] ?? 0) - (usage[a.href] ?? 0))
      .slice(0, 6);
  }, [modules, usage, q]);

  function recordClick(href: string) {
    const next = { ...loadUsage(), [href]: (loadUsage()[href] ?? 0) + 1 };
    try {
      window.localStorage.setItem(USAGE_KEY, JSON.stringify(next));
    } catch {
      /* kota dolu vb. — yoksay */
    }
    setUsage(next);
  }

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  const renderCard = (m: ModuleCard) => (
    <a key={m.href} href={m.href} className="hub-card" onClick={() => recordClick(m.href)}>
      <span className="icon-wrap">
        <Icon name={m.icon} />
      </span>
      <span>
        <b>{m.title}</b>
        <span className="desc">{m.description}</span>
      </span>
    </a>
  );

  return (
    <div className="screen">
      <h1>Modüller</h1>
      <p className="lede">
        {me.firstName} {me.lastName} için erişilebilir tüm modüller aşağıda listelenir.
      </p>

      <div className="field" style={{ maxWidth: 380, marginBottom: 18 }}>
        <label>Modül Ara</label>
        <input type="text" placeholder="İsim veya açıklama…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>

      {featured.length > 0 && (
        <div>
          <div className="hub-group-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="star" /> Sık Kullanılanlar
          </div>
          <div className="hub-grid">{featured.map(renderCard)}</div>
        </div>
      )}

      {modules.length === 0 ? (
        <div className="card card-pad">
          <p style={{ margin: 0, fontWeight: 600 }}>Bu rol için henüz gerçek (veritabanı bağlantılı) bir modül yok.</p>
        </div>
      ) : groups.length > 0 ? (
        groups.map((g) => (
          <div key={g.label}>
            <div className="hub-group-title">{g.label}</div>
            <div className="hub-grid">{g.items.map(renderCard)}</div>
          </div>
        ))
      ) : (
        <div className="empty-state">
          <Icon name="search" />
          <p>&quot;{query}&quot; ile eşleşen modül yok.</p>
        </div>
      )}
    </div>
  );
}
