"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authKeys, fetchMe } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { fetchExamTickets, type ExamTicketRow } from "@/lib/api/exam-tickets";
import { Icon } from "@/components/ui/icons";
import { QrCode } from "./QrCode";

const ALLOWED_ROLES = ["STUDENT", "PARENT"];

const EXAM_TYPE_LABEL: Record<ExamTicketRow["examType"], string> = {
  DENEME: "Deneme Sınavı",
  YAZILI: "Yazılı Sınav",
  VIP_OLCME: "VIP Ölçme",
};

function ticketQrValue(t: ExamTicketRow) {
  return JSON.stringify({
    studentNo: t.studentNo,
    examId: t.examId,
    seat: t.seatingRoomId && t.seatNo ? `${t.seatingRoomId}-${t.seatNo}` : null,
  });
}

/**
 * QR Sınav Belgesi — demo/seviye360-app.html'deki "student:ticket" ekranının
 * gerçek karşılığı (bkz. app/api/students/[studentId]/exam-tickets).
 */
export function ExamTicketsView() {
  const router = useRouter();

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const students = me?.students ?? [];
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedStudentId && students.length > 0) setSelectedStudentId(students[0].studentId);
  }, [students, selectedStudentId]);

  const ticketsQuery = useQuery({
    queryKey: ["exam-tickets", selectedStudentId],
    queryFn: () => fetchExamTickets(selectedStudentId!),
    enabled: !!selectedStudentId,
  });

  if (isLoading) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>;
  }
  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null;
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return (
      <div className="card card-pad">
        <p style={{ margin: 0, fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--critical)" }}>
          Bu modüle erişim yetkiniz yok. QR Sınav Belgesi yalnızca Öğrenci/Veli rolüne açıktır.
        </p>
      </div>
    );
  }

  const tickets = ticketsQuery.data?.tickets ?? [];

  return (
    <div className="screen">
      <h1>QR Sınav Belgesi</h1>
      <p className="lede">Girdiğiniz sınavlar için kimlik/salon belgesi — sınav girişinde gösterilir.</p>

      {students.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() => setSelectedStudentId(s.studentId)}
              className={`btn sm ${selectedStudentId === s.studentId ? "primary" : ""}`}
            >
              {s.fullName}
            </button>
          ))}
        </div>
      )}

      {ticketsQuery.isLoading ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}>Yükleniyor…</p>
      ) : tickets.length === 0 ? (
        <div className="card card-pad">
          <div className="empty-state">
            <Icon name="qr" />
            <p>Henüz girilmiş bir sınav yok.</p>
          </div>
        </div>
      ) : (
        <div className="grid cols-2">
          {tickets.map((t) => (
            <div key={t.examId} className="card card-pad" style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <QrCode value={ticketQrValue(t)} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{t.examName}</div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-faint)", marginBottom: 6 }}>
                  {EXAM_TYPE_LABEL[t.examType]} · {new Date(t.examDate).toLocaleDateString("tr-TR")}
                </div>
                <div style={{ fontSize: "var(--text-sm)" }}>{t.studentName} · {t.studentNo}</div>
                <div style={{ fontSize: "var(--text-sm)", color: "var(--ink-muted)", marginTop: 4 }}>
                  {t.seatingRoomId && t.seatNo ? (
                    <>Salon {t.seatingRoomId} · Koltuk {t.seatNo}{t.bookletType ? ` · Kitapçık ${t.bookletType}` : ""}</>
                  ) : (
                    <span className="chip neutral">Salon/koltuk henüz atanmadı</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
