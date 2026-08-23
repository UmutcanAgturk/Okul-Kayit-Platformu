import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { ExamTicketRow } from '@/lib/types';

export default function SinavBelgesiScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<{ tickets: ExamTicketRow[] }>(
    studentId ? `/api/students/${studentId}/exam-tickets` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const tickets = data?.tickets ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Subtitle>Sınav Belgelerim</Subtitle>
      {tickets.length === 0 && <EmptyState message="Sınav belgeniz bulunamadı." />}
      {tickets.map((t) => (
        <Card key={t.examId} style={{ gap: 6 }}>
          <Label>{t.examName}</Label>
          <MutedText>{t.examType} · {new Date(t.examDate).toLocaleDateString('tr-TR')}</MutedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
            <MutedText>Öğrenci No: {t.studentNo}</MutedText>
            {t.bookletType ? <MutedText>Kitapçık: {t.bookletType}</MutedText> : null}
            {t.seatNo ? <MutedText>Sıra: {t.seatNo}</MutedText> : null}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
