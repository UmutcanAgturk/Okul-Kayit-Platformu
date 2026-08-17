import { apiFetch } from "./client";

export type EnrollmentType = "ON_KAYIT" | "NORMAL_KAYIT";
export type EnrollmentStage = "ON_KAYIT_ALINDI" | "SOZLESME_BEKLENIYOR" | "ODEME_PLANI_OLUSTURULDU" | "KAYIT_TAMAMLANDI" | "IPTAL_EDILDI";

export const GRADE_LEVEL_LABEL: Record<string, string> = {
  ANASINIFI_3_YAS: "Anasınıfı (3 Yaş)",
  ANASINIFI_4_YAS: "Anasınıfı (4 Yaş)",
  ANASINIFI_5_YAS: "Anasınıfı (5 Yaş)",
  SINIF_1: "1. Sınıf",
  SINIF_2: "2. Sınıf",
  SINIF_3: "3. Sınıf",
  SINIF_4: "4. Sınıf",
  SINIF_5: "5. Sınıf",
  SINIF_6: "6. Sınıf",
  SINIF_7: "7. Sınıf",
  SINIF_8: "8. Sınıf",
  SINIF_9: "9. Sınıf",
  SINIF_10: "10. Sınıf",
  SINIF_11: "11. Sınıf",
  SINIF_12: "12. Sınıf",
  MEZUN: "Mezun",
};

export const STAGE_LABEL: Record<EnrollmentStage, string> = {
  ON_KAYIT_ALINDI: "Ön Kayıt Alındı",
  SOZLESME_BEKLENIYOR: "Sözleşme Bekleniyor",
  ODEME_PLANI_OLUSTURULDU: "Ödeme Planı Oluşturuldu",
  KAYIT_TAMAMLANDI: "Kayıt Tamamlandı",
  IPTAL_EDILDI: "İptal Edildi",
};

export const PROGRAM_TYPE_OPTIONS = ["Normal Kayıt", "Deneme Kulübü", "Yaz Kursu", "Kış Kursu"];

export interface EnrollmentRow {
  id: string;
  type: EnrollmentType;
  stage: EnrollmentStage;
  programType: string;
  candidateFullName: string;
  candidateGradeLevel: string;
  guardianFullName: string;
  guardianPhone: string;
  targetClassroomId: string | null;
  depositAmount: number | null;
  contractSignedAt: string | null;
  studentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchEnrollments(stage?: EnrollmentStage) {
  const qs = stage ? `?stage=${stage}` : "";
  return apiFetch<{ enrollments: EnrollmentRow[] }>(`/api/branch/enrollments${qs}`, { cache: "no-store" });
}

export interface CreateEnrollmentInput {
  type: EnrollmentType;
  programType?: string;
  candidateFullName: string;
  candidateGradeLevel: string;
  guardianFullName: string;
  guardianPhone: string;
  targetClassroomId?: string;
  depositAmount?: number;
}

export function createEnrollment(input: CreateEnrollmentInput) {
  return apiFetch<{ enrollment: EnrollmentRow }>("/api/branch/enrollments", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateEnrollmentInput {
  candidateFullName?: string;
  candidateGradeLevel?: string;
  guardianFullName?: string;
  guardianPhone?: string;
  targetClassroomId?: string | null;
  depositAmount?: number | null;
  programType?: string;
}

export function updateEnrollment(enrollmentId: string, input: UpdateEnrollmentInput) {
  return apiFetch<{ enrollment: EnrollmentRow }>(`/api/branch/enrollments/${enrollmentId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function cancelEnrollment(enrollmentId: string) {
  return apiFetch<{ enrollment: EnrollmentRow }>(`/api/branch/enrollments/${enrollmentId}`, { method: "DELETE" });
}

export type PaymentMethodChoice = "KREDI_KARTI" | "BANKA_HAVALESI" | "NAKIT" | "SENET";

export const GENDER_OPTIONS = ["Kadın", "Erkek"];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethodChoice, string> = {
  KREDI_KARTI: "Kredi Kartı (ParamPOS)",
  BANKA_HAVALESI: "Banka Havalesi",
  NAKIT: "Nakit",
  SENET: "Senet",
};

export interface CompleteEnrollmentInput {
  installmentCount: number;
  installmentAmount: number;
  firstDueDate: string;
  nationalId?: string;
  birthDate?: string;
  gender?: string;
  busRouteId?: string;
  phone?: string;
  targetClassroomId?: string;
  contractAccepted?: boolean;
  paymentMethodType?: PaymentMethodChoice;
  photoDataUrl?: string;
}

export interface CompleteEnrollmentResult {
  enrollment: EnrollmentRow;
  student: { id: string; studentNo: string; nationalId: string | null; birthDate: string | null; gender: string | null; busRouteId: string | null; photoDataUrl: string | null };
  installments: { id: string; installmentNo: number; amount: number; dueDate: string }[];
  promissoryNotes: { id: string; no: string; amount: number; dueDate: string }[];
  paymentMethod: { id: string; type: string } | null;
  credentials: { username: string; password: string };
  parentCredentials: { username: string; password: string } | null;
  parentLinkedExisting: boolean;
}

export function completeEnrollment(enrollmentId: string, input: CompleteEnrollmentInput) {
  return apiFetch<CompleteEnrollmentResult>(`/api/branch/enrollments/${enrollmentId}/complete`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export const enrollmentKeys = {
  list: () => ["enrollments", "list"] as const,
};
