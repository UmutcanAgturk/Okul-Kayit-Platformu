import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherFull } from '@/lib/types';

export default function OgretmenlerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ teachers: TeacherFull[] }>('/api/branch/teachers?full=true');
  const [busyId, setBusyId] = useState<string | null>(null);
  async function toggleMentor(id: string) {
    setBusyId(id);
    try { await api.post(`/api/branch/teachers/${id}/mentor`); await refetch(); } catch { /* */ } finally { setBusyId(null); }
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.teachers ?? []} keyExtractor={(t) => t.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Öğretmen yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8, opacity: busyId === item.id ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            {item.isMentor && <Chip label="Mentör" tone="success" />}
          </View>
          <MutedText>{item.branch}{item.title ? ` · ${item.title}` : ''}{item.phone ? ` · ${item.phone}` : ''}</MutedText>
          <Button title={item.isMentor ? 'Mentör Havuzundan Çıkar' : 'Mentör Havuzuna Ekle'} variant="secondary" onPress={() => toggleMentor(item.id)} loading={busyId === item.id} />
        </Card>
      )}
    />
  );
}
