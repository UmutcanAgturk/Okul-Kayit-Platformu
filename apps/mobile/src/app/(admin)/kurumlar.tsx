import { FlatList, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqTenant } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = { GENEL_MERKEZ: 'Genel Merkez', SUBE: 'Şube', BOLUM: 'Bölüm' };

export default function KurumlarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ tenants: HqTenant[] }>('/api/hq/tenants');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.tenants ?? []}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kurum bulunamadı." icon="business-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            <Chip label={TYPE_LABEL[item.type] ?? item.type} tone={item.type === 'SUBE' ? 'brand' : 'neutral'} />
          </View>
          <MutedText>{item.code}{item.city ? ` · ${item.city}` : ''}{item.district ? `/${item.district}` : ''}</MutedText>
          {item.phone ? <MutedText>{item.phone}</MutedText> : null}
        </Card>
      )}
    />
  );
}
