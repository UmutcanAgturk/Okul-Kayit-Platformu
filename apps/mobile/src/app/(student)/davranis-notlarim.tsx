import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentDiscipline } from '@/lib/types';

export default function DavranisNotlarimScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<StudentDiscipline>(
    studentId ? `/api/students/${studentId}/discipline` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile
          icon="shield-checkmark"
          label="Net Puan"
          value={String(data?.netPoints ?? 0)}
          tone={(data?.netPoints ?? 0) < 0 ? 'critical' : 'success'}
        />
      </View>
      <Subtitle>Kayıtlar</Subtitle>
      {(data?.records.length ?? 0) === 0 && <EmptyState message="Davranış kaydı yok." />}
      {data?.records.map((r) => (
        <Card key={r.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{r.category}</Label>
            <Chip
              label={r.type === 'OLUMLU' ? `+${r.points}` : `${r.points}`}
              tone={r.type === 'OLUMLU' ? 'success' : 'critical'}
            />
          </View>
          {r.note ? <MutedText>{r.note}</MutedText> : null}
          <MutedText>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
