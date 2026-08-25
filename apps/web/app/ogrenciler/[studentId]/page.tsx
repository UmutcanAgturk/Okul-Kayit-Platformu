import { Suspense } from "react";
import { StudentDetailView } from "@/components/students-roster/StudentDetailView";

export default function StudentDetailPage({ params }: { params: { studentId: string } }) {
  return (
    <Suspense fallback={null}>
      <StudentDetailView studentId={params.studentId} />
    </Suspense>
  );
}
