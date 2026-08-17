import { Suspense } from "react";
import { HqDashboard } from "@/components/hq/HqDashboard";

export default function KurumlarPage() {
  return (
    <Suspense fallback={null}>
      <HqDashboard />
    </Suspense>
  );
}
