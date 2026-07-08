import type { ClassXRayResponse } from "@/types/xray";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Assessment mikroservisinden sınıfın kazanım ısı haritasını getirir.
 * Next.js App Router route handler'ı (bkz. app/api/teacher/exams/[examId]/class-xray/route.ts)
 * üzerinden proxy'lenir; gerçek ortamda bu handler Assessment servisine (IRT motoru) yönlenir.
 */
export async function fetchClassXRay(
  examId: string,
  classroomId: string,
): Promise<ClassXRayResponse> {
  const res = await fetch(
    `/api/teacher/exams/${examId}/class-xray?classroomId=${classroomId}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new ApiError(res.status, `Sınıf röntgeni alınamadı (HTTP ${res.status})`);
  }

  return res.json();
}

export const examAnalyticsKeys = {
  classXRay: (examId: string, classroomId: string) =>
    ["teacher", "class-xray", examId, classroomId] as const,
};
