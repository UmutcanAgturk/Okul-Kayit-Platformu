import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchStudySessionRow } from '@/lib/types';

const S: Record<string, { l: string; t: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  AI_SUGGESTED: { l: 'AI Önerisi', t: 'neutral' }, TEACHER_APPROVED: { l: 'Onaylandı', t: 'success' },
  TEACHER_REJECTED: { l: 'Reddedildi', t: 'critical' }, COMPLETED: { l: 'Tamamlandı', t: 'success' }, CANCELLED: { l: 'İptal', t: 'neutral' },
};

export default function BranchEtutScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ sessions: BranchStudySessionRow[] }>('/api/branch/study-sessions');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.sessions ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Etüt seansı yok." icon="book-outline" /> : null}
      renderItem={({ item }) => {
        const m = S[item.status] ?? { l: item.status, t: 'neutral' as const };
        return (
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.studentName}</Label><Chip label={m.l} tone={m.t} />
            </View>
            <MutedText>{item.achievement?.label ?? 'Etüt'} · {item.teacherName}</MutedText>
            <MutedText>{new Date(item.scheduledStart).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</MutedText>
          </Card>
        );
      }}
    />
  );
}
