import { ClassXRayHeatmap } from "@/components/teacher/class-xray/ClassXRayHeatmap";

interface PageProps {
  params: { examId: string };
  searchParams: { classroomId?: string };
}

export default function SinifRontgeniPage({ params, searchParams }: PageProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <ClassXRayHeatmap
        examId={params.examId}
        classroomId={searchParams.classroomId ?? "9-a"}
      />
    </main>
  );
}
