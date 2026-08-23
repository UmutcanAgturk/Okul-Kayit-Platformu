import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { Button, Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentClub } from '@/lib/types';

export default function KuluplerScreen() {
  const { studentId } = useStudentSelection();
  const qs = studentId ? `?studentId=${studentId}` : '';
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ clubs: StudentClub[] }>(`/api/clubs${qs}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function toggle(clubId: string) {
    setBusyId(clubId); setErr(null);
    try {
      await api.post(`/api/clubs/${clubId}/membership`, studentId ? { studentId } : {});
      await refetch();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'İşlem başarısız');
    } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.clubs ?? []}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kulüp bulunamadı." icon="star-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <Label>{item.name}</Label>
          {item.description ? <MutedText>{item.description}</MutedText> : null}
          <MutedText>{item.advisorName ? `Danışman: ${item.advisorName} · ` : ''}{item.memberCount} üye</MutedText>
          <Button
            title={item.isMember ? 'Üyelikten Ayrıl' : 'Üye Ol'}
            variant={item.isMember ? 'secondary' : 'primary'}
            loading={busyId === item.id}
            onPress={() => toggle(item.id)}
          />
        </Card>
      )}
    />
  );
}
