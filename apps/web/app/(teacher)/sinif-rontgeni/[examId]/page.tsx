import { ClassXRayHeatmap } from "@/components/teacher/class-xray/ClassXRayHeatmap";

interface PageProps {
  params: { examId: string };
  searchParams: { classroomId?: string };
}

export default function SinifRontgeniPage({ params, searchParams }: PageProps) {
  return (
    <>
    <ClassXRayHeatmap
      examId={params.examId}
      classroomId={searchParams.classroomId ?? "9-a"}
    />
    </>
  );
}
