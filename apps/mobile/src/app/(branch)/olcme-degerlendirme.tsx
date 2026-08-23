import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchExam } from '@/lib/types';

export default function OlcmeScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: BranchExam[] }>('/api/branch/exams');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.exams ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label>
            <MutedText>{item.avgNet != null ? `Ort. ${item.avgNet}` : '—'}</MutedText>
          </View>
          <MutedText>{item.type} · {new Date(item.examDate).toLocaleDateString('tr-TR')}</MutedText>
          <MutedText>{item.questionCount} soru · {item.resultCount} sonuç</MutedText>
        </Card>
      )}
    />
  );
}
