"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { collectInstallment } from "@/lib/api/accounting";
import {
  dailyOpsKeys,
  fetchDailyOps,
  fetchStaffAttendance,
  setStaffAttendance,
  type StaffAttendanceClientStatus,
} from "@/lib/api/daily-ops";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED_ROLES = ["BRANCH_ADMIN", "ACCOUNTING"];

function tl(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

const STAFF_ATTENDANCE_LABEL: Record<StaffAttendanceClientStatus, string> = { GELDI: "Geldi", GELMEDI: "Gelmedi", IZINLI: "İzinli" };
const STAFF_ATTENDANCE_CHIP: Record<StaffAttendanceClientStatus, string> = { GELDI: "chip strong", GELMEDI: "chip critical", IZINLI: "chip weak" };

/**
 * Personel Devam Durumu — demo'daki "Günlük Operasyon Paneli"nin aynı adlı
 * kartı (bkz. app/api/branch/staff-attendance). Demo ile BİREBİR aynı
 * "yalnızca istisna" deseni: Geldi hiç kayıt olarak saklanmaz, yalnızca
 * Gelmedi/İzinli istisnaları API'ye yazılır.
 */
function StaffAttendancePanel() {
  const queryClient = useQueryClient();
  const attendanceQuery = useQuery({ queryKey: dailyOpsKeys.staffAttendance(), queryFn: fetchStaffAttendance });
  const roster = attendanceQuery.data?.staff ?? [];

  const setMutation = useMutation({
    mutationFn: (vars: { userId: string; status: StaffAttendanceClientStatus }) => setStaffAttendance(vars.userId, vars.status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dailyOpsKeys.staffAttendance() }),
  });

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Personel Devam Durumu</h3>
        <span className="hint">{roster.filter((s) => s.status !== "GELDI").length} istisna</span>
      </div>
      {attendanceQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : roster.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz personel kaydı yok.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 340, overflowY: "auto" }}>
          {roster.map((s) => (
            <div key={s.userId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{s.title}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <span className={STAFF_ATTENDANCE_CHIP[s.status]} style={{ fontSize: "var(--text-2xs)" }}>
                  {STAFF_ATTENDANCE_LABEL[s.status]}
                </span>
                {s.status === "GELDI" ? (
                  <>
                    <button type="button" className="btn xs" disabled={setMutation.isPending} onClick={() => setMutation.mutate({ userId: s.userId, status: "GELMEDI" })}>
                      Gelmedi
                    </button>
                    <button type="button" className="btn xs" disabled={setMutation.isPending} onClick={() => setMutation.mutate({ userId: s.userId, status: "IZINLI" })}>
                      İzinli
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn xs" disabled={setMutation.isPending} onClick={() => setMutation.mutate({ userId: s.userId, status: "GELDI" })}>
                    Geldi İşaretle
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Günlük Operasyon Paneli" — demo/seviye360-app.html'deki SCREENS["branch:ops"]'un
 * gerçek karşılığı (bkz. app/api/branch/daily-ops + app/api/branch/staff-attendance).
 * "Bugün" Özeti'nden (components/today-summary altında, varsa) farkı: yalnızca
 * sayı değil, her satırdan doğrudan aksiyon alınabilen (Tahsil Et, Geldi/
 * Gelmedi/İzinli işaretleme) bir operasyon konsolu.
 */
export function DailyOpsView() {
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

  const opsQuery = useQuery({ queryKey: dailyOpsKeys.all(), queryFn: fetchDailyOps, enabled: !!me });
  const attendanceQuery = useQuery({ queryKey: dailyOpsKeys.staffAttendance(), queryFn: fetchStaffAttendance, enabled: !!me });

  const collectMutation = useMutation({
    mutationFn: collectInstallment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: dailyOpsKeys.all() }),
  });

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
          Bu modüle erişim yetkiniz yok. Günlük Operasyon Paneli yalnızca Şube Yöneticisi/Muhasebe rolüne açıktır.
        </p>
      </div>
    );
  }

  const ops = opsQuery.data;

  return (
    <div className="screen">
      <h1>Günlük Operasyon Paneli</h1>
      <p className="lede">Bugünün kritik operasyonel görünümü — tamamı canlı veriden hesaplanır.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      {opsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {ops && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="grid cols-4">
            <div className="card stat-card">
              <p className="stat-label">Bugün · {ops.date}</p>
              <p className="stat-value">
                {attendanceQuery.data ? `${attendanceQuery.data.presentCount}/${attendanceQuery.data.totalCount}` : "—"}
              </p>
              <p className="stat-sub">personel bugün mesaide</p>
            </div>
            <div className={`card stat-card ${ops.overduePayments.length ? "tone-critical" : ""}`}>
              <p className="stat-label">Geciken Ödeme</p>
              <p className="stat-value" style={ops.overduePayments.length ? { color: "var(--critical)" } : undefined}>
                {ops.overduePayments.length}
              </p>
              <p className="stat-sub">{tl(ops.overdueTotal)} toplam</p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">Yaklaşan Ödeme (7 gün)</p>
              <p className="stat-value">{ops.upcomingPayments.length}</p>
              <p className="stat-sub">veli takip listesinde</p>
            </div>
            <div className="card stat-card tone-strong">
              <p className="stat-label">Bugünkü Etüt</p>
              <p className="stat-value">{ops.todayEtutTotal}</p>
              <p className="stat-sub">{ops.todayEtut.length} aktif slot</p>
            </div>
          </div>

          <div className="grid cols-3">
            <StaffAttendancePanel />
            <div className="card card-pad">
              <div className="card-head">
                <h3>Ödemesi Geciken Öğrenciler</h3>
              </div>
              {ops.overduePayments.length === 0 ? (
                <div className="empty-state">
                  <Icon name="check" />
                  <p>Gecikmiş ödeme yok — tüm veliler güncel.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                  {ops.overduePayments.map((r) => (
                    <div
                      key={r.installmentId}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                    >
                      <div>
                        <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                          #{r.installmentNo} · {tl(Number(r.amount))} · {r.daysLate} gün gecikti
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => collectMutation.mutate(r.installmentId)}
                        disabled={collectMutation.isPending}
                        className="btn primary xs"
                      >
                        Tahsil Et
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card card-pad">
              <div className="card-head">
                <h3>Yaklaşan Ödemeler</h3>
              </div>
              {ops.upcomingPayments.length === 0 ? (
                <div className="empty-state">
                  <Icon name="calendar" />
                  <p>Önümüzdeki 7 gün içinde vadesi gelen taksit yok.</p>
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                  {ops.upcomingPayments.map((r) => (
                    <div
                      key={r.installmentId}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "9px 0" }}
                    >
                      <div>
                        <div style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>{r.studentName}</div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                          #{r.installmentNo} · {tl(Number(r.amount))} · Vade: {new Date(r.dueDate).toLocaleDateString("tr-TR")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => collectMutation.mutate(r.installmentId)}
                        disabled={collectMutation.isPending}
                        className="btn xs"
                      >
                        Erken Tahsil
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card card-pad">
            <div className="card-head">
              <h3>Bugünkü Etüt Doluluğu</h3>
            </div>
            {ops.todayEtut.length === 0 ? (
              <div className="empty-state">
                <Icon name="heart" />
                <p>Bugün için onaylı/bekleyen etüt talebi yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ops.todayEtut.map((s) => (
                  <div key={`${s.subject}-${s.time}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "var(--text-base)" }}>
                    <span>{s.subject} · {s.time}</span>
                    <span style={{ color: "var(--ink-muted)" }}>{s.count} öğrenci</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
