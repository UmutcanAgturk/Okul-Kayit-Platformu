import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Title } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';

interface MenuPlanSummary { id: string; date: string; mealType: string | null; gradeLevels: string[]; items: string[]; expectedParticipation: number | null; published: boolean; }
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

export default function BranchYemekhaneScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ plans: MenuPlanSummary[] }>('/api/branch/meal/plans');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.plans ?? []} keyExtractor={(p) => p.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><Title>Yemekhane</Title>{error && <ErrorBanner message={error} />}<MutedText>Günlük menü planı.</MutedText></View>}
      ListEmptyComponent={!loading ? <EmptyState message="Menü planı yok." icon="restaurant-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{fmtDate(item.date)}</Label>
            {item.mealType ? <Chip label={item.mealType} tone="brand" /> : null}
          </View>
          <MutedText>{item.items.join(', ') || '—'}</MutedText>
          {item.gradeLevels.length ? <MutedText>Seviyeler: {item.gradeLevels.join(', ')}</MutedText> : null}
          {item.expectedParticipation != null ? <MutedText>Öngörülen katılım: ~{item.expectedParticipation}</MutedText> : null}
        </Card>
      )}
    />
  );
}
