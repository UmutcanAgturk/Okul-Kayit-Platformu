import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface Row { userId: string; name: string; title: string; status: 'GELDI' | 'GELMEDI' | 'IZINLI'; date: string; }
interface Resp { staff: Row[]; presentCount: number; totalCount: number; }
const OPTS: { k: Row['status']; l: string; t: 'success' | 'critical' | 'neutral' }[] = [
  { k: 'GELDI', l: 'Geldi', t: 'success' }, { k: 'GELMEDI', l: 'Gelmedi', t: 'critical' }, { k: 'IZINLI', l: 'İzinli', t: 'neutral' },
];

export default function PersonelYoklamaScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<Resp>('/api/branch/staff-attendance');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function mark(userId: string, status: Row['status']) {
    setBusyId(userId); setErr(null);
    try { await api.post('/api/branch/staff-attendance', { userId, status }); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.staff ?? []} keyExtractor={(s) => s.userId}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
          <StatTile icon="people" label="Bugün Gelen" value={`${data?.presentCount ?? 0}/${data?.totalCount ?? 0}`} tone="success" />
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Personel yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8, opacity: busyId === item.userId ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label><MutedText>{item.title}</MutedText>
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {OPTS.map((o) => <Chip key={o.k} label={o.l} tone={o.t} selected={item.status === o.k} onPress={() => mark(item.userId, o.k)} />)}
          </View>
        </Card>
      )}
    />
  );
}
