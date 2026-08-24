"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import type { MeResponse } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createSurvey, fetchSurveys, surveyKeys } from "@/lib/api/surveys";
import { Icon } from "@/components/ui/icons";
import { HqBranchSelector } from "@/components/hq/HqBranchSelector";

const ALLOWED = ["BRANCH_ADMIN", "SUPERADMIN", "GUIDANCE_COORDINATOR"];
const AUDIENCE_LABEL: Record<string, string> = { ALL: "Herkes", STUDENT: "Öğrenci", PARENT: "Veli", TEACHER: "Öğretmen", STAFF: "Personel" };

function SurveysView({ me }: { me: MeResponse }) {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: surveyKeys.branchList(), queryFn: fetchSurveys });

  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("ALL");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createSurvey({ title: title.trim(), audience, description: description.trim() || undefined, questions: questions.split("\n").map((x) => x.trim()).filter(Boolean) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: surveyKeys.branchList() }); setTitle(""); setDescription(""); setQuestions(""); setFormError(null); },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Anket oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setFormError("Anket başlığı zorunludur."); return; }
    createMutation.mutate();
  }

  const surveys = q.data?.surveys ?? [];

  return (
    <div className="screen">
      <h1>Anketler</h1>
      <p className="lede">Veli, öğrenci ve personel memnuniyet anketleri.</p>
      <HqBranchSelector role={me.role} activeTenantId={me.actingTenantId} />

      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>Yeni Anket</h3></div>
        <form onSubmit={handleSubmit} className="grid cols-2" style={{ rowGap: 12 }}>
          <div className="field"><label>Başlık</label><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Veli Memnuniyet Anketi" /></div>
          <div className="field"><label>Hedef Kitle</label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)}>
              {Object.entries(AUDIENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Açıklama</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label>Sorular (her satır bir soru)</label>
            <textarea value={questions} onChange={(e) => setQuestions(e.target.value)} rows={4} placeholder={"Okuldan memnun musunuz?\nİletişim yeterli mi?"} style={{ resize: "vertical", fontFamily: "inherit" }} />
          </div>
          {formError && <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
          <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ gridColumn: "1 / -1", justifyContent: "center" }}>{createMutation.isPending ? "Oluşturuluyor…" : "Anketi Oluştur"}</button>
        </form>
      </div>

      <div className="grid cols-2">
        {q.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!q.isLoading && surveys.length === 0 && <div className="empty-state"><Icon name="chart" /><p>Henüz anket yok.</p></div>}
        {surveys.map((s) => (
          <div key={s.id} className="card card-pad">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{s.title}</h3>
              <span className="chip neutral">{AUDIENCE_LABEL[s.audience] ?? s.audience}</span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{s.questionCount} soru · {s.responseCount} yanıt · {s.active ? "Aktif" : "Kapalı"}</p>
            {s.description && <p style={{ margin: "6px 0 0", fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>{s.description}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SurveysDashboard() {
  const router = useRouter();
  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });
  useEffect(() => { if (isError && error instanceof ApiError && error.status === 401) router.replace("/login"); }, [isError, error, router]);
  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!ALLOWED.includes(me.role)) return <div className="card card-pad"><p style={{ margin: 0, fontWeight: 600, color: "var(--critical)" }}>Bu modüle erişim yetkiniz yok.</p></div>;
  return <SurveysView me={me} />;
}
