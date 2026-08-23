import { FlatList } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { ActivityLogEntry } from '@/lib/types';

export default function AktiviteScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ entries: ActivityLogEntry[] }>('/api/branch/activity-log');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.entries ?? []}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Aktivite kaydı yok." icon="time-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <Label>{item.action}</Label>
          {item.detail ? <MutedText>{item.detail}</MutedText> : null}
          <MutedText>{item.actorLabel} · {new Date(item.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</MutedText>
        </Card>
      )}
    />
  );
}
