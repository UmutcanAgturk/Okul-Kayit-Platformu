"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchTeachers, teacherKeys } from "@/lib/api/teachers";
import {
  createPtaRequest,
  fetchBranchPtaRequests,
  fetchStudentPtaRequests,
  fetchTeacherPtaRequests,
  ptaKeys,
  respondToPtaRequest,
} from "@/lib/api/pta";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";
import type { MeResponse } from "@/lib/api/auth";

const STATUS_LABEL: Record<string, string> = { BEKLIYOR: "Bekliyor", ONAYLANDI: "Onaylandı", REDDEDILDI: "Reddedildi" };
const STATUS_CHIP: Record<string, string> = { BEKLIYOR: "weak", ONAYLANDI: "strong", REDDEDILDI: "critical" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

function ParentPtaView({ me }: { me: { firstName: string; lastName: string; students?: { studentId: string; fullName: string }[] } }) {
  const queryClient = useQueryClient();
  const students = me.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const teachersQuery = useQuery({ queryKey: teacherKeys.list(), queryFn: fetchTeachers });
  const teachers = teachersQuery.data?.teachers ?? [];

  const [teacherId, setTeacherId] = useState("");
  useEffect(() => {
    if (teachers.length > 0 && !teacherId) setTeacherId(teachers[0].id);
  }, [teachers, teacherId]);

  const [date, setDate] = useState("");
  const [time, setTime] = useState("15:00");
  const [topic, setTopic] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ptaKeys.byStudent(selectedStudentId ?? ""),
    queryFn: () => fetchStudentPtaRequests(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  const createMutation = useMutation({
    mutationFn: () => createPtaRequest(selectedStudentId!, { teacherId, requestedAt: new Date(`${date}T${time}`).toISOString(), topic: topic.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ptaKeys.byStudent(selectedStudentId ?? "") });
      setTopic("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Talep gönderilemedi."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudentId || !teacherId || !date) {
      setFormError("Öğretmen ve tarih seçmelisiniz.");
      return;
    }
    createMutation.mutate();
  }

  if (students.length === 0) {
    return (
      <div className="screen">
        <h1>Veli-Öğretmen Görüşmesi</h1>
        <div className="card card-pad">
          <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--weak)" }}>
            Velisi olduğunuz bir öğrenci bulunamadı.
          </p>
        </div>
      </div>
    );
  }

  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="screen">
      <h1>Veli-Öğretmen Görüşmesi</h1>
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

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Yeni Randevu Talebi</h3>
          </div>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>Öğretmen</label>
              <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.branch})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid cols-2">
              <div className="field">
                <label>Tarih</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Saat</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Görüşme Konusu (opsiyonel)</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Örn. Sınav performansı hakkında görüşmek istiyorum"
              />
            </div>

            {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

            <button
              type="submit"
              disabled={createMutation.isPending || teachers.length === 0}
              className="btn primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              {createMutation.isPending ? "Gönderiliyor…" : "Talep Gönder"}
            </button>
          </form>
        </div>

        <div className="card card-pad">
          <div className="card-head">
            <h3>Taleplerim</h3>
          </div>
          {requestsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {!requestsQuery.isLoading && requests.length === 0 && (
            <div className="empty-state">
              <Icon name="users" />
              <p>Henüz talebiniz yok.</p>
            </div>
          )}
          <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {requests.map((r) => (
              <div key={r.id} style={{ borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.teacherName}</span>
                  <span className={`chip ${STATUS_CHIP[r.status] ?? "neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherPtaView({ me }: { me: { firstName: string; lastName: string } }) {
  const queryClient = useQueryClient();
  const requestsQuery = useQuery({ queryKey: ptaKeys.teacherInbox(), queryFn: fetchTeacherPtaRequests });
  const requests = requestsQuery.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "BEKLIYOR");
  const decided = requests.filter((r) => r.status !== "BEKLIYOR");

  const respondMutation = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVE" | "REJECT" }) => respondToPtaRequest(id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ptaKeys.teacherInbox() }),
  });

  return (
    <div className="screen">
      <h1>Veli Görüşmeleri</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h3>Bekleyen Talepler ({pending.length})</h3>
        </div>
        {requestsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!requestsQuery.isLoading && pending.length === 0 && (
          <div className="empty-state">
            <Icon name="check" />
            <p>Bekleyen talep yok.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {pending.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => respondMutation.mutate({ id: r.id, decision: "APPROVE" })}
                  className="btn success solid xs"
                >
                  Onayla
                </button>
                <button
                  type="button"
                  onClick={() => respondMutation.mutate({ id: r.id, decision: "REJECT" })}
                  className="btn danger solid xs"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Geçmiş</h3>
        </div>
        {decided.length === 0 && (
          <div className="empty-state">
            <Icon name="clock" />
            <p>Henüz geçmiş kayıt yok.</p>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {decided.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{formatDateTime(r.requestedAt)}</div>
              </div>
              <span className={`chip ${STATUS_CHIP[r.status] ?? "neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BranchPtaView({ me }: { me: MeResponse }) {
  const requestsQuery = useQuery({ queryKey: ptaKeys.branchAll(), queryFn: fetchBranchPtaRequests });
  const requests = requestsQuery.data?.requests ?? [];

  return (
    <div className="screen">
      <h1>Veli Görüşmeleri</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />
      <div className="card card-pad">
        <div className="card-head">
          <h3>Talepler ({requests.length})</h3>
        </div>
        {requestsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!requestsQuery.isLoading && requests.length === 0 && (
          <div className="empty-state">
            <Icon name="users" />
            <p>Henüz talep yok.</p>
          </div>
        )}
        <div style={{ maxHeight: 560, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {requests.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}>
              <div>
                <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                  {r.studentName} <span style={{ fontWeight: 400, color: "var(--ink-faint)" }}>→ {r.teacherName}</span>
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                  {formatDateTime(r.requestedAt)}
                  {r.topic && ` · ${r.topic}`}
                </div>
              </div>
              <span className={`chip ${STATUS_CHIP[r.status] ?? "neutral"}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Veli-Öğretmen Görüşme Randevusu — demo'daki "student:veligorusme"
 * (guardianOnly), "teacher:veligorusme", "branch:veligorusme" ekranlarının
 * gerçek karşılığı. `PtaMeetingRequest` yalnızca düz `tenant_isolation`
 * taşır (bkz. prisma/schema.prisma) — Devamsızlık/Disiplin ile aynı desen.
 * Üç farklı rol üç farklı görünüm alır: PARENT talep oluşturur, TEACHER
 * onaylar/reddeder, BRANCH_ADMIN/GUIDANCE_COORDINATOR tüm kurumu izler.
 */
export function PtaDashboard() {
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

  if (me.role === "PARENT") return <ParentPtaView me={me} />;
  if (me.role === "TEACHER") return <TeacherPtaView me={me} />;
  if (me.role === "BRANCH_ADMIN" || me.role === "GUIDANCE_COORDINATOR" || me.role === "SUPERADMIN") return <BranchPtaView me={me} />;

  return (
    <div className="card card-pad">
      <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
        Bu modüle erişim yetkiniz yok. Veli-Öğretmen Görüşmesi yalnızca Veli/Öğretmen/Şube Yöneticisi/Rehber Öğretmen
        rolüne açıktır.
      </p>
    </div>
  );
}
