import { FlatList, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { QuizAttemptRow } from '@/lib/types';

export default function QuizScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ attempts: QuizAttemptRow[] }>(
    studentId ? `/api/students/${studentId}/quiz-attempts` : null,
  );
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch}
      refreshing={refreshing}
      data={data?.attempts ?? []}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Henüz quiz denemeniz yok." icon="help-circle-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.subject}</Label>
            <Label>{item.correctCount}/{item.totalCount}</Label>
          </View>
          {item.achievementLabel ? <MutedText>{item.achievementLabel}</MutedText> : null}
          <MutedText>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</MutedText>
        </Card>
      )}
    />
  );
}
