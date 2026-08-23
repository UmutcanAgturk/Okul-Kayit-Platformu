import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BusRouteSummary } from '@/lib/types';

interface RosterRow { studentId: string; name: string; classroom: string | null; isMember: boolean; }

function RouteRoster({ routeId, onBack }: { routeId: string; onBack: () => void }) {
  const { data, loading, error, refetch } = useApiQuery<{ route: { name: string }; roster: RosterRow[] }>(`/api/branch/bus-routes/${routeId}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function toggle(studentId: string) {
    setBusyId(studentId);
    try { await api.post(`/api/branch/bus-routes/${routeId}/members`, { studentId }); await refetch(); } catch { /* */ } finally { setBusyId(null); }
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data?.roster ?? []} keyExtractor={(r) => r.studentId}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 4 }}><Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable><Label>{data?.route.name} — Öğrenciler</Label>{error && <ErrorBanner message={error} />}</View>}
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci yok." /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => toggle(item.studentId)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: busyId === item.studentId ? 0.5 : 1 }}>
            <View><Label>{item.name}</Label><MutedText>{item.classroom ?? ''}</MutedText></View>
            <Chip label={item.isMember ? 'Ekli' : 'Ekle'} tone={item.isMember ? 'success' : 'neutral'} selected={item.isMember} />
          </Card>
        </Pressable>
      )}
    />
  );
}

export default function BranchServisScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ routes: BusRouteSummary[] }>('/api/branch/bus-routes');
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <RouteRoster routeId={open} onBack={() => { setOpen(null); refetch(); }} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.routes ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Öğrenci yönetimi için güzergaha dokunun.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Servis yok." icon="bus-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpen(item.id)}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{item.name}</Label><MutedText>{item.memberCount}/{item.capacity}</MutedText>
            </View>
            {item.driverName ? <MutedText>Şoför: {item.driverName}</MutedText> : null}
          </Card>
        </Pressable>
      )}
    />
  );
}
