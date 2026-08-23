import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchExamComparisonRow } from '@/lib/types';

export default function SinavKarsilastirmaScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ branches: BranchExamComparisonRow[] }>('/api/hq/exams/branch-comparison');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.branches ?? []} keyExtractor={(b) => b.tenantId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Şubelerin sınav ortalamaları.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Veri yok." icon="bar-chart-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.tenantName}</Label>
            <Label>{item.avgNet != null ? `Net ${Math.round(item.avgNet * 10) / 10}` : '—'}</Label>
          </View>
          <MutedText>{item.city} · {item.examTakers} katılımcı{item.avgKatilim != null ? ` · %${Math.round(item.avgKatilim)} katılım` : ''}</MutedText>
        </Card>
      )}
    />
  );
}
