"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchBranchClassrooms } from "@/lib/api/students-roster";
import { fetchMyClasses } from "@/lib/api/my-classes";
import {
  createBranchExam,
  deleteBranchExam,
  EXAM_ANSWER_KEY_OPTIONS,
  EXAM_TYPE_LABEL,
  EXAM_TYPE_OPTIONS,
  examKeys,
  fetchAchievementSummary,
  fetchAtRiskStudents,
  fetchBranchExamDetail,
  fetchBranchExams,
  fetchCurriculumAchievements,
  fetchExamBranchComparison,
  fetchExamQuestionStats,
  fetchExamResultRoster,
  submitExamResult,
  updateBranchExam,
  type BranchExam,
  type CurriculumAchievement,
} from "@/lib/api/exams";
import { parseCsv } from "@/lib/csv";
import { GRADE_LEVEL_LABEL } from "@/lib/api/enrollments";
import { Icon } from "@/components/ui/icons";
import { LineChart } from "@/components/ui/charts/LineChart";
import { HBarChart } from "@/components/ui/charts/HBarChart";
import { CompositionBar } from "@/components/ui/charts/CompositionBar";
import { KazanimYuklemeTab } from "./KazanimYuklemeTab";

// demo'daki EXAM_ELIGIBLE_GRADES (Ortaokul + Lise) ile birebir aynı — HQ'nun
// Genel Sınav Merkezi'ndeki (app/api/hq/exams) sabit listeyle tutarlı.
const EXAM_ELIGIBLE_GRADES = ["SINIF_5", "SINIF_6", "SINIF_7", "SINIF_8", "SINIF_9", "SINIF_10", "SINIF_11", "SINIF_12"];

const VIEW_ROLES = ["BRANCH_ADMIN", "GUIDANCE_COORDINATOR", "TEACHER"];
const CREATE_ROLES = ["BRANCH_ADMIN"];
// Sonuç Girişi demo'da öğretmene de açıktı (kendi sınıfının optiğini
// yüklüyordu) — Sınav Uygulaması (yeni sınav tanımı) ise HQ/BRANCH_ADMIN'e
// özel kalıyor (kazanimYuklemeAllowed() ile aynı kural). API tarafı
// (app/api/branch/exams/[examId]/results POST) TEACHER'ı yalnızca kendi
// Ders Programı'ndaki sınıflarla sınırlıyor.
const ENTER_RESULTS_ROLES = ["BRANCH_ADMIN", "TEACHER"];
// Kazanım Yükleme (ders bazlı kazanım taksonomisi yönetimi) yalnızca Genel
// Merkez veya Şube Yöneticisi'ne açıktır — demo'daki kazanimYuklemeAllowed()
// ile aynı kural. `CurriculumNode` tenant'a özgü olmadığından (bkz.
// app/api/curriculum/achievements/route.ts), SUPERADMIN için actingTenantId
// ZORUNLU DEĞİLDİR — bu yüzden `canCreate`'ten ayrı bir kontrol.
const MANAGE_CURRICULUM_ROLES = ["BRANCH_ADMIN", "SUPERADMIN"];

const TABS = [
  { id: "durum", label: "Sınav Genel Durumu" },
  { id: "kazanim", label: "Kazanım Analizi" },
  { id: "uygulama", label: "Sınav Uygulaması" },
  { id: "sonuc", label: "Sonuç Girişi" },
  { id: "kazanimYukle", label: "Kazanım Yükleme" },
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

  // Kazanım Yükleme, tenant'a özgü olmayan (RLS taşımayan) tek sekmeydi —
  // bare SUPERADMIN (henüz bir şubeyi "acting" seçmemiş) artık "Durum"
  // sekmesine de girebilir (bkz. DurumTab: bareSuperadmin iken yalnızca
  // "Şubeler Arası Karşılaştırma" kartı, demo'daki isHq görünümünün gerçek
  // karşılığı — app/api/hq/exams/branch-comparison), diğer sekmeler hâlâ
  // şube verisine ihtiyaç duyduğundan gizli kalır.
  const bareSuperadmin = me?.role === "SUPERADMIN" && !me.actingTenantId;
  useEffect(() => {
    if (bareSuperadmin) setTab("durum");
  }, [bareSuperadmin]);

  if (isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  if (!me || (isError && error instanceof ApiError && error.status === 401)) return null;
  if (!VIEW_ROLES.includes(me.role) && me.role !== "SUPERADMIN") {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Ölçme-Değerlendirme yalnızca Şube Yöneticisi/Rehber Öğretmen/Öğretmen rolüne açıktır.
        </p>
      </div>
    );
  }

  const canCreate = CREATE_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);
  const canEnterResults = ENTER_RESULTS_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);
  const canManageCurriculum = MANAGE_CURRICULUM_ROLES.includes(me.role);
  const hasTenantScope = VIEW_ROLES.includes(me.role) || (me.role === "SUPERADMIN" && !!me.actingTenantId);
  const visibleTabs = TABS.filter((t) => {
    if (t.id === "kazanimYukle") return canManageCurriculum;
    if (t.id === "durum") return hasTenantScope || bareSuperadmin;
    if (!hasTenantScope) return false;
    if (t.id === "uygulama") return canCreate;
    if (t.id === "sonuc") return canEnterResults;
    return true;
  });

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

      {tab === "durum" && <DurumTab isSuperadmin={me.role === "SUPERADMIN"} bareSuperadmin={bareSuperadmin} />}
      {tab === "kazanim" && <KazanimTab />}
      {tab === "uygulama" && canCreate && <UygulamaTab />}
      {tab === "sonuc" && canEnterResults && <SonucTab isTeacher={me.role === "TEACHER"} />}
      {tab === "kazanimYukle" && canManageCurriculum && <KazanimYuklemeTab />}
    </div>
  );
}

