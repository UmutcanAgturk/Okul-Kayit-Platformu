import { ScrollView, View } from 'react-native';
import { Button, Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { MentorRosterStudentRow, MentorRosterSummary } from '@/lib/types';

export default function BranchMentorScreen() {
  const { data, loading, error, refetch } = useApiQuery<{ summary: MentorRosterSummary; students: MentorRosterStudentRow[] }>('/api/branch/mentor-roster');
  const [busy, setBusy] = useState(false);
  async function autoAssign() {
    setBusy(true);
    try { await api.post('/api/branch/mentor-roster'); await refetch(); } catch { /* */ } finally { setBusy(false); }
  }
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="people" label="Mentör" value={String(data?.summary.mentorCount ?? 0)} />
        <StatTile icon="alert-circle" label="Atanmamış" value={String(data?.summary.unassignedCount ?? 0)} tone="warning" />
        <StatTile icon="mail" label="Bekleyen" value={String(data?.summary.pendingRequestCount ?? 0)} />
      </View>
      <Button title="Atanmamışları Otomatik Ata" onPress={autoAssign} loading={busy} />
      <Subtitle>Öğrenciler</Subtitle>
      {(data?.students.length ?? 0) === 0 && <EmptyState message="Öğrenci yok." />}
      {data?.students.map((s) => (
        <Card key={s.id} style={{ gap: 4 }}>
          <Label>{s.name}</Label>
          <MutedText>{s.gradeLevel}{s.classroomName ? ` · ${s.classroomName}` : ''}</MutedText>
          <MutedText>Mentör: {s.mentorName ?? 'Atanmamış'}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
