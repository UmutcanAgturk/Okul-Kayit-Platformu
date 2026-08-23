import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BusRouteSummary } from '@/lib/types';

export default function BranchServisScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ routes: BusRouteSummary[] }>('/api/branch/bus-routes');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.routes ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Servis güzergahı yok." icon="bus-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label>
            <MutedText>{item.memberCount}/{item.capacity}</MutedText>
          </View>
          {item.driverName ? <MutedText>Şoför: {item.driverName}{item.driverPhone ? ` · ${item.driverPhone}` : ''}</MutedText> : null}
          {item.stops.length > 0 ? <MutedText>Duraklar: {item.stops.join(', ')}</MutedText> : null}
        </Card>
      )}
    />
  );
}
