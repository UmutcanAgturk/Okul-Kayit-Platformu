import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { DailyOps } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function GunlukOperasyonScreen() {
  const { data, loading, error } = useApiQuery<DailyOps>('/api/branch/daily-ops');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Veri yok." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="alert-circle" label="Geciken Toplam" value={tl(data.overdueTotal)} tone="critical" />
        <StatTile icon="book" label="Bugün Etüt" value={String(data.todayEtutTotal)} />
      </View>
      <Subtitle>Geciken Ödemeler</Subtitle>
      {data.overduePayments.length === 0 && <MutedText>Geciken ödeme yok.</MutedText>}
      {data.overduePayments.map((p) => (
        <Card key={p.installmentId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Label>{p.studentName}</Label><MutedText>{p.installmentNo}. taksit · {new Date(p.dueDate).toLocaleDateString('tr-TR')}</MutedText></View>
          <Label>{tl(p.amount)}</Label>
        </Card>
      ))}
      <Subtitle>Bugünkü Etütler</Subtitle>
      {data.todayEtut.length === 0 && <MutedText>Bugün etüt yok.</MutedText>}
      {data.todayEtut.map((e, i) => (
        <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>{e.subject}</Label><MutedText>{e.time} · {e.count} kişi</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
