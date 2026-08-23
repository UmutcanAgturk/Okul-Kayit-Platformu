import { FlatList, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchMapRow } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function SubeHaritasiScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ branches: BranchMapRow[] }>('/api/hq/branch-map');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.branches ?? []}
      keyExtractor={(b) => b.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Şube bulunamadı." icon="map-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            <Chip label={`Doluluk %${Math.round(item.occupancyPct)}`} tone={item.occupancyPct >= 80 ? 'success' : 'warning'} />
          </View>
          <MutedText>{item.city ?? ''}{item.district ? `/${item.district}` : ''} · {item.studentCount} öğrenci</MutedText>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <MutedText>Tahsilat %{Math.round(item.collectionPct)}</MutedText>
            <MutedText>Ciro {tl(item.revenue)}</MutedText>
          </View>
        </Card>
      )}
    />
  );
}
