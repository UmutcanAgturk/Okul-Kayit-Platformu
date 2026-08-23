import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { CollectionRateRow } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function TahsilatOranlariScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ branches: CollectionRateRow[] }>('/api/hq/payment-installments/collection-rate');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.branches ?? []} keyExtractor={(b) => b.tenantId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Veri yok." icon="stats-chart-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.tenantName}</Label>
            <Chip label={item.collectionRate != null ? `%${Math.round(item.collectionRate)}` : '—'} tone={(item.collectionRate ?? 0) >= 70 ? 'success' : 'warning'} />
          </View>
          <MutedText>{item.city} · Tahsil: {tl(item.paidAmount)} · Bekleyen: {tl(item.pendingAmount)}</MutedText>
        </Card>
      )}
    />
  );
}
