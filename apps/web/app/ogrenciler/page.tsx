import { Suspense } from "react";
import { StudentsRosterDashboard } from "@/components/students-roster/StudentsRosterDashboard";

export default function OgrencilerPage() {
  return (
    <Suspense fallback={null}>
      <StudentsRosterDashboard />
    </Suspense>
  );
}
