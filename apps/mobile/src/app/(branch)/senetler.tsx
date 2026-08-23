import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { PromissoryNoteRow } from '@/lib/types';

export default function SenetlerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ notes: PromissoryNoteRow[] }>('/api/branch/promissory-notes');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function markPaid(id: string) {
    setBusyId(id); setErr(null);
    try { await api.post(`/api/branch/promissory-notes/${id}/mark-paid`); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'İşlenemedi'); } finally { setBusyId(null); }
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.notes ?? []} keyExtractor={(n) => n.id}
      ListHeaderComponent={(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Senet yok." icon="document-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.debtorName}</Label>
            <Chip label={item.status === 'ODENDI' ? 'Ödendi' : 'Bekliyor'} tone={item.status === 'ODENDI' ? 'success' : 'warning'} />
          </View>
          <MutedText>No: {item.no} · Vade: {new Date(item.dueDate).toLocaleDateString('tr-TR')} · ₺{Math.round(parseFloat(item.amount)).toLocaleString('tr-TR')}</MutedText>
          {item.status !== 'ODENDI' && <Button title="Ödendi İşaretle" onPress={() => markPaid(item.id)} loading={busyId === item.id} />}
        </Card>
      )}
    />
  );
}
