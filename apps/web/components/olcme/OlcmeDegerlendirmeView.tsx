"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchClassrooms } from "@/lib/api/students-roster";
import {
  createBranchExam,
  examKeys,
  fetchAchievementSummary,
  fetchBranchExamDetail,
  fetchBranchExams,
  fetchCurriculumAchievements,
  fetchExamResultRoster,
  submitExamResult,
} from "@/lib/api/exams";
import { Icon } from "@/components/ui/icons";
import { LineChart } from "@/components/ui/charts/LineChart";
import { HBarChart } from "@/components/ui/charts/HBarChart";

const VIEW_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];
const CREATE_ROLES = ["BRANCH_ADMIN"];

const TABS = [
  { id: "durum", label: "Sınav Genel Durumu" },
  { id: "kazanim", label: "Kazanım Analizi" },
  { id: "uygulama", label: "Sınav Uygulaması" },
  { id: "sonuc", label: "Sonuç Girişi" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * Ölçme-Değerlendirme — demo/seviye360-app.html'deki SCREENS["branch:olcme"]
 * (Sınav Genel Durumu / Kazanım Analizi / Sınav Uygulaması / Optikleri Yükle)
 * ekranlarının gerçek karşılığı. "Optikleri Yükle" burada gerçek elle sonuç
 * girişine dönüştürüldü (bkz. app/api/branch/exams/[examId]/results —
 * kamera/OCR bu depoda kasıtlı olarak kapsam dışıdır).
 */
export function OlcmeDegerlendirmeView() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("durum");

  const { data: me, isLoading, isError, error } = useQuery({ queryKey: authKeys.me(), queryFn: fetchMe, retry: false });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) router.replace("/login");
  }, [isError, error, router]);

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!VIEW_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ölçme-Değerlendirme yalnızca Şube Yöneticisi/Rehber Öğretmen/Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const canCreate = CREATE_ROLES.includes(me.role);
  const visibleTabs = TABS.filter((t) => canCreate || (t.id !== "uygulama" && t.id !== "sonuc"));

  return (
    <div className="screen">
      <h1>Ölçme-Değerlendirme</h1>
      <p className="lede">Sınav genel durumu, kazanım analizi ve sınav sonucu girişi tek ekranda.</p>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {visibleTabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`screen-tab ${tab === t.id ? "active" : ""}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "durum" && <DurumTab />}
      {tab === "kazanim" && <KazanimTab />}
      {tab === "uygulama" && canCreate && <UygulamaTab />}
      {tab === "sonuc" && canCreate && <SonucTab />}
    </div>
  );
}

function DurumTab() {
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams });
  const exams = examsQuery.data?.exams ?? [];
  const withResults = exams.filter((e) => e.avgNet !== null);
  const trendPoints = [...withResults].reverse().map((e) => ({ label: e.name, value: e.avgNet! }));

  if (examsQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Net Ortalama Trendi</h3>
        </div>
        {trendPoints.length >= 2 ? (
          <LineChart points={trendPoints} color="var(--strong)" height={150} unit=" net" />
        ) : (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>
            Trend çizilebilmesi için en az 2 sınavda sonuç girilmiş olmalı — Sınav Uygulaması oluşturup Sonuç Girişi&apos;nden veri girin.
          </p>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Tanımlı Sınavlar ({exams.length})</h3>
        </div>
        {exams.length === 0 ? (
          <div className="empty-state">
            <Icon name="ledger" />
            <p>Henüz tanımlı bir sınav yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Sınav</th>
                  <th>Tarih</th>
                  <th>Soru</th>
                  <th>Sonuç Girilen</th>
                  <th>Net Ortalama</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{new Date(e.examDate).toLocaleDateString("tr-TR")}</td>
                    <td>{e.questionCount}</td>
                    <td>{e.resultCount}</td>
                    <td>{e.avgNet ?? "—"}</td>
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

function KazanimTab() {
  const query = useQuery({ queryKey: examKeys.achievementSummary(), queryFn: fetchAchievementSummary });
  const rows = query.data?.achievements ?? [];

  if (query.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Kazanım Bazlı Ortalama Başarı</h3>
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz kazanım verisi yok — Sonuç Girişi&apos;nden ilk sonucu girdiğinizde burada görünecek.</p>
      ) : (
        <HBarChart
          max={100}
          unit="%"
          rows={rows.map((r) => ({
            label: `${r.code} — ${r.label}`,
            sub: `${r.subject} · ${r.count} sonuç`,
            value: r.avgMasteryPct,
            tone: r.avgMasteryPct >= 70 ? "strong" : r.avgMasteryPct >= 40 ? "weak" : "critical",
          }))}
        />
      )}
    </div>
  );
}

function UygulamaTab() {
  const queryClient = useQueryClient();
  const achievementsQuery = useQuery({ queryKey: examKeys.curriculum(), queryFn: fetchCurriculumAchievements });
  const achievements = achievementsQuery.data?.achievements ?? [];

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [questionAchievementIds, setQuestionAchievementIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createBranchExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
      setName("");
      setQuestionAchievementIds([]);
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Sınav oluşturulamadı."),
  });

  function addQuestion(achievementId: string) {
    if (!achievementId) return;
    setQuestionAchievementIds((prev) => [...prev, achievementId]);
  }

  function removeQuestion(index: number) {
    setQuestionAchievementIds((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || questionAchievementIds.length === 0) {
      setFormError("Sınav adı ve en az bir soru zorunludur.");
      return;
    }
    createMutation.mutate({ name: name.trim(), examDate, questions: questionAchievementIds.map((achievementId) => ({ achievementId })) });
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Yeni Sınav Uygulaması Oluştur</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Her soru bir kazanıma (MEB müfredatından) bağlanır — bu eşleme, Sonuç Girişi&apos;nde girilen doğru/yanlış/boş
        işaretlemesinden Kazanım Analizi&apos;ni otomatik hesaplar.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="grid cols-2">
          <div className="field">
            <label>Sınav Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. 1. Dönem Deneme Sınavı" />
          </div>
          <div className="field">
            <label>Sınav Tarihi</label>
            <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6 }}>
            Sorular ({questionAchievementIds.length})
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto", marginBottom: 10 }}>
            {questionAchievementIds.map((achId, i) => {
              const ach = achievements.find((a) => a.id === achId);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "6px 10px", fontSize: "var(--text-xs)" }}>
                  <span>
                    <b>Soru {i + 1}</b> — {ach ? `${ach.code} · ${ach.label}` : achId}
                  </span>
                  <button type="button" className="btn xs" onClick={() => removeQuestion(i)}>
                    Sil
                  </button>
                </div>
              );
            })}
            {questionAchievementIds.length === 0 && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Henüz soru eklenmedi.</p>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select id="add-question-achievement" style={{ flex: 1 }}>
              <option value="">— Kazanım seçin —</option>
              {achievements.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.label} ({a.subject})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                const sel = document.getElementById("add-question-achievement") as HTMLSelectElement;
                addQuestion(sel.value);
              }}
            >
              + Soru Ekle
            </button>
          </div>
        </div>

        {formError && <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
        <button type="submit" disabled={createMutation.isPending} className="btn primary" style={{ alignSelf: "flex-start" }}>
          {createMutation.isPending ? "Oluşturuluyor…" : "Sınavı Oluştur"}
        </button>
      </form>
    </div>
  );
}

type AnswerState = Record<string, boolean | null | undefined>;

function SonucTab() {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams });
  const classroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms });

  const [examId, setExamId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ netScore: number; correctCount: number; wrongCount: number; emptyCount: number } | null>(null);

  const examDetailQuery = useQuery({ queryKey: examKeys.detail(examId), queryFn: () => fetchBranchExamDetail(examId), enabled: !!examId });
  const rosterQuery = useQuery({
    queryKey: examKeys.roster(examId, classroomId),
    queryFn: () => fetchExamResultRoster(examId, classroomId),
    enabled: !!examId && !!classroomId,
  });

  const submitMutation = useMutation({
    mutationFn: (input: { studentId: string; answers: { questionId: string; isCorrect: boolean | null }[] }) => submitExamResult(examId, input),
    onSuccess: (result) => {
      setLastResult(result);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: examKeys.roster(examId, classroomId) });
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
    },
    onError: (err) => setSubmitError(err instanceof ApiError ? err.message : "Sonuç kaydedilemedi."),
  });

  const exams = examsQuery.data?.exams ?? [];
  const classrooms = classroomsQuery.data?.classrooms ?? [];
  const roster = rosterQuery.data?.roster ?? [];
  const questions = examDetailQuery.data?.exam.questions ?? [];

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setLastResult(null);
    setSubmitError(null);
    setAnswers({});
  }

  function handleSubmit() {
    if (!selectedStudentId) return;
    if (questions.some((q) => answers[q.id] === undefined)) {
      setSubmitError("Her soru için Doğru/Yanlış/Boş işaretlemelisiniz.");
      return;
    }
    submitMutation.mutate({
      studentId: selectedStudentId,
      answers: questions.map((q) => ({ questionId: q.id, isCorrect: answers[q.id] ?? null })),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card card-pad">
        <div className="grid cols-2">
          <div className="field">
            <label>Sınav</label>
            <select value={examId} onChange={(e) => { setExamId(e.target.value); setSelectedStudentId(null); }}>
              <option value="">— Seçin —</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.questionCount} soru)
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Sınıf</label>
            <select value={classroomId} onChange={(e) => { setClassroomId(e.target.value); setSelectedStudentId(null); }}>
              <option value="">— Seçin —</option>
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.studentCount} öğrenci)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {examId && classroomId && (
        <div className="grid cols-2">
          <div className="card card-pad">
            <div className="card-head">
              <h3>Öğrenciler</h3>
            </div>
            {rosterQuery.isLoading ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
            ) : roster.length === 0 ? (
              <div className="empty-state">
                <Icon name="users" />
                <p>Bu sınıfta öğrenci yok.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {roster.map((s) => (
                  <button
                    key={s.studentId}
                    type="button"
                    onClick={() => selectStudent(s.studentId)}
                    className={`nav-item ${selectedStudentId === s.studentId ? "active" : ""}`}
                    style={{ textAlign: "left" }}
                  >
                    <span>
                      <b>{s.name}</b>
                      <span className="sub">{s.studentNo}</span>
                    </span>
                    {s.hasResult ? <span className="chip strong">Net {s.netScore}</span> : <span className="chip neutral">Bekliyor</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card card-pad">
            {!selectedStudentId ? (
              <div className="empty-state">
                <Icon name="check" />
                <p>Soldan bir öğrenci seçin.</p>
              </div>
            ) : examDetailQuery.isLoading ? (
              <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
            ) : (
              <>
                <div className="card-head">
                  <h3>Soru Bazlı İşaretleme</h3>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
                  {questions.map((q) => (
                    <div key={q.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: "var(--text-xs)", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                      <span>
                        <b>Soru {q.orderIndex}</b> — {q.achievementCode}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {([
                          ["Doğru", true],
                          ["Yanlış", false],
                          ["Boş", null],
                        ] as const).map(([label, value]) => (
                          <button
                            key={label}
                            type="button"
                            className={`btn xs ${answers[q.id] === value ? "primary" : ""}`}
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {submitError && <p style={{ margin: "0 0 10px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{submitError}</p>}
                <button type="button" className="btn success solid" disabled={submitMutation.isPending} onClick={handleSubmit}>
                  {submitMutation.isPending ? "Kaydediliyor…" : "Sonucu Kaydet"}
                </button>
                {lastResult && (
                  <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
                    Kaydedildi — {lastResult.correctCount} doğru, {lastResult.wrongCount} yanlış, {lastResult.emptyCount} boş → Net {lastResult.netScore}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
