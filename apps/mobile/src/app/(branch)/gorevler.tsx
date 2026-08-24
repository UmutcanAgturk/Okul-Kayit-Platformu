import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface TaskSummary { id: string; title: string; priority: string; status: string; dueDate: string | null; requiresApproval: boolean; }
const PRI: Record<string, string> = { LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek' };
const ST: Record<string, string> = { OPEN: 'Açık', IN_PROGRESS: 'Devam', DONE: 'Tamam', CANCELLED: 'İptal' };
const TONE: Record<string, 'neutral' | 'warning' | 'success'> = { OPEN: 'neutral', IN_PROGRESS: 'warning', DONE: 'success', CANCELLED: 'neutral' };

export default function BranchGorevlerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ tasks: TaskSummary[] }>('/api/branch/tasks');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  async function submit() {
    if (!title.trim()) { setFormError('Başlık zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try { await api.post('/api/branch/tasks', { title: title.trim() }); setTitle(''); await refetch(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Oluşturulamadı.'); } finally { setSubmitting(false); }
  }
  async function advance(id: string, status: string) { setBusyId(id); try { await api.patch(`/api/branch/tasks/${id}`, { status }); await refetch(); } finally { setBusyId(null); } }
  return (
    <FlatList contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing} data={data?.tasks ?? []} keyExtractor={(t) => t.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><Title>Görevler & Onaylar</Title>{error && <ErrorBanner message={error} />}
        <Card style={{ gap: 10 }}><Label>Yeni Görev</Label>
          <Field label="Başlık" value={title} onChangeText={setTitle} />
          {formError && <ErrorBanner message={formError} />}
          <Button title={submitting ? 'Oluşturuluyor…' : 'Görevi Oluştur'} onPress={submit} loading={submitting} /></Card></View>}
      ListEmptyComponent={!loading ? <EmptyState message="Görev yok." icon="checkbox-outline" /> : null}
      renderItem={({ item }) => (<Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>{item.title}</Label><Chip label={ST[item.status]} tone={TONE[item.status]} /></View>
        <MutedText>Öncelik: {PRI[item.priority]}{item.dueDate ? ` · Vade: ${new Date(item.dueDate).toLocaleDateString('tr-TR')}` : ''}{item.requiresApproval ? ' · Onaylı' : ''}</MutedText>
        {item.status !== 'DONE' && item.status !== 'CANCELLED' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {item.status === 'OPEN' && <Button title="Başlat" variant="secondary" onPress={() => advance(item.id, 'IN_PROGRESS')} loading={busyId === item.id} />}
            <Button title="Tamamla" onPress={() => advance(item.id, 'DONE')} loading={busyId === item.id} />
          </View>
        )}</Card>)}
    />
  );
}
