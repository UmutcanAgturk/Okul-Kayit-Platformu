"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createHqExam,
  createTenant,
  fetchHqAccountingSummary,
  fetchHqAnalytics,
  fetchHqExamBranchBreakdown,
  fetchHqExams,
  fetchHqStudents,
  fetchHqTenants,
  hqKeys,
  toggleTenantActive,
  type HqExam,
  type HqTenant,
} from "@/lib/api/hq";
import { downloadLogoTigerCsv } from "@/lib/logo-tiger-csv";
import { HBarChart } from "@/components/ui/charts/HBarChart";
import { setActingTenant } from "@/lib/api/hq";
import { PrintDocumentViewer } from "@/components/documents/PrintDocumentViewer";
import { AnalyticsReportPrintBody } from "@/components/documents/DocumentPrintBodies";
import { StudentDetailDrawer } from "@/components/students-roster/StudentDetailDrawer";

const ALLOWED_ROLES = ["SUPERADMIN"];
const TENANT_TYPE_LABEL: Record<string, string> = { GENEL_MERKEZ: "Genel Merkez", SUBE: "Şube", BOLUM: "Bölüm" };
const EXAM_ELIGIBLE_GRADE_OPTIONS = ["SINIF_5", "SINIF_6", "SINIF_7", "SINIF_8", "SINIF_9", "SINIF_10", "SINIF_11", "SINIF_12"];
const GRADE_LABEL: Record<string, string> = {
  SINIF_5: "5. Sınıf",
  SINIF_6: "6. Sınıf",
  SINIF_7: "7. Sınıf",
  SINIF_8: "8. Sınıf",
  SINIF_9: "9. Sınıf",
  SINIF_10: "10. Sınıf",
  SINIF_11: "11. Sınıf",
  SINIF_12: "12. Sınıf",
};

function formatTl2(n: number) {
  return "₺" + Math.round(n).toLocaleString("tr-TR");
}

