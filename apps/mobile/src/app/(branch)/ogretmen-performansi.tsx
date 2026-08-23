import { FlatList, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherPerformanceRow } from '@/lib/types';

export default function OgretmenPerformansiScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ teachers: TeacherPerformanceRow[] }>('/api/branch/teacher-performance');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.teachers ?? []}
      keyExtractor={(t) => t.teacherId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Veri bulunamadı." icon="stats-chart-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label>
            <Label>{item.avgMasteryPct != null ? `%${Math.round(item.avgMasteryPct)}` : '—'}</Label>
          </View>
          <MutedText>{item.title ?? 'Öğretmen'} · {item.rosterSize} öğrenci · {item.resultCount} sonuç</MutedText>
        </Card>
      )}
    />
  );
}
