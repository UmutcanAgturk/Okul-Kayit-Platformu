import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqExam } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function HqOlcmeScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: HqExam[] }>('/api/hq/exams');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.exams ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <Label>{item.name}</Label>
          <MutedText>{new Date(item.examDate).toLocaleDateString('tr-TR')} · {item.branchCount} şube · {item.studentCount} öğrenci</MutedText>
          <MutedText>Optik: {item.opticFormCount} · Fatura: {tl(item.totalFee)}</MutedText>
        </Card>
      )}
    />
  );
}
