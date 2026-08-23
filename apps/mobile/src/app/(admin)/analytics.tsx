import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqAnalytics } from '@/lib/types';

export default function AnalyticsScreen() {
  const { data, loading, error } = useApiQuery<HqAnalytics>('/api/hq/analytics');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Analitik verisi yok." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="business" label="Şube" value={String(data.totalBranches)} />
        <StatTile icon="school" label="Öğrenci" value={String(data.totalStudents)} />
        <StatTile icon="stats-chart" label="Ort. Net" value={data.orgAvgNet != null ? String(Math.round(data.orgAvgNet * 10) / 10) : '—'} tone="brand" />
      </View>
      <Subtitle>En İyi Şubeler (Net)</Subtitle>
      {data.topBranches.map((b) => (
        <Card key={b.tenantId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Label>{b.tenantName}</Label><MutedText>{b.city ?? ''} · {b.studentCount} öğrenci</MutedText></View>
          <Label>{b.avgNet != null ? Math.round(b.avgNet * 10) / 10 : '—'}</Label>
        </Card>
      ))}
      <Subtitle>Ders Bazlı Başarı</Subtitle>
      {data.subjectPerformance.map((s) => (
        <Card key={s.subject} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>{s.subject}</Label><Label>%{Math.round(s.avgMasteryPct)}</Label>
        </Card>
      ))}
    </ScrollView>
  );
}
