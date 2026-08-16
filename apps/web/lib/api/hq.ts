import { apiFetch } from "./client";

export interface HqTenant {
  id: string;
  name: string;
  code: string;
  type: "GENEL_MERKEZ" | "SUBE" | "BOLUM";
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  capacity: number | null;
  taxNo: string | null;
  kurumTuru: string | null;
  openingDate: string | null;
  isActive: boolean;
  studentCount: number;
  classroomCount: number;
  staffCount: number;
  teacherCount: number;
  branchAdminName: string | null;
  branchAdminPhone: string | null;
}

// demo/seviye360-app.html'deki KURUM_TURU_OPTIONS listesiyle birebir aynı.
export const KURUM_TURU_OPTIONS = ["Anaokulu", "İlkokul", "Ortaokul", "Anadolu Lisesi", "Fen Lisesi", "Kurs Merkezi", "VIP Eğitim Merkezi"];

export function fetchHqTenants() {
  return apiFetch<{ tenants: HqTenant[] }>("/api/hq/tenants", { cache: "no-store" });
}

export function createTenant(input: {
  name: string;
  city: string;
  district: string;
  managerFirstName: string;
  managerLastName: string;
  address?: string;
  phone?: string;
  email?: string;
  capacity?: number;
  taxNo?: string;
  kurumTuru?: string;
  openingDate?: string;
  managerPhone?: string;
}) {
  return apiFetch<{ tenant: HqTenant; credentials: { username: string; password: string } }>("/api/hq/tenants", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTenant(
  tenantId: string,
  input: Partial<{
    name: string;
    city: string;
    district: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    capacity: number | null;
    taxNo: string | null;
    kurumTuru: string | null;
    openingDate: string | null;
    managerFirstName: string;
    managerLastName: string;
    managerPhone: string | null;
  }>,
) {
  return apiFetch<{ tenant: HqTenant; branchAdminName?: string; branchAdminPhone?: string | null }>(`/api/hq/tenants/${tenantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTenant(tenantId: string) {
  return apiFetch<{ ok: true }>(`/api/hq/tenants/${tenantId}`, { method: "DELETE" });
}

export function resetTenantCredentials(tenantId: string) {
  return apiFetch<{ credentials: { username: string; password: string } }>(`/api/hq/tenants/${tenantId}/reset-credentials`, {
    method: "POST",
  });
}

export function toggleTenantActive(tenantId: string) {
  return apiFetch<{ isActive: boolean }>(`/api/hq/tenants/${tenantId}/toggle-active`, { method: "POST" });
}

export interface HqLedgerSummaryRow {
  tenantId: string;
  tenantName: string;
  tenantCode: string;
  entryCount: number;
  totalGelir: number;
  totalGider: number;
  net: number;
}

export interface HqLedgerSummary {
  tenants: HqLedgerSummaryRow[];
  grandTotal: { totalGelir: number; totalGider: number; net: number };
}

export function fetchHqAccountingSummary() {
  return apiFetch<HqLedgerSummary>("/api/hq/accounting-ledger", { cache: "no-store" });
}

export interface HqStudentRow {
  id: string;
  studentNo: string;
  name: string;
  tenantId: string;
  tenantName: string;
  gradeLevel: string;
  classroomId: string | null;
  classroomName: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  avgNet: number | null;
}

export interface HqStudentsResponse {
  summary: {
    totalStudents: number;
    branchCount: number;
    busiestBranch: { name: string; count: number } | null;
    unassignedCount: number;
  };
  students: HqStudentRow[];
}

export function fetchHqStudents(params?: { q?: string; tenantId?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.tenantId) search.set("tenantId", params.tenantId);
  const qs = search.toString();
  return apiFetch<HqStudentsResponse>(`/api/hq/students${qs ? `?${qs}` : ""}`, { cache: "no-store" });
}

export interface HqExam {
  id: string;
  name: string;
  examDate: string;
  bookletTypes: string[];
  eligibleGradeLevels: string[];
  feePerStudent: number | null;
  studentCount: number;
  opticFormCount: number;
  totalFee: number;
}

export function fetchHqExams() {
  return apiFetch<{ exams: HqExam[] }>("/api/hq/exams", { cache: "no-store" });
}

export interface CreateHqExamInput {
  name: string;
  examDate: string;
  bookletCount: 2 | 4;
  feePerStudent?: number;
  eligibleGradeLevels: string[];
}

export function createHqExam(input: CreateHqExamInput) {
  return apiFetch<{ exam: HqExam; studentCount: number; opticFormCount: number; totalFee: number }>("/api/hq/exams", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface HqAnalyticsBranchNet {
  tenantId: string;
  tenantName: string;
  city: string | null;
  avgNet: number | null;
  studentCount: number;
}

export interface HqAnalyticsSubject {
  subject: string;
  avgMasteryPct: number;
  count: number;
}

export interface HqAnalyticsBranchRevenue {
  tenantId: string;
  tenantName: string;
  city: string | null;
  totalGelir: number;
}

export interface HqAnalytics {
  totalBranches: number;
  totalStudents: number;
  orgAvgNet: number | null;
  topBranches: HqAnalyticsBranchNet[];
  subjectPerformance: HqAnalyticsSubject[];
  branchRevenue: HqAnalyticsBranchRevenue[];
}

export function fetchHqAnalytics() {
  return apiFetch<HqAnalytics>("/api/hq/analytics", { cache: "no-store" });
}

export interface HqExamBranchBreakdownRow {
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  studentCount: number;
  totalFee: number;
}

export function fetchHqExamBranchBreakdown(examId: string) {
  return apiFetch<{ exam: { id: string; name: string; examDate: string; feePerStudent: number | null }; branches: HqExamBranchBreakdownRow[] }>(
    `/api/hq/exams/${examId}/branch-breakdown`,
    { cache: "no-store" },
  );
}

export function setActingTenant(tenantId: string) {
  return apiFetch<{ tenantId: string; tenantName: string }>("/api/hq/acting-tenant", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
}

export function clearActingTenant() {
  return apiFetch<{ ok: true }>("/api/hq/acting-tenant", { method: "DELETE" });
}

export const hqKeys = {
  tenants: () => ["hq", "tenants"] as const,
  accountingSummary: () => ["hq", "accounting-summary"] as const,
  students: (q: string, tenantId: string) => ["hq", "students", q, tenantId] as const,
  exams: () => ["hq", "exams"] as const,
  analytics: () => ["hq", "analytics"] as const,
};
