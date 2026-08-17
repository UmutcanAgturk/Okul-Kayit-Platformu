"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  BOOKLET_DISPATCH_STATUSES,
  BOOKLET_DISPATCH_STATUS_LABEL,
  createHqExam,
  createTenant,
  deleteHqExam,
  deleteTenant,
  fetchHqAccountingSummary,
  fetchHqAnalytics,
  fetchHqExamBranchBreakdown,
  fetchHqExams,
  fetchHqStudents,
  fetchHqTenants,
  hqKeys,
  KURUM_TURU_OPTIONS,
  resetTenantCredentials,
  toggleTenantActive,
  updateExamBranchDispatch,
  updateHqExam,
  updateTenant,
  type BookletDispatchStatus,
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

function TenantEditForm({ tenant, onDone }: { tenant: HqTenant; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(tenant.name);
  const [kurumTuru, setKurumTuru] = useState(tenant.kurumTuru ?? "");
  const [city, setCity] = useState(tenant.city ?? "");
  const [district, setDistrict] = useState(tenant.district ?? "");
  const [address, setAddress] = useState(tenant.address ?? "");
  const [phone, setPhone] = useState(tenant.phone ?? "");
  const [email, setEmail] = useState(tenant.email ?? "");
  const [capacity, setCapacity] = useState(tenant.capacity ? String(tenant.capacity) : "");
  const [taxNo, setTaxNo] = useState(tenant.taxNo ?? "");
  const [openingDate, setOpeningDate] = useState(tenant.openingDate ? tenant.openingDate.slice(0, 10) : "");
  const [managerFirstName, setManagerFirstName] = useState(tenant.branchAdminName?.split(" ")[0] ?? "");
  const [managerLastName, setManagerLastName] = useState(tenant.branchAdminName?.split(" ").slice(1).join(" ") ?? "");
  const [managerPhone, setManagerPhone] = useState(tenant.branchAdminPhone ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      updateTenant(tenant.id, {
        name: name.trim(),
        kurumTuru: kurumTuru || null,
        city: city.trim(),
        district: district.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        capacity: capacity ? Number(capacity) : null,
        taxNo: taxNo.trim() || null,
        openingDate: openingDate || null,
        managerFirstName: managerFirstName.trim() || undefined,
        managerLastName: managerLastName.trim() || undefined,
        managerPhone: managerPhone.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hqKeys.tenants() });
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Kurum güncellenemedi."),
  });

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>{tenant.name} — Düzenle</h3>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label>Kurum Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label>Kurum Türü</label>
          <select value={kurumTuru} onChange={(e) => setKurumTuru(e.target.value)}>
            <option value="">—</option>
            {KURUM_TURU_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Şehir</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="field">
          <label>İlçe</label>
          <input value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label>Açık Adres</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="field">
          <label>Telefon</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label>E-posta</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div className="field">
          <label>Açılış Tarihi</label>
          <input value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} type="date" />
        </div>
        <div className="field">
          <label>Öğrenci Kapasitesi</label>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" min="1" />
        </div>
        <div className="field">
          <label>Vergi No</label>
          <input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} />
        </div>
        <div className="field">
          <label>Şube Müdürü Adı</label>
          <input value={managerFirstName} onChange={(e) => setManagerFirstName(e.target.value)} />
        </div>
        <div className="field">
          <label>Şube Müdürü Soyadı</label>
          <input value={managerLastName} onChange={(e) => setManagerLastName(e.target.value)} />
        </div>
        <div className="field">
          <label>Şube Müdürü Telefonu</label>
          <input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} />
        </div>
      </div>

      {error && <p style={{ margin: "10px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" className="btn primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
        </button>
        <button type="button" className="btn" onClick={onDone}>
          Vazgeç
        </button>
      </div>
    </div>
  );
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
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteTenant(tenant.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hqKeys.tenants() });
    },
    onError: (e) => setDeleteError(e instanceof ApiError ? e.message : "Kurum silinemedi."),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetTenantCredentials(tenant.id),
    onSuccess: (data) => {
      setCredentials(data.credentials);
      setResetError(null);
    },
    onError: (e) => setResetError(e instanceof ApiError ? e.message : "Kimlik bilgisi sıfırlanamadı."),
  });

  if (editing) {
    return <TenantEditForm tenant={tenant} onDone={() => setEditing(false)} />;
  }

  const occupancyPct = tenant.capacity && tenant.capacity > 0 ? Math.round((tenant.studentCount / tenant.capacity) * 100) : null;
  return (
    <div className="card card-pad">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700 }}>{tenant.name}</h3>
          <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
            {tenant.kurumTuru ?? TENANT_TYPE_LABEL[tenant.type] ?? tenant.type} · {tenant.code}
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
        {tenant.branchAdminPhone && ` · ${tenant.branchAdminPhone}`}
      </p>

      {credentials && (
        <div className="card card-pad" style={{ marginTop: 10, borderColor: "var(--strong)", background: "var(--strong-bg)" }}>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--strong)" }}>
            Yeni Şifre Oluşturuldu — yalnızca burada gösterilir
          </p>
          <dl style={{ margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 2, fontSize: "var(--text-xs)", color: "var(--strong)" }}>
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
      {resetError && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{resetError}</p>}

      {deleting ? (
        <div style={{ marginTop: 12, border: "1px solid var(--critical)", borderRadius: 9, padding: "10px 12px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>
          <b>{tenant.name}</b> kalıcı olarak silinsin mi? Bu işlem geri alınamaz.
          {deleteError && <p style={{ margin: "6px 0 0" }}>{deleteError}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" className="btn xs danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
              Evet, Sil
            </button>
            <button type="button" className="btn xs" onClick={() => setDeleting(false)}>
              Vazgeç
            </button>
          </div>
        </div>
      ) : (
        tenant.type !== "GENEL_MERKEZ" && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setEditing(true)} className="btn xs">
              Düzenle
            </button>
            <button type="button" onClick={() => onToggleActive(tenant.id)} disabled={toggling} className="btn xs">
              {tenant.isActive ? "Devre Dışı Bırak" : "Yeniden Etkinleştir"}
            </button>
            {tenant.branchAdminName && (
              <button type="button" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending} className="btn xs">
                {resetMutation.isPending ? "Sıfırlanıyor…" : "Kimlik Bilgisini Sıfırla"}
              </button>
            )}
            {tenant.type === "SUBE" && tenant.isActive && (
              <button type="button" onClick={() => onActAs(tenant.id)} disabled={actingAs} className="btn xs primary">
                {actingAs ? "Geçiliyor…" : "Bu Şube Olarak Yönet"}
              </button>
            )}
            <button type="button" onClick={() => setDeleting(true)} className="btn xs danger">
              Sil
            </button>
          </div>
        )
      )}
    </div>
  );
}

function CreateTenantForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [kurumTuru, setKurumTuru] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [openingDate, setOpeningDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [taxNo, setTaxNo] = useState("");
  const [managerFirstName, setManagerFirstName] = useState("");
  const [managerLastName, setManagerLastName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: createTenant,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: hqKeys.tenants() });
      setName("");
      setKurumTuru("");
      setCity("");
      setDistrict("");
      setAddress("");
      setPhone("");
      setEmail("");
      setOpeningDate("");
      setCapacity("");
      setTaxNo("");
      setManagerFirstName("");
      setManagerLastName("");
      setManagerPhone("");
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
      kurumTuru: kurumTuru || undefined,
      openingDate: openingDate || undefined,
      managerPhone: managerPhone.trim() || undefined,
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
            <label>Kurum Türü (opsiyonel)</label>
            <select value={kurumTuru} onChange={(e) => setKurumTuru(e.target.value)}>
              <option value="">—</option>
              {KURUM_TURU_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Açılış Tarihi (opsiyonel)</label>
            <input value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} type="date" />
          </div>
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
        <div className="field">
          <label>Şube Müdürü Telefonu (opsiyonel)</label>
          <input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} />
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
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const query = useQuery({ queryKey: hqKeys.students(q, tenantId), queryFn: () => fetchHqStudents({ q, tenantId }) });
  const data = query.data;
  const selectedStudent = data?.students.find((s) => s.id === selectedStudentId) ?? null;

  // Komut Paleti'nden gelen derin bağlantı (task #93) — bkz. CommandPalette.tsx.
  useEffect(() => {
    const targetId = searchParams.get("student");
    if (targetId && data?.students.some((s) => s.id === targetId)) {
      setSelectedStudentId(targetId);
    }
  }, [searchParams, data]);

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
      const withStudents = branches.filter((b) => b.studentCount > 0);
      if (withStudents.length === 0) {
        setState("error");
        return;
      }
      downloadLogoTigerCsv(exam, withStudents);
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

const DISPATCH_CHIP_TONE: Record<BookletDispatchStatus, string> = {
  HAZIRLANIYOR: "neutral",
  BASILIYOR: "weak",
  KARGOYA_VERILDI: "strong",
  TESLIM_EDILDI: "strong",
};

