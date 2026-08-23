import { FlatList } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherClub } from '@/lib/types';

export default function TeacherKuluplerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ clubs: TeacherClub[] }>('/api/teacher/clubs');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.clubs ?? []}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Danışmanı olduğunuz kulüp yok." icon="star-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <Label>{item.name}</Label>
          {item.description ? <MutedText>{item.description}</MutedText> : null}
          <MutedText>{item.memberCount} üye</MutedText>
        </Card>
      )}
    />
  );
}
