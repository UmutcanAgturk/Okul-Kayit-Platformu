import { FlatList, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { StaffMember } from '@/lib/types';

export default function PersonelScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ staff: StaffMember[] }>('/api/branch/staff');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.staff ?? []}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Personel bulunamadı." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            <Chip label={item.isActive ? 'Aktif' : 'Pasif'} tone={item.isActive ? 'success' : 'neutral'} />
          </View>
          <MutedText>{item.title}{item.department ? ` · ${item.department}` : ''}</MutedText>
          {item.phone ? <MutedText>{item.phone}</MutedText> : null}
        </Card>
      )}
    />
  );
}
