"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
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
import { Icon } from "@/components/ui/icons";

function ClubRosterPanel({ clubId, onClose }: { clubId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery({ queryKey: clubKeys.detail(clubId), queryFn: () => fetchClubDetail(clubId) });
  const toggleMutation = useMutation({
    mutationFn: (studentId: string) => toggleClubMember(clubId, studentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clubKeys.detail(clubId) }),
  });

  const roster = detailQuery.data?.roster ?? [];

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--ink-faint)" }}>Üyeleri Yönet</span>
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

function BranchClubsView({ me }: { me: { firstName: string; lastName: string } }) {
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
    <div className="screen">
      <h1>Kulüpler / Sosyal Etkinlikler</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Yeni Kulüp</h3>
        </div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field">
            <label>Kulüp Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Satranç Kulübü" />
          </div>
          <div className="field">
            <label>Danışman (opsiyonel)</label>
            <select value={advisorTeacherId} onChange={(e) => setAdvisorTeacherId(e.target.value)}>
              <option value="">Seçilmedi</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.branch})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Açıklama (opsiyonel)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Kısa açıklama…" />
          </div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn primary"
            style={{ gridColumn: "1 / -1", justifyContent: "center" }}
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Kulübü Oluştur"}
          </button>
        </form>
      </div>

      <div className="grid cols-2">
        {clubsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && (
          <div className="empty-state">
            <Icon name="trophy" />
            <p>Henüz kulüp yok.</p>
          </div>
        )}
        {clubs.map((c) => (
          <div key={c.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{c.name}</h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.memberCount} üye</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.description ?? "Açıklama eklenmemiş."}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Danışman: {c.advisorName ?? "—"}</p>
            <button type="button" onClick={() => setExpandedClubId(expandedClubId === c.id ? null : c.id)} className="btn xs" style={{ marginTop: 8 }}>
              {expandedClubId === c.id ? "Üyeleri Gizle" : "Üyeleri Yönet"}
            </button>
            {expandedClubId === c.id && <ClubRosterPanel clubId={c.id} onClose={() => setExpandedClubId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherClubsView({ me }: { me: { firstName: string; lastName: string } }) {
  const clubsQuery = useQuery({ queryKey: clubKeys.teacherList(), queryFn: fetchTeacherClubs });
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const clubs = clubsQuery.data?.clubs ?? [];

  return (
    <div className="screen">
      <h1>Kulüplerim</h1>
      <p className="lede">Danışmanı olduğunuz kulüpler ve üyeleri.</p>

      <div className="grid cols-2">
        {clubsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && (
          <div className="empty-state">
            <Icon name="trophy" />
            <p>Henüz danışmanı olduğunuz bir kulüp yok.</p>
          </div>
        )}
        {clubs.map((c) => (
          <div key={c.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{c.name}</h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.memberCount} üye</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.description ?? "Açıklama eklenmemiş."}</p>
            <button type="button" onClick={() => setExpandedClubId(expandedClubId === c.id ? null : c.id)} className="btn xs" style={{ marginTop: 8 }}>
              {expandedClubId === c.id ? "Üyeleri Gizle" : "Üyeleri Yönet"}
            </button>
            {expandedClubId === c.id && <ClubRosterPanel clubId={c.id} onClose={() => setExpandedClubId(null)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentClubsView({ me }: { me: { firstName: string; lastName: string } }) {
  const queryClient = useQueryClient();
  const clubsQuery = useQuery({ queryKey: clubKeys.studentList(), queryFn: fetchStudentClubs });
  const clubs = clubsQuery.data?.clubs ?? [];

  const joinMutation = useMutation({
    mutationFn: (clubId: string) => toggleMyClubMembership(clubId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clubKeys.studentList() }),
  });

  return (
    <div className="screen">
      <h1>Kulüpler</h1>
      <p className="lede">Kurumunuzdaki kulüplere katılın.</p>

      <div className="grid cols-2">
        {clubsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!clubsQuery.isLoading && clubs.length === 0 && (
          <div className="empty-state">
            <Icon name="trophy" />
            <p>Henüz kulüp yok.</p>
          </div>
        )}
        {clubs.map((c) => (
          <div key={c.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{c.name}</h3>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.memberCount} üye</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{c.description ?? "Açıklama eklenmemiş."}</p>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Danışman: {c.advisorName ?? "—"}</p>
            <button
              type="button"
              onClick={() => joinMutation.mutate(c.id)}
              disabled={joinMutation.isPending}
              className={c.isMember ? "btn xs" : "btn primary xs"}
              style={{ marginTop: 8 }}
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

  if (me.role === "BRANCH_ADMIN" || (me.role === "SUPERADMIN" && me.actingTenantId)) return <BranchClubsView me={me} />;
  if (me.role === "TEACHER") return <TeacherClubsView me={me} />;
  if (me.role === "STUDENT") return <StudentClubsView me={me} />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok. Kulüpler/Sosyal Etkinlikler yalnızca Şube Yöneticisi/Öğretmen/Öğrenci rolüne
        açıktır.
      </p>
    </div>
  );
}
