import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherMenteeRow } from '@/lib/types';

interface ReqRow { id: string; studentName?: string; requestedAt: string; note: string | null; status: string; }
const S: Record<string, { l: string; t: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  BEKLIYOR: { l: 'Bekliyor', t: 'warning' }, ONAYLANDI: { l: 'Onaylandı', t: 'success' }, REDDEDILDI: { l: 'Reddedildi', t: 'critical' }, TAMAMLANDI: { l: 'Tamamlandı', t: 'neutral' },
};

export default function TeacherMentorlukScreen() {
  const mentees = useApiQuery<{ mentees: TeacherMenteeRow[] }>('/api/teacher/mentees');
  const reqs = useApiQuery<{ requests: ReqRow[] }>('/api/teacher/mentor-requests');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function respond(id: string, decision: 'APPROVE' | 'REJECT' | 'COMPLETE') {
    setBusyId(id); setErr(null);
    try { await api.post(`/api/teacher/mentor-requests/${id}/respond`, { decision }); await reqs.refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'İşlem başarısız'); } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={() => { mentees.refetch(); reqs.refetch(); }} refreshing={mentees.refreshing || reqs.refreshing}
      data={reqs.data?.requests ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {err ? <ErrorBanner message={err} /> : null}
          <Subtitle>Danışan Öğrencilerim</Subtitle>
          {(mentees.data?.mentees.length ?? 0) === 0 && <MutedText>Danışan yok.</MutedText>}
          {mentees.data?.mentees.map((m) => (
            <Card key={m.id} style={{ gap: 2 }}><Label>{m.name}</Label><MutedText>{m.gradeLevel}{m.classroomName ? ` · ${m.classroomName}` : ''}</MutedText></Card>
          ))}
          <Subtitle>Randevu Talepleri</Subtitle>
        </View>
      }
      ListEmptyComponent={<EmptyState message="Talep yok." icon="mail-outline" />}
      renderItem={({ item }) => {
        const m = S[item.status] ?? { l: item.status, t: 'neutral' as const };
        return (
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.studentName ?? 'Öğrenci'}</Label><Chip label={m.l} tone={m.t} />
            </View>
            {item.note ? <MutedText>{item.note}</MutedText> : null}
            <MutedText>{new Date(item.requestedAt).toLocaleDateString('tr-TR')}</MutedText>
            {item.status === 'BEKLIYOR' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Onayla" onPress={() => respond(item.id, 'APPROVE')} loading={busyId === item.id} />
                <Button title="Reddet" variant="danger" onPress={() => respond(item.id, 'REJECT')} loading={busyId === item.id} />
              </View>
            )}
            {item.status === 'ONAYLANDI' && (
              <Button title="Tamamlandı İşaretle" variant="secondary" onPress={() => respond(item.id, 'COMPLETE')} loading={busyId === item.id} />
            )}
          </Card>
        );
      }}
    />
  );
}
