import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherPtaRequest } from '@/lib/types';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'critical' }> = {
  BEKLIYOR: { label: 'Bekliyor', tone: 'warning' },
  ONAYLANDI: { label: 'Onaylandı', tone: 'success' },
  REDDEDILDI: { label: 'Reddedildi', tone: 'critical' },
};

export default function TeacherVeliGorusmeScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ requests: TeacherPtaRequest[] }>('/api/teacher/pta-requests');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(id: string, decision: 'APPROVE' | 'REJECT') {
    setBusyId(id); setActionError(null);
    try {
      await api.post(`/api/teacher/pta-requests/${id}/respond`, { decision });
      await refetch();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'İşlem başarısız');
    } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.requests ?? []}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={(error || actionError) ? <ErrorBanner message={error ?? actionError ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Görüşme talebi yok." /> : null}
      renderItem={({ item }) => {
        const m = STATUS[item.status] ?? { label: item.status, tone: 'warning' as const };
        return (
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.studentName}</Label>
              <Chip label={m.label} tone={m.tone} />
            </View>
            {item.topic ? <MutedText>{item.topic}</MutedText> : null}
            <MutedText>{new Date(item.requestedAt).toLocaleDateString('tr-TR')}</MutedText>
            {item.status === 'BEKLIYOR' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Onayla" onPress={() => respond(item.id, 'APPROVE')} loading={busyId === item.id} />
                <Button title="Reddet" variant="danger" onPress={() => respond(item.id, 'REJECT')} loading={busyId === item.id} />
              </View>
            )}
          </Card>
        );
      }}
    />
  );
}
