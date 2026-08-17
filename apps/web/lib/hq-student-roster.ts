import { useQuery } from "@tanstack/react-query";
import { fetchBranchStudents } from "@/lib/api/students-roster";

/**
 * Devamsızlığım/Davranış Notlarım/Sınav Sonuçlarım gibi "hangi öğrenci"
 * ye bağlı self-servis ekranlarda, Genel Merkez'in (HqBranchSelector ile
 * şube seçtikten sonra) o şubenin TÜM öğrencilerini, PARENT'in kendi
 * çocukları listesiyle (`me.students`) AYNI {studentId, fullName} şeklinde
 * döner — böylece her ekranın zaten sahip olduğu çoklu-öğrenci switcher
 * UI'si (bkz. StudentAttendanceView.tsx) hiç değişmeden HQ modunda da çalışır.
 * Backend tarafında ek bir yetki değişikliği GEREKMEZ: `/api/students/[id]/...`
 * route'ları SUPERADMIN'i zaten unconditionally kabul ediyor (RLS bypass).
 */
export function useHqStudentRoster(enabled: boolean) {
  const query = useQuery({ queryKey: ["hq", "branch-students-roster"], queryFn: fetchBranchStudents, enabled });
  return (query.data?.students ?? []).map((s) => ({ studentId: s.id, fullName: s.name }));
}
