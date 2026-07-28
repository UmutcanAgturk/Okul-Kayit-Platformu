"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  busRouteKeys,
  createBusRoute,
  fetchBusRouteDetail,
  fetchBusRoutes,
  fetchStudentBusRoute,
  toggleBusRouteMember,
} from "@/lib/api/bus-routes";

function TopBar({ title, firstName, lastName, onLogout }: { title: string; firstName: string; lastName: string; onLogout: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {firstName} {lastName}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Ana Sayfa
        </a>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  );
}

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
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Öğrencileri Yönet</span>
        <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
          Kapat
        </button>
      </div>
      {detailQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {roster.map((s) => (
          <div key={s.studentId} className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm dark:border-slate-800">
            <div>
              <span className="text-slate-900 dark:text-slate-50">{s.name}</span>
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{s.classroom ?? "—"}</span>
            </div>
            <button
              type="button"
              onClick={() => toggleMutation.mutate(s.studentId)}
              className={
                "rounded-lg px-2 py-1 text-xs font-semibold " +
                (s.isMember ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/40 dark:text-red-300" : "bg-[#0071ce] text-white hover:bg-[#00558f]")
              }
            >
              {s.isMember ? "Çıkar" : "Ekle"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BranchBusRoutesView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
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
    <div className="space-y-6">
      <TopBar title="Servis / Ulaşım Takibi" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Güzergah</h2>
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Güzergah Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Kuzey Hattı"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kapasite</label>
            <input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Şoför (opsiyonel)</label>
            <input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Ad Soyad"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Şoför Telefonu (opsiyonel)</label>
            <input
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              placeholder="05XX XXX XX XX"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Duraklar (virgülle ayırın)</label>
            <input
              value={stopsText}
              onChange={(e) => setStopsText(e.target.value)}
              placeholder="Örn. Merkez Meydan, Çamlık Mah., Okul"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60 sm:col-span-2"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Güzergahı Oluştur"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {routesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!routesQuery.isLoading && routes.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Henüz güzergah yok.</p>}
        {routes.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{r.name}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {r.memberCount}/{r.capacity}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Şoför: {r.driverName ?? "—"} · {r.driverPhone ?? "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Duraklar: {r.stops.length ? r.stops.join(" → ") : "—"}</p>
            <button
              type="button"
              onClick={() => setExpandedRouteId(expandedRouteId === r.id ? null : r.id)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
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
  onLogout,
}: {
  me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] };
  onLogout: () => void;
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
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
        Öğrenci kaydı bulunamadı.
      </div>
    );
  }

  const route = routeQuery.data?.route ?? null;

  return (
    <div className="space-y-6">
      <TopBar title="Servisim" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      {students.length > 1 && (
        <div className="flex gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className={
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition " +
                (selectedStudentId === s.studentId
                  ? "border-[#0071ce] bg-[#0071ce] text-white"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800")
              }
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {routeQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}

      {!routeQuery.isLoading && !route && (
        <p className="text-sm text-slate-500 dark:text-slate-400">Henüz bir servis güzergahına atanmadı.</p>
      )}

      {route && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{route.name}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Şoför: {route.driverName ?? "—"} · {route.driverPhone ?? "—"}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">Duraklar:</p>
          {route.stops.length === 0 ? (
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Durak bilgisi girilmemiş.</p>
          ) : (
            <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-xs text-slate-500 dark:text-slate-400">
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

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }

  if (me.role === "BRANCH_ADMIN") return <BranchBusRoutesView me={me} onLogout={handleLogout} />;
  if (me.role === "STUDENT" || me.role === "PARENT") return <StudentBusRouteView me={me} onLogout={handleLogout} />;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        Bu modüle erişim yetkiniz yok. Servis/Ulaşım Takibi yalnızca Şube Yöneticisi/Öğrenci/Veli rolüne açıktır.
      </p>
    </div>
  );
}
