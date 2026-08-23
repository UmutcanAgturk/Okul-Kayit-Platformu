import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { FinancialSummary } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function RaporlarScreen() {
  const { data, loading, error } = useApiQuery<FinancialSummary>('/api/branch/reports/financial-summary');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Rapor verisi yok." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Subtitle>Mali Özet</Subtitle>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile icon="trending-up" label="Gelir" value={tl(data.totalIncome)} tone="success" />
        <StatTile icon="trending-down" label="Gider" value={tl(data.totalExpense)} tone="critical" />
      </View>
      <StatTile icon="podium" label="Net Kâr" value={tl(data.netProfit)} tone="brand" />
      <Subtitle>Kategori Dökümü</Subtitle>
      {data.rows.length === 0 && <MutedText>Kayıt yok.</MutedText>}
      {data.rows.map((r, i) => (
        <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Label>{r.category}</Label><MutedText>{r.type === 'GELIR' ? 'Gelir' : 'Gider'}</MutedText></View>
          <Label>{tl(r.amount)}</Label>
        </Card>
      ))}
    </ScrollView>
  );
}