function formatTl(n: number) {
  return `₺${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TenantCard({
  tenant,
  onToggleActive,
  toggling,
  onActAs,
  actingAs,
}: {
  tenant: HqTenant;
  onToggleActive: (tenantId: string) => void;
  toggling: boolean;
  onActAs: (tenantId: string) => void;
  actingAs: boolean;
}) {
  const occupancyPct = tenant.capacity && tenant.capacity > 0 ? Math.round((tenant.studentCount / tenant.capacity) * 100) : null;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{tenant.name}</h3>
          <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
            {TENANT_TYPE_LABEL[tenant.type] ?? tenant.type} · {tenant.code}
            {tenant.city && ` · ${tenant.city}${tenant.district ? "/" + tenant.district : ""}`}
          </p>
        </div>
        {!tenant.isActive && <span className="chip neutral">Pasif</span>}
      </div>
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: "var(--text-sm)" }}>
        <div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Öğrenci</p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {tenant.studentCount}
            {tenant.capacity ? ` / ${tenant.capacity}` : ""}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Öğretmen</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{tenant.teacherCount}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Personel</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{tenant.staffCount}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Sınıf</p>
          <p style={{ margin: 0, fontWeight: 600 }}>{tenant.classroomCount}</p>
        </div>
      </div>
      {occupancyPct !== null && (
        <div style={{ marginTop: 10 }}>
          <div className="progress-track" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, occupancyPct)}%` }} />
          </div>
          <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Doluluk %{occupancyPct}</p>
        </div>
      )}
      <p style={{ margin: "12px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Şube Müdürü: <span style={{ fontWeight: 600, color: "var(--ink-muted)" }}>{tenant.branchAdminName ?? "Atanmamış"}</span>
      </p>
      {tenant.type !== "GENEL_MERKEZ" && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onToggleActive(tenant.id)} disabled={toggling} className="btn xs">
            {tenant.isActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
          </button>
          {tenant.type === "SUBE" && tenant.isActive && (
            <button type="button" onClick={() => onActAs(tenant.id)} disabled={actingAs} className="btn xs primary">
              {actingAs ? "Geçiliyor…" : "Bu Şube Olarak Yönet"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateTenantForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [capacity, setCapacity] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: hqKeys.tenants() });
      setName("");
      setCity("");
      setDistrict("");
      setAddress("");
      setPhone("");
      setEmail("");
      setCapacity("");
      setTaxNo("");
      setManagerFirstName("");
      setManagerLastName("");
      setFormError(null);
      setCredentials(data.credentials);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Kurum oluşturulamadı."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !city.trim() || !district.trim() || !managerFirstName.trim() || !managerLastName.trim()) {
      setFormError("Kurum adı, şehir, ilçe ve şube müdürü adı/soyadı zorunludur.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      city: city.trim(),
      district: district.trim(),
      managerFirstName: managerFirstName.trim(),
      managerLastName: managerLastName.trim(),
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      capacity: capacity ? Number(capacity) : undefined,
      taxNo: taxNo.trim() || undefined,
    });
  }

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Yeni Kurum Ekle</h3>
      </div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div className="field">
          <label>Kurum Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Şehir</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="field">
            <label>İlçe</label>
            <input value={district} onChange={(e) => setDistrict(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Açık Adres (opsiyonel)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Telefon (opsiyonel)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label>E-posta (opsiyonel)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Öğrenci Kapasitesi (opsiyonel)</label>
            <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min="1" />
          </div>
          <div className="field">
            <label>Vergi No (opsiyonel)</label>
            <input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field">
            <label>Şube Müdürü Adı</label>
            <input value={managerFirstName} onChange={(e) => setManagerFirstName(e.target.value)} />
          </div>
          <div className="field">
            <label>Şube Müdürü Soyadı</label>
            <input value={managerLastName} onChange={(e) => setManagerLastName(e.target.value)} />
          </div>
        </div>

        {formError && <p style={{ gridColumn: "span 2", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

        <div style={{ gridColumn: "span 2" }}>
          <button type="submit" disabled={createMutation.isPending} className="btn primary">
            {createMutation.isPending ? "Oluşturuluyor…" : "Kurumu Ekle"}
          </button>
        </div>
      </form>

      {credentials && (
        <div className="card card-pad" style={{ marginTop: 16, borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--strong)" }}>Şube Müdürü Giriş Bilgileri Oluşturuldu</h3>
          <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--strong)" }}>
            Bu şifre yalnızca burada gösterilir — hemen şube müdürüne iletin, tekrar görüntülenemez.
          </p>
          <dl style={{ margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 4, fontSize: "var(--text-xs)", color: "var(--strong)" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt>Kullanıcı adı</dt>
              <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.username}</dd>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <dt>Şifre</dt>
              <dd style={{ margin: 0, fontFamily: "monospace" }}>{credentials.password}</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

function HqStudentsPanel({ tenants }: { tenants: HqTenant[] }) {
  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const query = useQuery({ queryKey: hqKeys.students(q, tenantId), queryFn: () => fetchHqStudents({ q, tenantId }) });
  const data = query.data;
  const selectedStudent = data?.students.find((s) => s.id === selectedStudentId) ?? null;

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Öğrenciler — Tüm Şubeler</h3>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Genel Merkez, tüm şubelerdeki her öğrenciyi tek tek görebilir — şube bazlı kısıtlama uygulanmaz.
      </p>

      {data && (
        <div className="grid cols-4" style={{ marginBottom: 16 }}>
          <div className="card stat-card">
            <p className="stat-label">Toplam Öğrenci</p>
            <p className="stat-value">{data.summary.totalStudents}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Şube Sayısı</p>
            <p className="stat-value">{data.summary.branchCount}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">En Kalabalık Şube</p>
            <p className="stat-value" style={{ fontSize: "var(--text-md)" }}>
              {data.summary.busiestBranch ? `${data.summary.busiestBranch.name} (${data.summary.busiestBranch.count})` : "—"}
            </p>
          </div>
          <div className="card stat-card tone-weak">
            <p className="stat-label">Sınıfa Atanmamış</p>
            <p className="stat-value">{data.summary.unassignedCount}</p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim veya öğrenci no ile ara…" />
        </div>
        <div className="field">
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="">Tüm Şubeler</option>
            {tenants
              .filter((t) => t.type !== "GENEL_MERKEZ")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {query.isLoading && <p style={{ marginTop: 12, color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
      {data && (
        <div className="table-wrap" style={{ marginTop: 14, maxHeight: 420, overflowY: "auto" }}>
          <table className="data">
            <thead>
              <tr>
                <th>Öğrenci</th>
                <th>Öğrenci No</th>
                <th>Şube</th>
                <th>Sınıf</th>
                <th style={{ textAlign: "right" }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {data.students.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--ink-faint)" }}>
                    Öğrenci bulunamadı
                  </td>
                </tr>
              )}
              {data.students.map((s) => (
                <tr key={s.id} className="row-clickable" onClick={() => setSelectedStudentId(s.id)}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.studentNo}</td>
                  <td>{s.tenantName}</td>
                  <td>{s.classroomName ?? <span className="chip critical">Atanmadı</span>}</td>
                  <td style={{ textAlign: "right" }}>{s.avgNet ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentDetailDrawer
        student={
          selectedStudent
            ? {
                id: selectedStudent.id,
                studentNo: selectedStudent.studentNo,
                name: selectedStudent.name,
                gradeLevel: selectedStudent.gradeLevel,
                classroomId: selectedStudent.classroomId,
                classroomName: selectedStudent.classroomName,
                guardianName: selectedStudent.guardianName,
                guardianPhone: selectedStudent.guardianPhone,
              }
            : null
        }
        onClose={() => setSelectedStudentId(null)}
        readOnly
      />
    </div>
  );
}

function ExportLogoTigerButton({ exam }: { exam: HqExam }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function handleClick() {
    setState("loading");
    try {
      const { branches } = await fetchHqExamBranchBreakdown(exam.id);
      if (branches.length === 0) {
        setState("error");
        return;
      }
      downloadLogoTigerCsv(exam, branches);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <button type="button" className="btn xs" onClick={handleClick} disabled={state === "loading"}>
        {state === "loading" ? "Hazırlanıyor…" : "Logo/Tiger CSV İndir"}
      </button>
      {state === "error" && (
        <span style={{ marginLeft: 8, fontSize: "var(--text-2xs)", color: "var(--critical)" }}>
          İndirilemedi — bu sınavda henüz kayıtlı öğrencisi olan şube yok.
        </span>
      )}
    </>
  );
}

function HqExamsPanel() {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: hqKeys.exams(), queryFn: fetchHqExams });

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookletCount, setBookletCount] = useState<2 | 4>(4);
  const [feePerStudent, setFeePerStudent] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(EXAM_ELIGIBLE_GRADE_OPTIONS);
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: createHqExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hqKeys.exams() });
      setName("");
      setFeePerStudent("");
      setFormError(null);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Sınav oluşturulamadı."),
  });

  function toggleGrade(g: string) {
    setSelectedGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !examDate || selectedGrades.length === 0) {
      setFormError("Sınav adı, tarih ve en az bir sınıf düzeyi zorunludur.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      examDate,
      bookletCount,
      feePerStudent: feePerStudent ? Number(feePerStudent) : undefined,
      eligibleGradeLevels: selectedGrades,
    });
  }

  const exams = examsQuery.data?.exams ?? [];

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Genel Sınav Merkezi</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Türkiye geneli deneme sınavı tanımlayın — seçilen sınıf düzeylerindeki (Ortaokul+Lise) TÜM şubelerde optik form
        ihtiyacı ve toplam fatura tutarı canlı öğrenci sayısından otomatik hesaplanır.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <div className="field">
          <label>Sınav Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. Seviye 360 Türkiye Geneli Deneme #1" />
        </div>
        <div className="field">
          <label>Sınav Tarihi</label>
          <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Kitapçık Sayısı</label>
          <select value={bookletCount} onChange={(e) => setBookletCount(Number(e.target.value) as 2 | 4)}>
            <option value={4}>4 (A/B/C/D)</option>
            <option value={2}>2 (A/B)</option>
          </select>
        </div>
        <div className="field">
          <label>Öğrenci Başına Ücret (₺, opsiyonel)</label>
          <input type="number" min="0" value={feePerStudent} onChange={(e) => setFeePerStudent(e.target.value)} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ display: "block", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)", marginBottom: 5 }}>
            Katılacak Sınıf Düzeyleri
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: 10 }}>
            {EXAM_ELIGIBLE_GRADE_OPTIONS.map((g) => (
              <label key={g} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                <input type="checkbox" checked={selectedGrades.includes(g)} onChange={() => toggleGrade(g)} />
                {GRADE_LABEL[g]}
              </label>
            ))}
          </div>
        </div>

        {formError && <p style={{ gridColumn: "span 2", margin: 0, fontSize: "var(--text-xs)", color: "var(--critical)" }}>{formError}</p>}

        <div style={{ gridColumn: "span 2" }}>
          <button type="submit" disabled={createMutation.isPending} className="btn primary">
            {createMutation.isPending ? "Oluşturuluyor…" : "Sınavı Oluştur"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 20 }}>
        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", fontWeight: 700 }}>Tanımlı Sınavlar ({exams.length})</h3>
        {examsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
        {!examsQuery.isLoading && exams.length === 0 && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz tanımlı bir Genel Sınav yok.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exams.map((exam) => (
            <div key={exam.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontSize: "var(--text-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600 }}>{exam.name}</span>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{new Date(exam.examDate).toLocaleDateString("tr-TR")}</span>
              </div>
              <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                <span>{exam.studentCount} öğrenci</span>
                <span>{exam.opticFormCount} optik form</span>
                <span>{exam.feePerStudent ? formatTl2(exam.totalFee) : "—"}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <ExportLogoTigerButton exam={exam} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HqAnalyticsPanel() {
  const query = useQuery({ queryKey: hqKeys.analytics(), queryFn: fetchHqAnalytics });
  const data = query.data;
  const medal = ["🥇", "🥈", "🥉"];
  const [showPrint, setShowPrint] = useState(false);

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Global Analytics</h3>
        <button type="button" className="btn xs" onClick={() => setShowPrint(true)} disabled={!data}>
          Görüntüle / Yazdır
        </button>
      </div>
      <PrintDocumentViewer open={showPrint} onClose={() => setShowPrint(false)} documentNo="Global Analytics Raporu">
        {data && (
          <AnalyticsReportPrintBody
            scopeName="Seviye 360 Genel Merkez"
            subjectPerformance={data.subjectPerformance}
            branchRevenue={data.branchRevenue}
          />
        )}
      </PrintDocumentViewer>
      <p style={{ margin: "0 0 14px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Tüm kurumlar genelinde gerçek sınav sonuçlarından ders bazlı başarı ve şube bazlı gelir karşılaştırması.
      </p>

      {query.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      {data && (
        <>
          <div className="grid cols-3">
            <div className="card stat-card">
              <p className="stat-label">Toplam Şube</p>
              <p className="stat-value">{data.totalBranches}</p>
            </div>
            <div className="card stat-card">
              <p className="stat-label">Toplam Öğrenci</p>
              <p className="stat-value">{data.totalStudents}</p>
            </div>
            <div className="card stat-card tone-strong">
              <p className="stat-label">Genel Ortalama Net</p>
              <p className="stat-value">{data.orgAvgNet !== null ? (Math.round(data.orgAvgNet * 10) / 10).toString() : "—"}</p>
            </div>
          </div>

          {data.topBranches.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", fontWeight: 700 }}>🏆 Akademik Olarak En Başarılı Şubeler</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {data.topBranches.map((b, i) => (
                  <div key={b.tenantId} className="card card-pad" style={{ minWidth: 160, flex: 1, textAlign: "center" }}>
                    <p style={{ margin: 0, fontSize: "var(--text-xl)" }}>{medal[i]}</p>
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 700 }}>{b.tenantName}</p>
                    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
                      {b.city} · {Math.round((b.avgNet as number) * 10) / 10} net
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid cols-2" style={{ marginTop: 20 }}>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", fontWeight: 700 }}>Ders Bazlı Ortalama Başarı</h3>
              {data.subjectPerformance.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Henüz kazanım sonucu yok.</p>
              ) : (
                <HBarChart
                  max={100}
                  unit="%"
                  rows={data.subjectPerformance.map((s) => ({
                    label: s.subject,
                    sub: `${s.count} sonuç`,
                    value: s.avgMasteryPct,
                    tone: s.avgMasteryPct >= 70 ? "strong" : s.avgMasteryPct >= 40 ? "weak" : "critical",
                  }))}
                />
              )}
            </div>
            <div>
              <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-sm)", fontWeight: 700 }}>Şube Bazlı Gelir</h3>
              {data.branchRevenue.length === 0 ? (
                <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Kurum yok.</p>
              ) : (
                <HBarChart
                  rows={data.branchRevenue.map((b) => ({ label: b.tenantName, sub: b.city ?? undefined, value: b.totalGelir, valueLabel: formatTl2(b.totalGelir) }))}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Kurum Yönetimi — demo/seviye360-app.html'deki "hq:kurumlar" ekranının
 * gerçek karşılığı: yeni kurum ekleme (otomatik oluşturulan Şube Yöneticisi
 * hesabıyla birlikte, bkz. app/api/hq/tenants POST) ve devre dışı bırakma/
 * yeniden etkinleştirme (StaffProfile deaktivasyonuyla aynı desen — gerçek
 * silme yerine `Tenant.isActive`). Mali Özet, zaten var olan
 * app/api/hq/accounting-ledger'ın (Superadmin konsolide görünüm) ilk
 * gerçek frontend tüketicisidir.
 */
export function HqDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const toggleActiveMutation = useMutation({
    mutationFn: toggleTenantActive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hqKeys.tenants() }),
  });

  const actAsMutation = useMutation({
    mutationFn: setActingTenant,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.me() });
      router.push("/dashboard");
    },
  });

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

  const tenantsQuery = useQuery({ queryKey: hqKeys.tenants(), queryFn: fetchHqTenants, enabled: !!me });
  const ledgerQuery = useQuery({ queryKey: hqKeys.accountingSummary(), queryFn: fetchHqAccountingSummary, enabled: !!me });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. Kurum Yönetimi yalnızca Genel Merkez (Superadmin) rolüne açıktır.
        </p>
      </div>
    );
  }

  const tenants = tenantsQuery.data?.tenants ?? [];
  const branches = tenants.filter((t) => t.type !== "GENEL_MERKEZ");
  const totalStudents = branches.reduce((s, t) => s + t.studentCount, 0);
  const totalStaff = branches.reduce((s, t) => s + t.staffCount + t.teacherCount, 0);
  const ledger = ledgerQuery.data;

  return (
    <div className="screen">
      <h1>Kurum Yönetimi</h1>
      <p className="lede">
        {me.firstName} {me.lastName}
      </p>

      {tenantsQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="grid cols-3">
          <div className="card stat-card">
            <p className="stat-label">Toplam Şube</p>
            <p className="stat-value">{branches.length}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Toplam Öğrenci</p>
            <p className="stat-value">{totalStudents}</p>
          </div>
          <div className="card stat-card">
            <p className="stat-label">Toplam Öğretmen + Personel</p>
            <p className="stat-value">{totalStaff}</p>
          </div>
        </div>

        <div>
          <h2 style={{ margin: "0 0 12px", fontSize: "var(--text-md)", fontWeight: 700 }}>Tüm Kurumlar</h2>
          <div className="grid cols-2">
            {tenants.map((t) => (
              <TenantCard
                key={t.id}
                tenant={t}
                onToggleActive={(id) => toggleActiveMutation.mutate(id)}
                toggling={toggleActiveMutation.isPending}
                onActAs={(id) => actAsMutation.mutate(id)}
                actingAs={actAsMutation.isPending && actAsMutation.variables === t.id}
              />
            ))}
          </div>
        </div>

        <CreateTenantForm />

        <HqStudentsPanel tenants={tenants} />

        <HqExamsPanel />

        <HqAnalyticsPanel />

        <div className="card card-pad">
          <div className="card-head">
            <h3>Konsolide Mali Özet</h3>
          </div>
          {ledgerQuery.isLoading && <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>}
          {ledger && (
            <>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Kurum</th>
                      <th style={{ textAlign: "right" }}>Kayıt</th>
                      <th style={{ textAlign: "right" }}>Gelir</th>
                      <th style={{ textAlign: "right" }}>Gider</th>
                      <th style={{ textAlign: "right" }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.tenants.map((t) => (
                      <tr key={t.tenantId}>
                        <td>{t.tenantName}</td>
                        <td style={{ textAlign: "right" }}>{t.entryCount}</td>
                        <td style={{ textAlign: "right" }}>{formatTl(t.totalGelir)}</td>
                        <td style={{ textAlign: "right" }}>{formatTl(t.totalGider)}</td>
                        <td style={{ textAlign: "right" }}>{formatTl(t.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 12, fontSize: "var(--text-md)", fontWeight: 700 }}>
                <span>Genel Toplam Net</span>
                <span>{formatTl(ledger.grandTotal.net)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
