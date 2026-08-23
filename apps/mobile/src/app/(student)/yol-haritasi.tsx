import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentRoadmap } from '@/lib/types';

export default function YolHaritasiScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<StudentRoadmap>(
    studentId ? `/api/students/${studentId}/roadmap` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Yol haritası verisi yok." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="school" label="Sınıf" value={data.gradeLevel || '—'} />
        <StatTile icon="stats-chart" label="Net Oranı" value={`%${Math.round(data.netPct)}`} tone={data.netPct >= 60 ? 'success' : 'warning'} />
        <StatTile icon="document-text" label="Sınav" value={String(data.examCount)} />
      </View>

      {data.targetGoal ? (
        <Card style={{ gap: 4 }}>
          <Label>Hedef</Label>
          <MutedText>{data.targetGoal}</MutedText>
        </Card>
      ) : null}

      {data.latestNet != null && (
        <Card style={{ gap: 4 }}>
          <Label>Son Net</Label>
          <MutedText>{data.latestNet}{data.maxPossibleNet ? ` / ${data.maxPossibleNet}` : ''}</MutedText>
        </Card>
      )}

      <View style={{ gap: 8 }}>
        <Subtitle>Öncelikli Kazanımlar</Subtitle>
        {data.criticalAchievements.length === 0 && <MutedText>Kritik kazanım yok — tebrikler!</MutedText>}
        {data.criticalAchievements.map((a) => (
          <Card key={a.achievementId} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{a.subject}</Label>
              <Label>%{Math.round(a.avgRatio * 100)}</Label>
            </View>
            <MutedText>{a.label}</MutedText>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
