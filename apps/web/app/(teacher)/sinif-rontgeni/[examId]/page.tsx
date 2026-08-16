import { ClassXRayHeatmap } from "@/components/teacher/class-xray/ClassXRayHeatmap";

interface PageProps {
  params: { examId: string };
  searchParams: { classroomId?: string };
}

export default function SinifRontgeniPage({ params, searchParams }: PageProps) {
  if (!searchParams.classroomId) {
    return (
      <div className="screen">
        <div className="card card-pad" style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
            Sınıf belirtilmedi. Bu sayfayı Ölçme-Değerlendirme &gt; Sonuç Girişi sekmesinden bir sınav ve sınıf
            seçtikten sonra açın.
          </p>
        </div>
      </div>
    );
  }

  return <ClassXRayHeatmap examId={params.examId} classroomId={searchParams.classroomId} />;
}
