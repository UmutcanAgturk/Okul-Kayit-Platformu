"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { alumniKeys, createAlumnus, fetchAlumni } from "@/lib/api/alumni";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR"];

function AlumniView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: alumniKeys.branchList(), queryFn: fetchAlumni });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [university, setUniversity] = useState("");
  const [employment, setEmployment] = useState("");
  const [phone, setPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createAlumnus({
      firstName: firstName.trim(), lastName: lastName.trim(),
      graduationYear: graduationYear.trim() || undefined, university: university.trim() || undefined,
      employment: employment.trim() || undefined, phone: phone.trim() || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: alumniKeys.branchList() });
      setFirstName(""); setLastName(""); setGraduationYear(""); setUniversity(""); setEmployment(""); setPhone(""); setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Mezun kaydı eklenemedi."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setFormError("Ad ve soyad zorunludur."); return; }
    createMutation.mutate();
  }

  const alumni = q.data?.alumni ?? [];

  return (
    <div className="screen">
      <h1>Mezun Yönetimi</h1>
      <p className="lede">Mezun profili, üniversite ve iş bilgisi takibi.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Mezun</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Ad</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="field"><label>Soyad</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="field"><label>Mezuniyet Yılı</label><input value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} placeholder="Örn. 2025" /></div>
          <div className="field"><label>Üniversite</label><input value={university} onChange={(e) => setUniversity(e.target.value)} /></div>
          <div className="field"><label>İş / Çalışma</label><input value={employment} onChange={(e) => setEmployment(e.target.value)} /></div>
          <div className="field"><label>Telefon</label><input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>
            {createMutation.isPending ? "Ekleniyor…" : "Mezun Ekle"}
          </button>
        </form>
      </div>

      <div className="card card-pad">
        <div className="card-head"><h3>Mezunlar</h3><span className="hint">{alumni.length} kayıt</span></div>
        {q.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : alumni.length === 0 ? (
          <div className="empty-state"><Icon name="trophy" /><p>Henüz mezun kaydı yok.</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ad Soyad</th><th>Mezuniyet</th><th>Üniversite</th><th>İş</th><th>Telefon</th></tr></thead>
              <tbody>
                {alumni.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.firstName} {a.lastName}</td>
                    <td>{a.graduationYear ?? "—"}</td>
                    <td>{a.university ?? "—"}</td>
                    <td>{a.employment ?? "—"}</td>
                    <td>{a.phone ?? "—"}</td>
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

export function AlumniDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <AlumniView me={me} />;
}
