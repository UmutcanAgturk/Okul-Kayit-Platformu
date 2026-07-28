"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTeachers, teacherKeys } from "@/lib/api/teachers";
import {
  clubKeys,
  createClub,
  fetchBranchClubs,
  fetchClubDetail,
  fetchStudentClubs,
  fetchTeacherClubs,
  toggleClubMember,
  toggleMyClubMembership,
} from "@/lib/api/clubs";

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

function ClubRosterPanel({ clubId, onClose }: { clubId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({ queryKey: clubKeys.detail(clubId), queryFn: () => fetchClubDetail(clubId) });
  const toggleMutation = useMutation({
    mutationFn: (studentId: string) => toggleClubMember(clubId, studentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) }),
  });

  const roster = detailQuery.data?.roster ?? [];

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Üyeleri Yönet</span>
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

function BranchClubsView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const clubsQuery = useQuery({ queryKey: clubKeys.branchList(), queryFn: fetchBranchClubs });
  const teachersQuery = useQuery({ queryKey: teacherKeys.list(), queryFn: fetchTeachers });
  const teachers = teachersQuery.data?.teachers ?? [];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [advisorTeacherId, setAdvisorTeacherId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createClub({ name, description: description.trim() || undefined, advisorTeacherId: advisorTeacherId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clubKeys.branchList() });
      setName("");
      setDescription("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kulüp oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Kulüp adı zorunludur.");
      return;
    }
    createMutation.mutate();
  }

  const clubs = clubsQuery.data?.clubs ?? [];

  return (
    <div className="space-y-6">
      <TopBar title="Kulüpler / Sosyal Etkinlikler" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />

      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Yeni Kulüp</h2>
        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Kulüp Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn. Satranç Kulübü"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Danışman (opsiyonel)</label>
            <select
              value={advisorTeacherId}
              onChange={(e) => setAdvisorTeacherId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">Seçilmedi</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.branch})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Açıklama (opsiyonel)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa açıklama…"
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          {formError && <p className="text-xs text-red-600 dark:text-red-400 sm:col-span-2">{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="rounded-lg bg-[#0071ce] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00558f] disabled:opacity-60 sm:col-span-2"
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Kulübü Oluştur"}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {clubsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Henüz kulüp yok.</p>}
        {clubs.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{c.name}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.memberCount} üye</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description ?? "Açıklama eklenmemiş."}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Danışman: {c.advisorName ?? "—"}</p>
            <button
              type="button"
              onClick={() => setExpandedClubId(expandedClubId === c.id ? null : c.id)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {expandedClubId === c.id ? "Üyeleri Gizle" : "Üyeleri Yönet"}
            </button>
            {expandedClubId === c.id && <ClubRosterPanel clubId={c.id} onClose={() => setExpandedClubId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherClubsView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
  const clubsQuery = useQuery({ queryKey: clubKeys.teacherList(), queryFn: fetchTeacherClubs });
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const clubs = clubsQuery.data?.clubs ?? [];

  return (
    <div className="space-y-6">
      <TopBar title="Kulüplerim" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />
      <p className="text-sm text-slate-500 dark:text-slate-400">Danışmanı olduğunuz kulüpler ve üyeleri.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {clubsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Henüz danışmanı olduğunuz bir kulüp yok.</p>
        )}
        {clubs.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{c.name}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.memberCount} üye</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description ?? "Açıklama eklenmemiş."}</p>
            <button
              type="button"
              onClick={() => setExpandedClubId(expandedClubId === c.id ? null : c.id)}
              className="mt-2 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {expandedClubId === c.id ? "Üyeleri Gizle" : "Üyeleri Yönet"}
            </button>
            {expandedClubId === c.id && <ClubRosterPanel clubId={c.id} onClose={() => setExpandedClubId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentClubsView({ me, onLogout }: { me: { firstName: string; lastName: string }; onLogout: () => void }) {
  const queryClient = useQueryClient();
  const clubsQuery = useQuery({ queryKey: clubKeys.studentList(), queryFn: fetchStudentClubs });
  const clubs = clubsQuery.data?.clubs ?? [];

  const joinMutation = useMutation({
    mutationFn: (clubId: string) => toggleMyClubMembership(clubId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clubKeys.studentList() }),
  });

  return (
    <div className="space-y-6">
      <TopBar title="Kulüpler" firstName={me.firstName} lastName={me.lastName} onLogout={onLogout} />
      <p className="text-sm text-slate-500 dark:text-slate-400">Kurumunuzdaki kulüplere katılın.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {clubsQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Henüz kulüp yok.</p>}
        {clubs.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{c.name}</h3>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.memberCount} üye</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description ?? "Açıklama eklenmemiş."}</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Danışman: {c.advisorName ?? "—"}</p>
            <button
              type="button"
              onClick={() => joinMutation.mutate(c.id)}
              disabled={joinMutation.isPending}
              className={
                "mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 " +
                (c.isMember
                  ? "border border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  : "bg-[#0071ce] text-white hover:bg-[#00558f]")
              }
            >
              {c.isMember ? "Ayrıl" : "Katıl"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Kulüpler / Sosyal Etkinlikler — demo'daki "branch:kulup"/"teacher:kulup"/
 * "student:kulup" ekranlarının gerçek karşılığı. `Club` yalnızca düz
 * `tenant_isolation` taşır (bkz. prisma/schema.prisma) — Devamsızlık/
 * Disiplin/PTA ile aynı desen. Üç rol üç farklı görünüm alır: BRANCH_ADMIN
 * kulüp oluşturur/tüm üyelikleri yönetir, TEACHER yalnızca danışmanı olduğu
 * kulüplerin üyeliklerini yönetir, STUDENT kendi üyeliğini açar/kapatır.
 */
export function ClubsDashboard() {
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

  if (me.role === "BRANCH_ADMIN") return <BranchClubsView me={me} onLogout={handleLogout} />;
  if (me.role === "TEACHER") return <TeacherClubsView me={me} onLogout={handleLogout} />;
  if (me.role === "STUDENT") return <StudentClubsView me={me} onLogout={handleLogout} />;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="text-sm font-medium text-red-700 dark:text-red-300">
        Bu modüle erişim yetkiniz yok. Kulüpler/Sosyal Etkinlikler yalnızca Şube Yöneticisi/Öğretmen/Öğrenci rolüne
        açıktır.
      </p>
    </div>
  );
}
