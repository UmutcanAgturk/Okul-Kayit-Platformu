import { FlatList, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { InboxMessage } from '@/lib/types';

/** Gelen kutusu — oturumdaki kullanıcının mesajları (tüm roller ortak). */
export function InboxScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ messages: InboxMessage[] }>('/api/messages/inbox');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch}
      refreshing={refreshing}
      data={data?.messages ?? []}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Gelen kutunuz boş." icon="mail-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.title}</Label>
            {!item.readAt && <Chip label="Yeni" tone="brand" />}
          </View>
          <MutedText>{item.senderLabel} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</MutedText>
          <MutedText>{item.body}</MutedText>
        </Card>
      )}
    />
  );
}
