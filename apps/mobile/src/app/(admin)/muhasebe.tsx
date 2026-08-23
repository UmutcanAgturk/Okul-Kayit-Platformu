import { FlatList, RefreshControl, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText, StatTile } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqTenantSummary } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function HqMuhasebeScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    tenants: HqTenantSummary[];
    grandTotal: { totalGelir: number; totalGider: number; net: number };
  }>('/api/hq/accounting-ledger');

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          {error && <ErrorBanner message={error} />}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile icon="trending-up" label="Gelir" value={tl(data?.grandTotal.totalGelir ?? 0)} tone="success" />
            <StatTile icon="trending-down" label="Gider" value={tl(data?.grandTotal.totalGider ?? 0)} tone="critical" />
          </View>
          <StatTile icon="podium" label="Genel Net" value={tl(data?.grandTotal.net ?? 0)} tone="brand" />
          <Label>Kurum Bazlı Döküm</Label>
        </View>
      }
      data={data?.tenants ?? []}
      keyExtractor={(t) => t.tenantId}
      ListEmptyComponent={!loading ? <EmptyState message="Kayıt bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.tenantName}</Label>
            <Label>{tl(item.net)}</Label>
          </View>
          <MutedText>Gelir {tl(item.totalGelir)} · Gider {tl(item.totalGider)} · {item.entryCount} kayıt</MutedText>
        </Card>
      )}
    />
  );
}
