import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentPtaRequest } from '@/lib/types';

const S: Record<string, { l: string; t: 'success' | 'warning' | 'critical' }> = {
  BEKLIYOR: { l: 'Bekliyor', t: 'warning' }, ONAYLANDI: { l: 'Onaylandı', t: 'success' }, REDDEDILDI: { l: 'Reddedildi', t: 'critical' },
};

export default function StudentVeliGorusmeScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ requests: StudentPtaRequest[] }>(studentId ? `/api/students/${studentId}/pta-requests` : null);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.requests ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Görüşme talebiniz yok." icon="chatbubbles-outline" /> : null}
      renderItem={({ item }) => {
        const m = S[item.status] ?? { l: item.status, t: 'warning' as const };
        return (
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.teacherName}</Label><Chip label={m.l} tone={m.t} />
            </View>
            {item.topic ? <MutedText>{item.topic}</MutedText> : null}
            <MutedText>{new Date(item.requestedAt).toLocaleDateString('tr-TR')}</MutedText>
          </Card>
        );
      }}
    />
  );
}
