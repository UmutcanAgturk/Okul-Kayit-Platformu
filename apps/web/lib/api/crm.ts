import { apiFetch } from "./client";

export type CrmLeadStage = "ARANDI" | "GORUSULDU" | "DENEME_SINAVINA_GIRDI" | "KAYIT_OLDU";

export const CRM_STAGES: CrmLeadStage[] = ["ARANDI", "GORUSULDU", "DENEME_SINAVINA_GIRDI", "KAYIT_OLDU"];

export const CRM_STAGE_LABEL: Record<CrmLeadStage, string> = {
  ARANDI: "Arandı",
  GORUSULDU: "Görüşüldü",
  DENEME_SINAVINA_GIRDI: "Deneme Sınavına Girdi",
  KAYIT_OLDU: "Kayıt Oldu",
};

export interface CrmLead {
  id: string;
  candidateFullName: string;
  candidateGradeLevel: string;
  school: string | null;
  guardianFullName: string;
  guardianPhone: string;
  guardianEmail: string | null;
  notes: string | null;
  stage: CrmLeadStage;
  enrollmentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fetchCrmLeads() {
  return apiFetch<{ leads: CrmLead[] }>("/api/branch/crm-leads", { cache: "no-store" });
}

export interface CreateCrmLeadInput {
  candidateFullName: string;
  candidateGradeLevel: string;
  guardianFullName: string;
  guardianPhone: string;
  school?: string;
  guardianEmail?: string;
  notes?: string;
}

export function createCrmLead(input: CreateCrmLeadInput) {
  return apiFetch<{ lead: CrmLead }>("/api/branch/crm-leads", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface UpdateCrmLeadInput {
  candidateFullName?: string;
  guardianFullName?: string;
  guardianPhone?: string;
  school?: string | null;
  guardianEmail?: string | null;
  notes?: string | null;
  stage?: CrmLeadStage;
}

export function updateCrmLead(leadId: string, input: UpdateCrmLeadInput) {
  return apiFetch<{ lead: CrmLead }>(`/api/branch/crm-leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteCrmLead(leadId: string) {
  return apiFetch<{ ok: boolean }>(`/api/branch/crm-leads/${leadId}`, { method: "DELETE" });
}

export const crmKeys = {
  list: () => ["crm", "leads"] as const,
};
