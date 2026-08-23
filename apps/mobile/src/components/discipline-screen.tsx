import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchDisciplineRecord } from '@/lib/types';

export function DisciplineListScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ records: BranchDisciplineRecord[] }>('/api/branch/discipline');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.records ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Disiplin kaydı yok." icon="shield-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.studentName}</Label>
            <Chip label={item.type === 'OLUMLU' ? `+${item.points}` : `${item.points}`} tone={item.type === 'OLUMLU' ? 'success' : 'critical'} />
          </View>
          <MutedText>{item.category}</MutedText>
          {item.note ? <MutedText>{item.note}</MutedText> : null}
          <MutedText>{item.recordedByName} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</MutedText>
        </Card>
      )}
    />
  );
}
