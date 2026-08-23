import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentAttendance } from '@/lib/types';

const STATUS_LABEL: Record<string, { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  VAR: { label: 'Var', tone: 'success' },
  GEC: { label: 'Geç', tone: 'warning' },
  IZINLI: { label: 'İzinli', tone: 'neutral' },
  YOK: { label: 'Yok', tone: 'critical' },
};

export default function DevamsizligimScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<StudentAttendance>(
    studentId ? `/api/students/${studentId}/attendance` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const s = data?.summary;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {s && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatTile icon="checkmark-circle" label="Toplam Gün" value={String(s.totalDays)} />
          <StatTile icon="close-circle" label="Devamsız" value={String(s.absentDays)} tone={s.absentDays > 0 ? 'critical' : 'success'} />
          <StatTile icon="time" label="Geç" value={String(s.lateDays)} tone="warning" />
        </View>
      )}
      <Subtitle>Kayıtlar</Subtitle>
      {(data?.records.length ?? 0) === 0 && <EmptyState message="Devamsızlık kaydı yok." />}
      {data?.records.map((r, i) => {
        const meta = STATUS_LABEL[r.status] ?? { label: r.status, tone: 'neutral' as const };
        return (
          <Card key={`${r.date}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Label>{new Date(r.date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</Label>
              {r.note ? <MutedText>{r.note}</MutedText> : null}
            </View>
            <Chip label={meta.label} tone={meta.tone} />
          </Card>
        );
      })}
    </ScrollView>
  );
}
