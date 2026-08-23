import { FlatList, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherMenteeRow } from '@/lib/types';

export default function TeacherMentorlukScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ mentees: TeacherMenteeRow[] }>('/api/teacher/mentees');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.mentees ?? []}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Danışan öğrenciniz yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <Label>{item.name}</Label>
          <MutedText>{item.gradeLevel}{item.classroomName ? ` · ${item.classroomName}` : ''}</MutedText>
        </Card>
      )}
    />
  );
}
