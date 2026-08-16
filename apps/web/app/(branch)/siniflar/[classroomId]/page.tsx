import { ClassroomDetailView } from "@/components/students-roster/ClassroomDetailView";

export default function Page({ params }: { params: { classroomId: string } }) {
  return <ClassroomDetailView classroomId={params.classroomId} />;
}