function ExamBranchBreakdownTable({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["hq-exam-breakdown", examId], queryFn: () => fetchHqExamBranchBreakdown(examId) });

  const cycleMutation = useMutation({
    mutationFn: ({ tenantId, status }: { tenantId: string; status: BookletDispatchStatus }) => updateExamBranchDispatch(examId, tenantId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hq-exam-breakdown", examId] }),
  });

  if (query.isLoading) return <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Yükleniyor…</p>;
  const branches = query.data?.branches ?? [];
  if (branches.length === 0) return <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>Hedeflenen şube yok.</p>;

  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table className="data">
        <thead>
          <tr>
            <th>Şube</th>
            <th style={{ textAlign: "right" }}>Öğrenci</th>
            <th style={{ textAlign: "right" }}>Optik</th>
            <th style={{ textAlign: "right" }}>Fatura Tutarı</th>
            <th>Kitapçık Kargo Durumu</th>
          </tr>
        </thead>
        <tbody>
          {branches.map((b) => {
            const idx = BOOKLET_DISPATCH_STATUSES.indexOf(b.dispatchStatus);
            const next = BOOKLET_DISPATCH_STATUSES[(idx + 1) % BOOKLET_DISPATCH_STATUSES.length];
            return (
              <tr key={b.tenantId}>
                <td>{b.tenantName}</td>
                <td style={{ textAlign: "right" }}>{b.studentCount}</td>
                <td style={{ textAlign: "right" }}>{b.opticFormCount}</td>
                <td style={{ textAlign: "right" }}>{formatTl2(b.totalFee)}</td>
                <td>
                  <button
                    type="button"
                    className={`chip ${DISPATCH_CHIP_TONE[b.dispatchStatus]}`}
                    style={{ cursor: "pointer", border: "none" }}
                    disabled={cycleMutation.isPending}
                    onClick={() => cycleMutation.mutate({ tenantId: b.tenantId, status: next })}
                    title="Sonraki duruma geçmek için tıklayın"
                  >
                    {BOOKLET_DISPATCH_STATUS_LABEL[b.dispatchStatus]}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExamEditForm({ exam, onDone }: { exam: HqExam; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(exam.name);
  const [examDate, setExamDate] = useState(exam.examDate);
  const [bookletCount, setBookletCount] = useState<2 | 4>(exam.bookletTypes.length === 2 ? 2 : 4);
  const [feePerStudent, setFeePerStudent] = useState(exam.feePerStudent ? String(exam.feePerStudent) : "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateHqExam(exam.id, { name: name.trim(), examDate, bookletCount, feePerStudent: feePerStudent ? Number(feePerStudent) : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hqKeys.exams() });
      onDone();
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "Sınav güncellenemedi."),
  });

  return (
    <div style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
        <div className="field">
          <label>Sınav Adı</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
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
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-faint)" }}>
        Kapsam (şube/sınıf düzeyi) değişikliği için sınavı silip yeniden tanımlayın.
      </p>
      {error && <p style={{ margin: "8px 0 0", fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--critical)" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" className="btn xs primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          Kaydet
        </button>
        <button type="button" className="btn xs" onClick={onDone}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}

function HqExamsPanel({ branches }: { branches: HqTenant[] }) {
  const queryClient = useQueryClient();
  const examsQuery = useQuery({ queryKey: hqKeys.exams(), queryFn: fetchHqExams });

  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookletCount, setBookletCount] = useState<2 | 4>(4);
  const [feePerStudent, setFeePerStudent] = useState("");
  const [selectedGrades, setSelectedGrades] = useState<string[]>(EXAM_ELIGIBLE_GRADE_OPTIONS);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(() => branches.map((b) => b.id));
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [branchesInitialized, setBranchesInitialized] = useState(branches.length > 0);

  useEffect(() => {
    if (!branchesInitialized && branches.length > 0) {
      setSelectedBranchIds(branches.map((b) => b.id));
      setBranchesInitialized(true);
    }
  }, [branches, branchesInitialized]);

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

  const deleteMutation = useMutation({
    mutationFn: (examId: string) => deleteHqExam(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hqKeys.exams() });
      setDeletingId(null);
      setDeleteError(null);
    },
    onError: (e) => setDeleteError(e instanceof ApiError ? e.message : "Sınav silinemedi."),
  });

  function toggleGrade(g: string) {
    setSelectedGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !examDate || selectedGrades.length === 0 || selectedBranchIds.length === 0) {
      setFormError("Sınav adı, tarih, en az bir sınıf düzeyi ve en az bir şube zorunludur.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      examDate,
      bookletCount,
      feePerStudent: feePerStudent ? Number(feePerStudent) : undefined,
      eligibleGradeLevels: selectedGrades,
      branchIds: selectedBranchIds,
    });
  }

  const exams = examsQuery.data?.exams ?? [];
  const allBranchIds = branches.map((b) => b.id);
  const allBranchesSelected = allBranchIds.length > 0 && allBranchIds.every((id) => selectedBranchIds.includes(id));

  return (
    <div className="card card-pad">
      <div className="card-head">
        <h3>Genel Sınav Merkezi</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>
        Türkiye geneli deneme sınavı tanımlayın — hedeflenen şube ve sınıf düzeylerinde optik form ihtiyacı ve toplam
        fatura tutarı canlı öğrenci sayısından otomatik hesaplanır.
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
        <div style={{ gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
            <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--ink-muted)" }}>Kapsam (Şubeler)</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
              <input
                type="checkbox"
                checked={allBranchesSelected}
                onChange={() => setSelectedBranchIds(allBranchesSelected ? [] : allBranchIds)}
              />
              Tümü
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", padding: 10, maxHeight: 140, overflowY: "auto" }}>
            {branches.map((b) => (
              <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                <input type="checkbox" checked={selectedBranchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />
                {b.name}
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
          {exams.map((exam) =>
            editingId === exam.id ? (
              <ExamEditForm key={exam.id} exam={exam} onDone={() => setEditingId(null)} />
            ) : (
              <div key={exam.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 10, fontSize: "var(--text-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600 }}>{exam.name}</span>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)" }}>{new Date(exam.examDate).toLocaleDateString("tr-TR")}</span>
                </div>
                <div style={{ marginTop: 4, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
                  <span>{exam.branchCount} şube</span>
                  <span>{exam.studentCount} öğrenci</span>
                  <span>{exam.opticFormCount} optik form</span>
                  <span>{exam.feePerStudent ? formatTl2(exam.totalFee) : "—"}</span>
                </div>

                {deletingId === exam.id ? (
                  <div style={{ marginTop: 8, border: "1px solid var(--critical)", borderRadius: 9, padding: "8px 10px", fontSize: "var(--text-xs)", color: "var(--critical)" }}>
                    <b>{exam.name}</b> silinsin mi? Bu işlem geri alınamaz.
                    {deleteError && <p style={{ margin: "6px 0 0" }}>{deleteError}</p>}
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <button type="button" className="btn xs danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(exam.id)}>
                        Evet, Sil
                      </button>
                      <button type="button" className="btn xs" onClick={() => setDeletingId(null)}>
                        Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <ExportLogoTigerButton exam={exam} />
                    <button type="button" className="btn xs" onClick={() => setExpandedId(expandedId === exam.id ? null : exam.id)}>
                      {expandedId === exam.id ? "Dağılımı Gizle" : "Şube Dağılımı"}
                    </button>
                    <button
                      type="button"
                      className="btn xs"
                      onClick={() => {
                        setEditingId(exam.id);
                        setDeletingId(null);
                        setDeleteError(null);
                      }}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="btn xs danger"
                      onClick={() => {
                        setDeletingId(exam.id);
                        setDeleteError(null);
                      }}
                    >
                      Sil
                    </button>
                  </div>
                )}

                {expandedId === exam.id && deletingId !== exam.id && <ExamBranchBreakdownTable examId={exam.id} />}
              </div>
            ),
          )}
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
  const [tenantSearch, setTenantSearch] = useState("");

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
  const searchQ = tenantSearch.trim().toLowerCase();
  const filteredTenants = searchQ
    ? tenants.filter((t) => t.name.toLowerCase().includes(searchQ) || (t.city ?? "").toLowerCase().includes(searchQ))
    : tenants;
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 700 }}>Tüm Kurumlar</h2>
            <div className="field" style={{ minWidth: 220, margin: 0 }}>
              <input
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Kurum adı veya şehir ile ara…"
              />
            </div>
            <span className="hint">
              {tenants.length} kurum{searchQ ? ` (${filteredTenants.length} gösteriliyor)` : ""}
            </span>
          </div>
          <div className="grid cols-2">
            {filteredTenants.length === 0 && (
              <p style={{ color: "var(--ink-faint)", fontSize: "var(--text-sm)" }}>Aramayla eşleşen kurum bulunamadı.</p>
            )}
            {filteredTenants.map((t) => (
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

        <HqExamsPanel branches={branches} />

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
