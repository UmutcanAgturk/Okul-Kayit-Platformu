import { FlatList, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { EtutSessionRow } from '@/lib/types';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  AI_SUGGESTED: { label: 'AI Önerisi', tone: 'neutral' },
  TEACHER_APPROVED: { label: 'Onaylandı', tone: 'success' },
  TEACHER_REJECTED: { label: 'Reddedildi', tone: 'critical' },
  COMPLETED: { label: 'Tamamlandı', tone: 'success' },
  CANCELLED: { label: 'İptal', tone: 'neutral' },
};

export default function EtutRandevularimScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ sessions: EtutSessionRow[] }>(
    studentId ? `/api/students/${studentId}/study-sessions` : null,
  );
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch}
      refreshing={refreshing}
      data={data?.sessions ?? []}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Etüt randevunuz yok." icon="book-outline" /> : null}
      renderItem={({ item }) => {
        const m = STATUS[item.status] ?? { label: item.status, tone: 'neutral' as const };
        return (
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.achievement?.label ?? 'Etüt'}</Label>
              <Chip label={m.label} tone={m.tone} />
            </View>
            <MutedText>{item.teacherName}</MutedText>
            <MutedText>{new Date(item.scheduledStart).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</MutedText>
          </Card>
        );
      }}
    />
  );
}