function BranchComparisonCard() {
  const comparisonQuery = useQuery({ queryKey: ["exam-branch-comparison"], queryFn: fetchExamBranchComparison });
  const branches = comparisonQuery.data?.branches ?? [];
  const maxNet = Math.max(1, ...branches.map((b) => b.avgNet ?? 0));

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Şubeler Arası Karşılaştırmalı Net Sıralaması</h3>
        <span className="hint">{branches.length} şube</span>
      </div>
      {comparisonQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : branches.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)", margin: 0 }}>Henüz hiçbir şubede sınav sonucu yok.</p>
      ) : (
        <HBarChart
          max={maxNet}
          unit=" net"
          rows={branches.map((b) => ({
            label: b.tenantName,
            sub: `${b.examTakers} öğrenci${b.avgKatilim !== null ? ` · %${b.avgKatilim} katılım` : ""}`,
            value: b.avgNet ?? 0,
            tone: (b.avgNet ?? 0) / maxNet >= 0.7 ? "strong" : (b.avgNet ?? 0) / maxNet >= 0.4 ? "weak" : "critical",
          }))}
        />
      )}
    </div>
  );
}

/**
 * Sınav Genel Durumu — Yapay Zeka Özeti (task #102) — demo'nun genel
 * "Ölçme-Değerlendirme & Yapay Zeka" konumlandırmasının (bkz. demo'daki hub
 * kart açıklaması) şube-geneli karşılığı; öğrenci bazlı "AI Profil Özeti"nin
 * (bkz. StudentDetailDrawer.tsx, task #91) AYNI kural-tabanlı yaklaşımı —
 * gerçek bir LLM çağrısı YOK, DurumTab'ın zaten çektiği veriden (sınav
 * listesi/kazanım dağılımı/ders bazlı ustalık/madde analizi) birkaç Türkçe
 * cümle üretilir. Yeni bir backend endpoint'i GEREKMEZ.
 */
function buildDurumAiSummary({
  withResults,
  withParticipation,
  bySubject,
  distribution,
  questionStats,
  selectedExamName,
}: {
  withResults: BranchExam[];
  withParticipation: BranchExam[];
  bySubject: { subject: string; avgMasteryPct: number }[];
  distribution: { critical: number; weak: number; strong: number } | undefined;
  questionStats: { questionNo: number; subject: string; wrongPct: number; achievementLabel: string }[];
  selectedExamName?: string;
}): string[] {
  const lines: string[] = [];

  if (withResults.length >= 2) {
    const delta = Number((withResults[0].avgNet! - withResults[1].avgNet!).toFixed(1));
    if (delta > 0) lines.push(`Son sınavda kapsam ortalama neti bir önceki sınava göre ${delta} puan arttı — olumlu bir ivme var.`);
    else if (delta < 0) lines.push(`Son sınavda kapsam ortalama neti bir önceki sınava göre ${Math.abs(delta)} puan azaldı — yakından takip edilmeli.`);
    else lines.push("Son iki sınavda kapsam ortalama neti aynı seviyede kaldı.");
  } else if (withResults.length === 1) {
    lines.push(`İlk sınav sonucu girildi — trend yorumu için en az bir sınav daha gerekiyor.`);
  }

  if (withParticipation.length >= 2) {
    const deltaKatilim = withParticipation[0].participationPct! - withParticipation[1].participationPct!;
    if (deltaKatilim <= -10) lines.push(`Katılım oranında son sınavda %${Math.abs(deltaKatilim)} düşüş var — devamsızlık nedenleri incelenmeli.`);
    else if (deltaKatilim >= 10) lines.push(`Katılım oranı son sınavda %${deltaKatilim} yükseldi.`);
  }

  const total = distribution ? distribution.critical + distribution.weak + distribution.strong : 0;
  if (total > 0 && distribution) {
    const criticalPct = Math.round((distribution.critical / total) * 100);
    const strongPct = Math.round((distribution.strong / total) * 100);
    if (criticalPct >= 30) lines.push(`Kazanımların %${criticalPct}'i kritik seviyede — öncelikli tekrar planı önerilir.`);
    else if (strongPct >= 60) lines.push(`Kazanımların %${strongPct}'i kazanılmış seviyede — genel görünüm olumlu.`);
    else lines.push(`Kazanım dağılımı dengeli görünüyor (kritik %${criticalPct}, kazanılmış %${strongPct}).`);
  }

  if (bySubject.length > 0) {
    const weakest = [...bySubject].sort((a, b) => a.avgMasteryPct - b.avgMasteryPct)[0];
    if (weakest.avgMasteryPct < 60) {
      lines.push(`En düşük başarı ${weakest.subject} dersinde görülüyor (%${weakest.avgMasteryPct} ustalık) — bu derse ağırlık verilmesi önerilir.`);
    }
  }

  if (questionStats.length > 0) {
    const worst = questionStats[0];
    if (worst.wrongPct >= 40) {
      const examRef = selectedExamName ? `"${selectedExamName}" sınavında` : "seçili sınavda";
      lines.push(`${examRef} en çok yanlışlanan soru: Soru ${worst.questionNo} (${worst.subject}) — %${worst.wrongPct} yanlış oranıyla "${worst.achievementLabel}" kazanımında tekrar önerilir.`);
    }
  }

  if (lines.length === 0) {
    lines.push("Yorum üretmek için henüz yeterli sınav verisi yok — Sınav Uygulaması oluşturup Sonuç Girişi'nden veri girin.");
  }

  return lines;
}

