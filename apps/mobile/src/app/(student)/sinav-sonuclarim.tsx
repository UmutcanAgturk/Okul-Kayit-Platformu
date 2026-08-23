import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';

interface ExamResultRow {
  examId: string;
  examName: string;
  examDate?: string;
  netScore: number;
  correctCount: number;
  wrongCount: number;
  emptyCount: number;
}
interface ExamResultsResponse {
  studentName: string;
  examHistory: ExamResultRow[];
}

export default function SinavSonuclarimScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<ExamResultsResponse>(
    studentId ? `/api/students/${studentId}/exam-results` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const rows = data?.examHistory ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Subtitle>Sınav Sonuçlarım</Subtitle>
      {rows.length === 0 && <EmptyState message="Henüz sınav sonucunuz yok." />}
      {rows.map((e) => (
        <Card key={e.examId} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{e.examName}</Label>
            <Label>Net {e.netScore}</Label>
          </View>
          {e.examDate && <MutedText>{new Date(e.examDate).toLocaleDateString('tr-TR')}</MutedText>}
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <MutedText>Doğru: {e.correctCount}</MutedText>
            <MutedText>Yanlış: {e.wrongCount}</MutedText>
            <MutedText>Boş: {e.emptyCount}</MutedText>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
