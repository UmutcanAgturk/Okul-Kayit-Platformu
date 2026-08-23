import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { AttendanceBranchSummary } from '@/lib/types';

export default function BranchDevamsizlikScreen() {
  const { data, loading, error } = useApiQuery<AttendanceBranchSummary>('/api/branch/attendance-summary');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="grid" label="Sınıf" value={String(data?.summary.classroomsTotal ?? 0)} />
        <StatTile icon="checkmark-circle" label="Bugün Alındı" value={String(data?.summary.takenTodayCount ?? 0)} tone="success" />
        <StatTile icon="close-circle" label="Ort. Devamsız" value={`%${Math.round(data?.summary.avgAbsentRate ?? 0)}`} tone="warning" />
      </View>
      <Subtitle>Sınıflar</Subtitle>
      {(data?.classrooms.length ?? 0) === 0 && <EmptyState message="Sınıf yok." />}
      {data?.classrooms.map((c) => (
        <Card key={c.classroomId} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{c.name}</Label>
            <Chip label={c.takenToday ? 'Bugün alındı' : 'Alınmadı'} tone={c.takenToday ? 'success' : 'warning'} />
          </View>
          <MutedText>{c.gradeLevel} · {c.studentCount} öğrenci · Devamsızlık %{Math.round(c.absentRate)}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