function DurumAiSummaryCard(props: Parameters<typeof buildDurumAiSummary>[0]) {
  const lines = buildDurumAiSummary(props);
  return (
    <div className="card card-pad" style={{ borderColor: "var(--brand)" }}>
      <div className="card-head">
        <h3>🧠 Yapay Zeka Özeti</h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: "var(--text-sm)", color: "var(--ink-muted)" }}>
        {lines.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function DurumTab({ isSuperadmin, bareSuperadmin }: { isSuperadmin: boolean; bareSuperadmin: boolean }) {
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams, enabled: !bareSuperadmin });
  const achievementQuery = useQuery({ queryKey: examKeys.achievementSummary(), queryFn: fetchAchievementSummary, enabled: !bareSuperadmin });
  const exams = examsQuery.data?.exams ?? [];

  if (bareSuperadmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BranchComparisonCard />
      </div>
    );
  }

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  useEffect(() => {
    if (exams.length > 0 && !exams.some((e) => e.id === selectedExamId)) {
      setSelectedExamId(exams[0].id);
    }
  }, [exams, selectedExamId]);
  const questionStatsQuery = useQuery({
    queryKey: ["exam-question-stats", selectedExamId],
    queryFn: () => fetchExamQuestionStats(selectedExamId!),
    enabled: !!selectedExamId,
  });
  const questionStats = [...(questionStatsQuery.data?.questions ?? [])].sort((a, b) => b.wrongPct - a.wrongPct).slice(0, 12);

  const bySubject = achievementQuery.data?.bySubject ?? [];
  const withResults = exams.filter((e) => e.avgNet !== null);
  const trendPoints = [...withResults].reverse().map((e) => ({ label: e.name, value: e.avgNet! }));
  const withParticipation = exams.filter((e) => e.participationPct !== null);
  const participationTrendPoints = [...withParticipation].reverse().map((e) => ({ label: e.name, value: e.participationPct! }));

  const lastExam = exams[0];
  const kapsamOrtalamaNet =
    withResults.length > 0 ? Number((withResults.reduce((s, e) => s + (e.avgNet ?? 0), 0) / withResults.length).toFixed(1)) : null;
  const last5Participation = withParticipation.slice(0, 5);
  const ortalamaKatilim =
    last5Participation.length > 0
      ? Math.round(last5Participation.reduce((s, e) => s + (e.participationPct ?? 0), 0) / last5Participation.length)
      : null;

  const totalCorrect = exams.reduce((s, e) => s + e.correctCount, 0);
  const totalWrong = exams.reduce((s, e) => s + e.wrongCount, 0);
  const totalEmpty = exams.reduce((s, e) => s + e.emptyCount, 0);

  if (examsQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid cols-4">
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Son Sınav Katılımı</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{lastExam?.participationPct === null || lastExam?.participationPct === undefined ? "—" : `%${lastExam.participationPct}`}</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Kapsam Ortalama Net</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{kapsamOrtalamaNet ?? "—"}</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Ortalama Katılım (Son 5 Sınav)</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{ortalamaKatilim === null ? "—" : `%${ortalamaKatilim}`}</div>
        </div>
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>Sınava Giren Öğrenci</div>
          <div style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{lastExam?.resultCount ?? 0}</div>
        </div>
      </div>

      <DurumAiSummaryCard
        withResults={withResults}
        withParticipation={withParticipation}
        bySubject={bySubject}
        distribution={achievementQuery.data?.distribution}
        questionStats={questionStats}
        selectedExamName={exams.find((e) => e.id === selectedExamId)?.name}
      />

      <div className="grid cols-2">
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
            <h3>Katılım Trendi</h3>
          </div>
          {participationTrendPoints.length >= 2 ? (
            <LineChart points={participationTrendPoints} color="var(--accent)" height={150} unit="%" />
          ) : (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Trend çizilebilmesi için en az 2 sınavda sonuç girilmiş olmalı.</p>
          )}
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Kazanım Başarı Dağılımı</h3>
          </div>
          <CompositionBar
            segments={[
              { label: "Kazanılmış", value: achievementQuery.data?.distribution.strong ?? 0, color: "var(--strong)" },
              { label: "Geliştirilmeli", value: achievementQuery.data?.distribution.weak ?? 0, color: "var(--weak)" },
              { label: "Kritik Eksik", value: achievementQuery.data?.distribution.critical ?? 0, color: "var(--critical)" },
            ]}
          />
        </div>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Doğru / Yanlış / Boş Dağılımı</h3>
          </div>
          <CompositionBar
            segments={[
              { label: "Doğru", value: totalCorrect, color: "var(--strong)" },
              { label: "Yanlış", value: totalWrong, color: "var(--critical)" },
              { label: "Boş", value: totalEmpty, color: "var(--ink-faint)" },
            ]}
          />
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Sınav Genel Durumları ({exams.length})</h3>
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
                  <th>Kitapçık</th>
                  <th>Ücret</th>
                  <th>Katılım</th>
                  <th>Ort. Net</th>
                  <th>Doğru Oranı</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: 600 }}>{e.name}</td>
                    <td>{new Date(e.examDate).toLocaleDateString("tr-TR")}</td>
                    <td>{e.bookletTypes.length} ({e.bookletTypes.join("/")})</td>
                    <td>{e.feePerStudent === null ? "—" : `₺${e.feePerStudent}`}</td>
                    <td>
                      {e.participationPct === null ? (
                        "—"
                      ) : (
                        <span className={`chip ${e.participationPct >= 80 ? "strong" : e.participationPct >= 50 ? "weak" : "critical"}`}>
                          %{e.participationPct}
                        </span>
                      )}
                    </td>
                    <td>{e.avgNet ?? "—"}</td>
                    <td>{e.correctRatePct === null ? "—" : `%${e.correctRatePct}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Sınav Bazlı Soru/Madde Analizi</h3>
          {exams.length > 0 && (
            <select value={selectedExamId ?? ""} onChange={(e) => setSelectedExamId(e.target.value)} style={{ fontSize: "var(--text-xs)" }}>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({new Date(e.examDate).toLocaleDateString("tr-TR")})
                </option>
              ))}
            </select>
          )}
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)", margin: "0 0 10px" }}>
          Seçili sınavda kapsam genelinde en çok yanlış/boş bırakılan sorular — madde bazlı zorluk analizi.
        </p>
        {exams.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)", margin: 0 }}>Henüz tanımlı bir sınav yok.</p>
        ) : questionStatsQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : questionStats.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)", margin: 0 }}>Bu sınav için henüz soru bazlı sonuç yok.</p>
        ) : (
          <HBarChart
            max={100}
            unit="%"
            rows={questionStats.map((q) => ({
              label: `Soru ${q.questionNo} · ${q.subject}`,
              sub: q.achievementLabel,
              value: q.wrongPct,
              tone: q.wrongPct >= 60 ? "critical" : q.wrongPct >= 35 ? "weak" : "strong",
            }))}
          />
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Ders Bazlı Ortalama Başarı</h3>
        </div>
        {bySubject.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz kazanım verisi yok.</p>
        ) : (
          <HBarChart
            max={100}
            unit="%"
            rows={bySubject.map((s) => ({
              label: s.subject,
              sub: `${s.achievementCount} kazanım`,
              value: s.avgMasteryPct,
              tone: s.avgMasteryPct >= 70 ? "strong" : s.avgMasteryPct >= 40 ? "weak" : "critical",
            }))}
          />
        )}
      </div>

      {isSuperadmin && <BranchComparisonCard />}
    </div>
  );
}

function KazanimTab() {
  const achievementQuery = useQuery({ queryKey: examKeys.achievementSummary(), queryFn: fetchAchievementSummary });
  const curriculumQuery = useQuery({ queryKey: examKeys.curriculum(), queryFn: fetchCurriculumAchievements });
  const [riskFilter, setRiskFilter] = useState("");
  const atRiskQuery = useQuery({
    queryKey: examKeys.atRiskStudents(riskFilter || undefined),
    queryFn: () => fetchAtRiskStudents(riskFilter || undefined),
  });

  const rows = achievementQuery.data?.achievements ?? [];
  const bySubject = achievementQuery.data?.bySubject ?? [];
  const curriculum = curriculumQuery.data?.achievements ?? [];
  const atRiskStudents = atRiskQuery.data?.students ?? [];
  const weakest14 = rows.slice(0, 14);

  const coverage = useMemo(() => {
    const totalBySubject = new Map<string, number>();
    for (const a of curriculum) totalBySubject.set(a.subject, (totalBySubject.get(a.subject) ?? 0) + 1);
    const testedBySubject = new Map<string, number>();
    for (const r of rows) testedBySubject.set(r.subject, (testedBySubject.get(r.subject) ?? 0) + 1);
    return [...totalBySubject.entries()]
      .map(([subject, total]) => {
        const tested = testedBySubject.get(subject) ?? 0;
        return { subject, total, tested, coveragePct: total > 0 ? Math.round((tested / total) * 100) : 0 };
      })
      .sort((a, b) => a.coveragePct - b.coveragePct);
  }, [curriculum, rows]);

  if (achievementQuery.isLoading) return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="grid cols-2">
        <div className="card card-pad">
          <div className="card-head">
            <h3>Kazanım Bazlı Ortalama Başarı</h3>
            <span className="hint">En zayıf 14 kazanım</span>
          </div>
          {weakest14.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>
              Henüz kazanım verisi yok — Sonuç Girişi&apos;nden ilk sonucu girdiğinizde burada görünecek.
            </p>
          ) : (
            <HBarChart
              max={100}
              unit="%"
              rows={weakest14.map((r) => ({
                label: `${r.code} — ${r.label}`,
                sub: `${r.subject} · ${r.count} sonuç`,
                value: r.avgMasteryPct,
                tone: r.avgMasteryPct >= 70 ? "strong" : r.avgMasteryPct >= 40 ? "weak" : "critical",
              }))}
            />
          )}
        </div>
        <div className="card card-pad">
          <div className="card-head">
            <h3>Ders Bazlı Ortalama Başarı</h3>
          </div>
          {bySubject.length === 0 ? (
            <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz kazanım verisi yok.</p>
          ) : (
            <HBarChart
              max={100}
              unit="%"
              rows={bySubject.map((s) => ({
                label: s.subject,
                value: s.avgMasteryPct,
                tone: s.avgMasteryPct >= 70 ? "strong" : s.avgMasteryPct >= 40 ? "weak" : "critical",
              }))}
            />
          )}
        </div>
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Ders Bazlı Kazanım Ustalık Dağılımı</h3>
        </div>
        {bySubject.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz kazanım verisi yok.</p>
        ) : (
          <div className="grid cols-2" style={{ rowGap: 16 }}>
            {bySubject.map((s) => (
              <div key={s.subject}>
                <div style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 6 }}>{s.subject}</div>
                <CompositionBar
                  segments={[
                    { label: "Kazanılmış", value: s.distribution.strong, color: "var(--strong)" },
                    { label: "Geliştirilmeli", value: s.distribution.weak, color: "var(--weak)" },
                    { label: "Kritik Eksik", value: s.distribution.critical, color: "var(--critical)" },
                  ]}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Müfredat Kapsama Oranı</h3>
          <span className="hint">Test edilmiş / tanımlı kazanım</span>
        </div>
        {coverage.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Henüz müfredat kazanımı tanımlı değil.</p>
        ) : (
          <HBarChart
            max={100}
            unit="%"
            rows={coverage.map((c) => ({
              label: c.subject,
              sub: `${c.tested}/${c.total} kazanım test edildi`,
              value: c.coveragePct,
              tone: c.coveragePct >= 70 ? "strong" : c.coveragePct >= 40 ? "weak" : "critical",
            }))}
          />
        )}
      </div>

      <div className="card card-pad">
        <div className="card-head">
          <h3>Desteğe İhtiyaç Duyan Öğrenciler</h3>
        </div>
        <div className="field" style={{ maxWidth: 340, marginBottom: 12 }}>
          <label>Kazanıma Göre Filtrele</label>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="">— Tüm kritik kazanımlar —</option>
            {rows.map((r) => (
              <option key={r.achievementId} value={r.achievementId}>
                {r.code} — {r.label}
              </option>
            ))}
          </select>
        </div>
        {atRiskQuery.isLoading ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
        ) : atRiskStudents.length === 0 ? (
          <div className="empty-state">
            <Icon name="check" />
            <p>Kritik seviyede kazanımı olan öğrenci yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th>Sınıf</th>
                  <th>Kritik Kazanımlar</th>
                </tr>
              </thead>
              <tbody>
                {atRiskStudents.map((s) => (
                  <tr key={s.studentId}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.classroomName ?? "—"}</td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.criticalAchievements.map((a) => (
                          <span key={a.achievementId} className="chip critical" title={a.label}>
                            {a.code}
                          </span>
                        ))}
                      </div>
                    </td>
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

/**
 * Sınav düzenle/sil + geçmiş/yaklaşan ayrımı (task #92) — demo'daki
 * eksikliğin karşılığı. Sorular/cevap anahtarı burada DÜZENLENEMEZ (bkz.
 * PATCH /api/branch/exams/[examId] yorumu); yalnızca ad/tarih/tür/kitapçık/
 * ücret/sınıf kapsamı. Sonucu girilmiş bir sınav silinemez (409).
 */
function ExistingExamsPanel() {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams });
  const exams = examsQuery.data?.exams ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = exams.filter((e) => e.examDate >= today).sort((a, b) => a.examDate.localeCompare(b.examDate));
  const past = exams.filter((e) => e.examDate < today).sort((a, b) => b.examDate.localeCompare(a.examDate));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editBooklet, setEditBooklet] = useState<2 | 4>(4);
  const [editFee, setEditFee] = useState("");
  const [editGrades, setEditGrades] = useState<string[]>([]);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function startEdit(e: BranchExam) {
    setEditingId(e.id);
    setEditName(e.name);
    setEditDate(e.examDate);
    setEditBooklet(e.bookletTypes.length === 2 ? 2 : 4);
    setEditFee(e.feePerStudent != null ? String(e.feePerStudent) : "");
    setEditGrades(e.eligibleGradeLevels);
    setRowError(null);
    setConfirmDeleteId(null);
  }

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; input: Parameters<typeof updateBranchExam>[1] }) => updateBranchExam(vars.id, vars.input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
      setEditingId(null);
      setRowError(null);
    },
    onError: (err) => setRowError(err instanceof ApiError ? err.message : "Sınav güncellenemedi."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranchExam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
      setConfirmDeleteId(null);
    },
    onError: (err) => {
      setRowError(err instanceof ApiError ? err.message : "Sınav silinemedi.");
      setConfirmDeleteId(null);
    },
  });

  function toggleEditGrade(g: string) {
    setEditGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function saveEdit() {
    if (!editName.trim() || !editDate) {
      setRowError("Sınav adı ve tarihi zorunludur.");
      return;
    }
    updateMutation.mutate({
      id: editingId!,
      input: {
        name: editName.trim(),
        examDate: editDate,
        bookletCount: editBooklet,
        feePerStudent: editFee.trim() ? Number(editFee) : null,
        eligibleGradeLevels: editGrades,
      },
    });
  }

  function ExamRow({ e }: { e: BranchExam }) {
    if (editingId === e.id) {
      return (
        <div className="card card-pad" style={{ marginBottom: 8 }}>
          <div className="grid cols-2">
            <div className="field">
              <label>Sınav Adı</label>
              <input value={editName} onChange={(ev) => setEditName(ev.target.value)} />
            </div>
            <div className="field">
              <label>Tarih</label>
              <input type="date" value={editDate} onChange={(ev) => setEditDate(ev.target.value)} />
            </div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 8 }}>
            <div className="field">
              <label>Kitapçık Sayısı</label>
              <select value={editBooklet} onChange={(ev) => setEditBooklet(Number(ev.target.value) === 2 ? 2 : 4)}>
                <option value={4}>4 (A/B/C/D)</option>
                <option value={2}>2 (A/B)</option>
              </select>
            </div>
            <div className="field">
              <label>Ücret (₺)</label>
              <input type="number" min="0" value={editFee} onChange={(ev) => setEditFee(ev.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 8 }}>
            <label>Sınıf Düzeyi Kapsamı (boş = Tümü)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EXAM_ELIGIBLE_GRADES.map((g) => (
                <label key={g} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "var(--text-2xs)" }}>
                  <input type="checkbox" checked={editGrades.includes(g)} onChange={() => toggleEditGrade(g)} />
                  {GRADE_LEVEL_LABEL[g] ?? g}
                </label>
              ))}
            </div>
          </div>
          {rowError && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{rowError}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn primary xs" disabled={updateMutation.isPending} onClick={saveEdit}>
              {updateMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button type="button" className="btn xs" onClick={() => setEditingId(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{e.name}</span>
          <span style={{ marginLeft: 8, fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>
            {new Date(e.examDate).toLocaleDateString("tr-TR")} · {EXAM_TYPE_LABEL[e.type] ?? e.type} · {e.resultCount} sonuç
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {confirmDeleteId === e.id ? (
            <>
              <span style={{ fontSize: "var(--text-2xs)", color: "var(--critical)" }}>Emin misiniz?</span>
              <button type="button" className="btn xs danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(e.id)}>
                {deleteMutation.isPending ? "Siliniyor…" : "Evet, Sil"}
              </button>
              <button type="button" className="btn xs" onClick={() => setConfirmDeleteId(null)}>
                Vazgeç
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn xs" onClick={() => startEdit(e)}>
                Düzenle
              </button>
              <button type="button" className="btn xs danger" onClick={() => setConfirmDeleteId(e.id)}>
                Sil
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (examsQuery.isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (exams.length === 0) return null;

  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="card-head">
        <h3>Sınavlarım ({exams.length})</h3>
      </div>
      {upcoming.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-faint)" }}>
            Yaklaşan ({upcoming.length})
          </p>
          {upcoming.map((e) => (
            <ExamRow key={e.id} e={e} />
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-faint)" }}>
            Geçmiş ({past.length})
          </p>
          {past.map((e) => (
            <ExamRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DraftQuestion {
  achievementId: string;
  correctAnswer: string;
}

/**
 * İki aşamalı sihirbaz (bkz. demo sinavUygulamaStage "config"→"mapping"):
 * "config" — sınav adı/türü/tarihi + ders bazlı soru sayısı seçimi;
 * "mapping" — her ders için, YALNIZCA o dersin kazanım taksonomisinden
 * seçilebilen soru kartları (+ opsiyonel CSV'den toplu kazanım ataması) ve
 * sınav kapsamı (kitapçık/ücret/sınıf düzeyi). Kaydedilirken dersler sırayla
 * tek bir düz `questions` dizisine birleştirilip mevcut, değişmemiş
 * POST /api/branch/exams uç noktasına gönderilir — backend zaten sıralı bir
 * soru listesi bekliyordu, bu yüzden hiçbir API/şema değişikliği gerekmedi.
 */
function UygulamaTab() {
  const queryClient = useQueryClient();
  const achievementsQuery = useQuery({ queryKey: examKeys.curriculum(), queryFn: fetchCurriculumAchievements });
  const achievements = achievementsQuery.data?.achievements ?? [];
  const subjects = useMemo(
    () => Array.from(new Set(achievements.map((a) => a.subject))).sort((a, b) => a.localeCompare(b, "tr")),
    [achievements],
  );

  const [stage, setStage] = useState<"config" | "mapping">("config");
  const [name, setName] = useState("");
  const [examType, setExamType] = useState(EXAM_TYPE_OPTIONS[0]);
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subjectCounts, setSubjectCounts] = useState<Record<string, number>>({});
  const [questionMap, setQuestionMap] = useState<Record<string, DraftQuestion[]>>({});
  const [subjectSearch, setSubjectSearch] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<Record<string, string>>({});
  const [bookletCount, setBookletCount] = useState<2 | 4>(4);
  const [feePerStudent, setFeePerStudent] = useState("");
  const [eligibleGrades, setEligibleGrades] = useState<string[]>([]);
  const [configError, setConfigError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createBranchExam,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
      setStage("config");
      setName("");
      setSubjectCounts({});
      setQuestionMap({});
      setSubjectSearch({});
      setImportStatus({});
      setFeePerStudent("");
      setEligibleGrades([]);
      setFormError(null);
      setSuccessMsg(`"${result.exam.name}" oluşturuldu — ${result.studentCount} öğrenci kapsamda.`);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Sınav oluşturulamadı."),
  });

  function toggleSubject(subject: string, checked: boolean) {
    setSubjectCounts((prev) => {
      const next = { ...prev };
      if (checked) next[subject] = next[subject] ?? 10;
      else delete next[subject];
      return next;
    });
  }

  function continueToMapping() {
    const checkedSubjects = Object.keys(subjectCounts);
    if (!name.trim() || !examDate || checkedSubjects.length === 0) {
      setConfigError("Sınav adı, tarih ve en az bir ders zorunludur.");
      return;
    }
    setConfigError(null);
    const nextMap: Record<string, DraftQuestion[]> = {};
    for (const subject of checkedSubjects) {
      const count = subjectCounts[subject];
      const existing = questionMap[subject] ?? [];
      nextMap[subject] = Array.from({ length: count }, (_, i) => existing[i] ?? { achievementId: "", correctAnswer: "" });
    }
    setQuestionMap(nextMap);
    setStage("mapping");
  }

  function setQuestionAchievement(subject: string, index: number, achievementId: string) {
    setQuestionMap((prev) => ({ ...prev, [subject]: prev[subject].map((q, i) => (i === index ? { ...q, achievementId } : q)) }));
  }
  function setQuestionAnswer(subject: string, index: number, correctAnswer: string) {
    setQuestionMap((prev) => ({ ...prev, [subject]: prev[subject].map((q, i) => (i === index ? { ...q, correctAnswer } : q)) }));
  }

  // CSV'den Kazanım Ata — yalnızca ders içindeki MEVCUT kazanım kodlarıyla
  // eşleştirir (demo'nun aksine, eşleşmeyen kodlar için yeni bir kazanım
  // OTOMATİK OLUŞTURULMAZ — bu, Kazanım Yükleme sekmesinin kapsamıdır).
  function handleCsvImport(subject: string, file: File) {
    setImportStatus((prev) => ({ ...prev, [subject]: "Dosya ayrıştırılıyor…" }));
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const table = parseCsv(text);
        const dataRows = table.length > 1 ? table.slice(1) : table;
        const byCode = new Map(
          achievements.filter((a) => a.subject === subject).map((a) => [a.code.trim().toLocaleUpperCase("tr-TR"), a]),
        );
        const current = questionMap[subject] ?? [];
        const nextQuestions = [...current];
        let slot = 0;
        let assigned = 0;
        let notFound = 0;
        for (const row of dataRows) {
          if (slot >= nextQuestions.length) break;
          const code = (row[0] ?? "").trim();
          if (!code) continue;
          const ach = byCode.get(code.toLocaleUpperCase("tr-TR"));
          if (!ach) {
            notFound++;
            continue;
          }
          nextQuestions[slot] = { ...nextQuestions[slot], achievementId: ach.id };
          slot++;
          assigned++;
        }
        setQuestionMap((prev) => ({ ...prev, [subject]: nextQuestions }));
        setImportStatus((prev) => ({
          ...prev,
          [subject]: notFound > 0 ? `${assigned} soru atandı, ${notFound} kod bu derste bulunamadı.` : `${assigned} soru otomatik atandı.`,
        }));
      } catch {
        setImportStatus((prev) => ({ ...prev, [subject]: "Hata: dosya okunamadı." }));
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function toggleGrade(grade: string) {
    setEligibleGrades((prev) => (prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]));
  }

  function handleSubmit() {
    setSuccessMsg(null);
    const checkedSubjects = Object.keys(subjectCounts);
    const allQuestions = checkedSubjects.flatMap((subject) => questionMap[subject] ?? []);
    if (allQuestions.length === 0 || allQuestions.some((q) => !q.achievementId)) {
      setFormError("Her soru için bir kazanım seçilmelidir.");
      return;
    }
    setFormError(null);
    createMutation.mutate({
      name: name.trim(),
      examDate,
      type: examType,
      bookletCount,
      feePerStudent: feePerStudent.trim() ? Number(feePerStudent) : null,
      eligibleGradeLevels: eligibleGrades,
      questions: allQuestions.map((q) => ({ achievementId: q.achievementId, correctAnswer: q.correctAnswer || null })),
    });
  }

  function achievementOptionsFor(subject: string, selectedId: string): CurriculumAchievement[] {
    const search = (subjectSearch[subject] ?? "").trim().toLocaleLowerCase("tr-TR");
    const subjectAchievements = achievements.filter((a) => a.subject === subject);
    if (!search) return subjectAchievements;
    const filtered = subjectAchievements.filter(
      (a) => a.code.toLocaleLowerCase("tr-TR").includes(search) || a.label.toLocaleLowerCase("tr-TR").includes(search),
    );
    const selected = subjectAchievements.find((a) => a.id === selectedId);
    if (selected && !filtered.some((a) => a.id === selected.id)) filtered.unshift(selected);
    return filtered;
  }

  if (stage === "config") {
    return (
      <>
      <div className="card card-pad">
        <div className="card-head">
          <h3>Yeni Sınav Uygulaması</h3>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
          Ders başına soru sayısı belirleyin — devam ettiğinizde her ders için, o dersin kazanım taksonomisinden
          soru-kazanım eşleştirmesi yapacağınız bir ekrana geçilir.
        </p>
        {successMsg && <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--strong)" }}>{successMsg}</p>}
        <div className="grid cols-2">
          <div className="field">
            <label>Sınav Uygulaması Adı</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. 1. Dönem Matematik-Fizik Deneme" />
          </div>
          <div className="field">
            <label>Sınav Türü</label>
            <select value={examType} onChange={(e) => setExamType(e.target.value)}>
              {EXAM_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {EXAM_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{ maxWidth: 260, marginTop: 12 }}>
          <label>Tarih</label>
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Ders ve Soru Sayısı</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, border: "1px solid var(--border-strong)", borderRadius: 8, padding: 10 }}>
            {subjects.map((subject) => (
              <div key={subject} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={subjectCounts[subject] !== undefined}
                    onChange={(e) => toggleSubject(subject, e.target.checked)}
                  />
                  {subject}
                </label>
                <input
                  type="number"
                  min="1"
                  value={subjectCounts[subject] ?? 10}
                  disabled={subjectCounts[subject] === undefined}
                  onChange={(e) => setSubjectCounts((prev) => ({ ...prev, [subject]: Math.max(1, Number(e.target.value) || 1) }))}
                  style={{ width: 70 }}
                />
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)" }}>soru</span>
              </div>
            ))}
            {subjects.length === 0 && (
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                Henüz kazanım taksonomisi yüklenmedi — önce Kazanım Yükleme sekmesinden ekleyin.
              </p>
            )}
          </div>
        </div>
        {configError && <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{configError}</p>}
        <button type="button" className="btn primary" style={{ marginTop: 14 }} onClick={continueToMapping}>
          Devam Et: Soru-Kazanım Eşleştirmesi
        </button>
      </div>
      <ExistingExamsPanel />
      </>
    );
  }

  const checkedSubjects = Object.keys(subjectCounts);
  const totalQuestions = checkedSubjects.reduce((sum, s) => sum + (questionMap[s]?.length ?? 0), 0);

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>{name}</h3>
        <span className="hint">
          {EXAM_TYPE_LABEL[examType]} · {examDate} · {totalQuestions} soru
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {checkedSubjects.map((subject) => (
          <div key={subject}>
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 700, margin: "0 0 8px" }}>
              {subject}{" "}
              <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>
                ({questionMap[subject]?.length ?? 0} soru — yalnızca {subject} kazanımları listelenir)
              </span>
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <input
                value={subjectSearch[subject] ?? ""}
                onChange={(e) => setSubjectSearch((prev) => ({ ...prev, [subject]: e.target.value }))}
                placeholder="Kazanım koduyla ara (örn. MAT.9.1)"
                style={{ flex: 1, minWidth: 180, fontSize: "var(--text-xs)" }}
              />
              <label className="btn xs" style={{ cursor: "pointer", margin: 0 }}>
                <Icon name="attach" /> CSV&apos;den Kazanım Ata
                <input
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleCsvImport(subject, file);
                    e.target.value = "";
                  }}
                />
              </label>
              {importStatus[subject] && <span className="hint">{importStatus[subject]}</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
              {(questionMap[subject] ?? []).map((q, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, border: "1px solid var(--border)", borderRadius: 7, padding: "7px 9px" }}>
                  <span style={{ fontSize: "var(--text-2xs)", color: "var(--ink-faint)", fontWeight: 700 }}>SORU {i + 1}</span>
                  <select
                    value={q.achievementId}
                    onChange={(e) => setQuestionAchievement(subject, i, e.target.value)}
                    style={{ fontSize: "var(--text-2xs)" }}
                  >
                    <option value="">— Kazanım seçilmedi —</option>
                    {achievementOptionsFor(subject, q.achievementId).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} · {a.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={q.correctAnswer}
                    onChange={(e) => setQuestionAnswer(subject, i, e.target.value)}
                    style={{ fontSize: "var(--text-2xs)" }}
                  >
                    <option value="">Doğru Cevap: —</option>
                    {EXAM_ANSWER_KEY_OPTIONS.map((o) => (
                      <option key={o} value={o}>
                        Doğru Cevap: {o}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 12 }}>
        <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", marginBottom: 6 }}>
          Sınav Kapsamı
        </label>
        <div className="grid cols-2" style={{ marginBottom: 12 }}>
          <div className="field">
            <label>Kitapçık Sayısı</label>
            <select value={bookletCount} onChange={(e) => setBookletCount(Number(e.target.value) === 2 ? 2 : 4)}>
              <option value={4}>4 (A/B/C/D)</option>
              <option value={2}>2 (A/B)</option>
            </select>
          </div>
          <div className="field">
            <label>Öğrenci Başına Sınav Ücreti (₺)</label>
            <input type="number" min="0" value={feePerStudent} onChange={(e) => setFeePerStudent(e.target.value)} placeholder="Örn. 45" />
          </div>
        </div>
        <div className="field">
          <label>Sınıf Düzeyi Kapsamı (boş = Tümü)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, border: "1px solid var(--border-strong)", borderRadius: 8 }}>
            {EXAM_ELIGIBLE_GRADES.map((g) => (
              <label key={g} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)" }}>
                <input type="checkbox" checked={eligibleGrades.includes(g)} onChange={() => toggleGrade(g)} />
                {GRADE_LEVEL_LABEL[g] ?? g}
              </label>
            ))}
          </div>
        </div>
      </div>

      {formError && <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}
      {successMsg && <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>{successMsg}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={() => setStage("config")}>
          Geri: Ders/Soru Sayısını Düzenle
        </button>
        <button type="button" disabled={createMutation.isPending} className="btn primary" onClick={handleSubmit}>
          {createMutation.isPending ? "Oluşturuluyor…" : "Sınavı Oluştur ve Sınav Merkezi'ne Tanımla"}
        </button>
      </div>
    </div>
  );
}

type AnswerState = Record<string, boolean | null | undefined>;

function SonucTab({ isTeacher }: { isTeacher: boolean }) {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: examKeys.list(), queryFn: fetchBranchExams });
  // TEACHER yalnızca kendi Ders Programı'ndaki sınıflar için sonuç girebilir
  // (bkz. app/api/branch/exams/[examId]/results POST'taki teacherOwnsClassroom
  // kontrolü) — bu yüzden sınıf listesi tüm şube yerine fetchMyClasses'tan gelir.
  const branchClassroomsQuery = useQuery({ queryKey: ["branch-classrooms"], queryFn: fetchBranchClassrooms, enabled: !isTeacher });
  const myClassesQuery = useQuery({ queryKey: ["teacher-my-classes"], queryFn: () => fetchMyClasses(), enabled: isTeacher });

  const [examId, setExamId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [bookletType, setBookletType] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ netScore: number; correctCount: number; wrongCount: number; emptyCount: number } | null>(null);

  const examDetailQuery = useQuery({ queryKey: examKeys.detail(examId), queryFn: () => fetchBranchExamDetail(examId), enabled: !!examId });
  const rosterQuery = useQuery({
    queryKey: examKeys.roster(examId, classroomId),
    queryFn: () => fetchExamResultRoster(examId, classroomId),
    enabled: !!examId && !!classroomId,
  });

  const submitMutation = useMutation({
    mutationFn: (input: { studentId: string; answers: { questionId: string; isCorrect: boolean | null }[]; bookletType?: string | null }) =>
      submitExamResult(examId, input),
    onSuccess: (result) => {
      setLastResult(result);
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: examKeys.roster(examId, classroomId) });
      queryClient.invalidateQueries({ queryKey: examKeys.list() });
    },
    onError: (err) => setSubmitError(err instanceof ApiError ? err.message : "Sonuç kaydedilemedi."),
  });

  const exams = examsQuery.data?.exams ?? [];
  const classrooms = isTeacher
    ? (myClassesQuery.data?.classrooms ?? []).map((c) => ({ id: c.classroomId, name: c.classroomName, studentCount: c.students.length }))
    : (branchClassroomsQuery.data?.classrooms ?? []);
  const roster = rosterQuery.data?.roster ?? [];
  const questions = examDetailQuery.data?.exam.questions ?? [];
  const bookletTypes = examDetailQuery.data?.exam.bookletTypes ?? [];

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setLastResult(null);
    setSubmitError(null);
    setAnswers({});
    setBookletType("");
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
      bookletType: bookletType || null,
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
                {bookletTypes.length > 0 && (
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Kitapçık Türü (opsiyonel)</label>
                    <select value={bookletType} onChange={(e) => setBookletType(e.target.value)}>
                      <option value="">— Seçilmedi —</option>
                      {bookletTypes.map((b) => (
                        <option key={b} value={b}>
                          {b} Kitapçığı
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", marginBottom: 12 }}>
                  {questions.map((q) => (
                    <div key={q.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: "var(--text-xs)", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                      <span>
                        <b>Soru {q.orderIndex}</b> — {q.achievementCode}
                        {q.correctAnswer && <span style={{ color: "var(--ink-faint)" }}> · Doğru: {q.correctAnswer}</span>}
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
