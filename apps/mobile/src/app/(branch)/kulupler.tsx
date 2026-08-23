import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchClub } from '@/lib/types';

interface RosterRow { studentId: string; name: string; classroom: string | null; isMember: boolean; }

function ClubRoster({ clubId, onBack }: { clubId: string; onBack: () => void }) {
  const { data, loading, error, refetch } = useApiQuery<{ club: { name: string }; roster: RosterRow[] }>(`/api/branch/clubs/${clubId}`);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function toggle(studentId: string) {
    setBusyId(studentId);
    try { await api.post(`/api/branch/clubs/${clubId}/members`, { studentId }); await refetch(); } catch { /* */ } finally { setBusyId(null); }
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data?.roster ?? []} keyExtractor={(r) => r.studentId}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 4 }}><Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable><Label>{data?.club.name} — Üyeler</Label>{error && <ErrorBanner message={error} />}</View>}
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci yok." /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => toggle(item.studentId)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: busyId === item.studentId ? 0.5 : 1 }}>
            <View><Label>{item.name}</Label><MutedText>{item.classroom ?? ''}</MutedText></View>
            <Chip label={item.isMember ? 'Üye' : 'Ekle'} tone={item.isMember ? 'success' : 'neutral'} selected={item.isMember} />
          </Card>
        </Pressable>
      )}
    />
  );
}

export default function BranchKuluplerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ clubs: BranchClub[] }>('/api/branch/clubs');
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <ClubRoster clubId={open} onBack={() => { setOpen(null); refetch(); }} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.clubs ?? []} keyExtractor={(c) => c.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Üye yönetimi için kulübe dokunun.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Kulüp yok." icon="star-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpen(item.id)}>
          <Card style={{ gap: 4 }}>
            <Label>{item.name}</Label>
            {item.description ? <MutedText>{item.description}</MutedText> : null}
            <MutedText>{item.advisorName ? `Danışman: ${item.advisorName} · ` : ''}{item.memberCount} üye</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
