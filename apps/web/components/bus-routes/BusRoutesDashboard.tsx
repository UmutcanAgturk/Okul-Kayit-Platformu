"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  busRouteKeys,
  createBusRoute,
  fetchBusRouteDetail,
  fetchBusRoutes,
  fetchStudentBusRoute,
  toggleBusRouteMember,
} from "@/lib/api/bus-routes";
import { Icon } from "@/components/ui/icons";

function RouteRosterPanel({ routeId, onClose }: { routeId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({ queryKey: busRouteKeys.detail(routeId), queryFn: () => fetchBusRouteDetail(routeId) });
  const toggleMutation = useMutation({
    mutationFn: (studentId: string) => toggleBusRouteMember(routeId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: busRouteKeys.detail(routeId) });
      queryClient.invalidateQueries({ queryKey: busRouteKeys.branchList() });
    },
  });

  const roster = detailQuery.data?.roster ?? [];

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-faint)" }}>Öğrencileri Yönet</span>
        <button type="button" onClick={onClose} className="btn xs">
          Kapat
        </button>
      </div>
      {detailQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      <div style={{ maxHeight: 256, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {roster.map((s) => (
          <div key={s.studentId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "6px 0" }}>
            <div>
              <span style={{ fontSize: "var(--text-base)" }}>{s.name}</span>
              <span style={{ marginLeft: 8, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{s.classroom ?? "—"}</span>
            </div>
            <button
              type="button"
              onClick={() => toggleMutation.mutate(s.studentId)}
              className={s.isMember ? "btn danger xs" : "btn primary xs"}
            >
              {s.isMember ? "Çıkar" : "Ekle"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchBusRoutesView({ me }: { me: { firstName: string; lastName: string } }) {
  const queryClient = useQueryClient();
  const routesQuery = useQuery({ queryKey: busRouteKeys.branchList(), queryFn: fetchBusRoutes });

  const [name, setName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [capacity, setCapacity] = useState("20");
  const [stopsText, setStopsText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createBusRoute({
        name,
        driverName: driverName.trim() || undefined,
        driverPhone: driverPhone.trim() || undefined,
        capacity: Number(capacity) || 20,
        stops: stopsText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: busRouteKeys.branchList() });
      setName("");
      setDriverName("");
      setDriverPhone("");
      setCapacity("20");
      setStopsText("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Güzergah oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Güzergah adı zorunludur.");
      return;
    }
    createMutation.mutate();
  }

  const routes = routesQuery.data?.routes ?? [];

  return (
    <div className="screen">
      <h1>Servis / Ulaşım Takibi</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Yeni Güzergah</h3>
        </div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field">
            <label>Güzergah Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Kuzey Hattı" />
          </div>
          <div className="field">
            <label>Kapasite</label>
            <input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <div className="field">
            <label>Şoför (opsiyonel)</label>
            <input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Ad Soyad" />
          </div>
          <div className="field">
            <label>Şoför Telefonu (opsiyonel)</label>
            <input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="05XX XXX XX XX" />
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Duraklar (virgülle ayırın)</label>
            <input
              value={stopsText}
              onChange={(e) => setStopsText(e.target.value)}
              placeholder="Örn. Merkez Meydan, Çamlık Mah., Okul"
            />
          </div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn primary"
            style={{ gridColumn: "1 / -1", justifyContent: "center" }}
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Güzergahı Oluştur"}
          </button>
        </form>
      </div>

      <div className="grid cols-2">
        {routesQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!routesQuery.isLoading && routes.length === 0 && (
          <div className="empty-state">
            <Icon name="bus" />
            <p>Henüz güzergah yok.</p>
          </div>
        )}
        {routes.map((r) => (
          <div key={r.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{r.name}</h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                {r.memberCount}/{r.capacity}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              Şoför: {r.driverName ?? "—"} · {r.driverPhone ?? "—"}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              Duraklar: {r.stops.length ? r.stops.join(" → ") : "—"}
            </p>
            <button type="button" onClick={() => setExpandedRouteId(expandedRouteId === r.id ? null : r.id)} className="btn xs" style={{ marginTop: 8 }}>
              {expandedRouteId === r.id ? "Öğrencileri Gizle" : "Öğrencileri Yönet"}
            </button>
            {expandedRouteId === r.id && <RouteRosterPanel routeId={r.id} onClose={() => setExpandedRouteId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentBusRouteView({
  me,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
}) {
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const routeQuery = useQuery({
    queryKey: busRouteKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchStudentBusRoute(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (students.length === 0) {
    return (
      <div className="screen">
        <h1>Servisim</h1>
        <div className="card card-pad">
          <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--weak)" }}>
            Öğrenci kaydı bulunamadı.
          </p>
        </div>
      </div>
    );
  }

  const route = routeQuery.data?.route ?? null;

  return (
    <div className="screen">
      <h1>Servisim</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className="btn sm"
              style={selectedStudentId === s.studentId ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" } : undefined}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {routeQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {!routeQuery.isLoading && !route && (
        <div className="empty-state">
          <Icon name="bus" />
          <p>Henüz bir servis güzergahına atanmadı.</p>
        </div>
      )}

      {route && (
        <div className="card card-pad">
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{route.name}</h3>
          <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
            Şoför: {route.driverName ?? "—"} · {route.driverPhone ?? "—"}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>Duraklar:</p>
          {route.stops.length === 0 ? (
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Durak bilgisi girilmemiş.</p>
          ) : (
            <ol style={{ margin: "4px 0 0", paddingLeft: 20, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
              {route.stops.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Servis / Ulaşım Takibi — demo/seviye360-app.html'deki "branch:servis"/
 * "student:servis" ekranlarının gerçek karşılığı. `BusRoute` yalnızca düz
 * `tenant_isolation` taşır (bkz. prisma/schema.prisma) — Kulüpler ile aynı
 * desen, ama üyelik Kulüpler'in aksine BRANCH_ADMIN tarafından yönetilir
 * (öğrenci/veli kendi kendine katılamaz/ayrılamaz).
 */
export function BusRoutesDashboard() {
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
    return null;
  }

  if (me.role === "BRANCH_ADMIN" || (me.role === "SUPERADMIN" && me.actingTenantId)) return <BranchBusRoutesView me={me} />;
  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentBusRouteView me={me} />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok. Servis/Ulaşım Takibi yalnızca Şube Yöneticisi/Öğrenci/Veli rolüne açıktır.
      </p>
    </div>
  );
}
