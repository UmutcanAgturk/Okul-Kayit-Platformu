import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { AchievementSummaryRow } from '@/lib/types';

export function AchievementSummaryScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ achievements: AchievementSummaryRow[] }>('/api/branch/exams/achievement-summary');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.achievements ?? []} keyExtractor={(a) => a.achievementId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Tüm sınavlarda kazanım bazlı ortalama başarı.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Veri yok." icon="analytics-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.subject}</Label><Label>%{Math.round(item.avgMasteryPct)}</Label>
          </View>
          <MutedText>{item.label} · {item.count} sonuç</MutedText>
        </Card>
      )}
    />
  );
}
