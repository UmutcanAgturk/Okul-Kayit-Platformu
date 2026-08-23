import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { TodaySummary } from '@/lib/types';

export default function BugunScreen() {
  const { data, loading, error } = useApiQuery<TodaySummary>('/api/branch/today-summary');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Özet verisi yok." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="calendar" label="Yoklama" value={`${data.attendance.classroomsTakenToday}/${data.attendance.classroomsTotal}`} />
        <StatTile icon="alert-circle" label="Geciken Ödeme" value={String(data.payments.overdueCount)} tone={data.payments.overdueCount > 0 ? 'critical' : 'success'} />
        <StatTile icon="time" label="Yaklaşan Ödeme" value={String(data.payments.upcomingCount)} tone="warning" />
        <StatTile icon="chatbubbles" label="Bekleyen Görüşme" value={String(data.pta.pendingCount)} />
        <StatTile icon="book" label="Bekleyen Etüt" value={String(data.etut.pendingCount)} />
      </View>
      <Subtitle>Son Aktiviteler</Subtitle>
      {data.recentActivity.length === 0 && <MutedText>Aktivite yok.</MutedText>}
      {data.recentActivity.map((a) => (
        <Card key={a.id} style={{ gap: 4 }}>
          <Label>{a.action}</Label>
          {a.detail ? <MutedText>{a.detail}</MutedText> : null}
          <MutedText>{a.actorLabel} · {new Date(a.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
