import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface VisitorSummary { id: string; visitorName: string; reason: string | null; hostName: string | null; phone: string | null; checkInAt: string; checkOutAt: string | null; }
const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function BranchZiyaretciScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ visitors: VisitorSummary[] }>('/api/branch/visitors');
  const [visitorName, setVisitorName] = useState('');
  const [reason, setReason] = useState('');
  const [hostName, setHostName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!visitorName.trim()) { setFormError('Ziyaretçi adı zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await api.post('/api/branch/visitors', { visitorName: visitorName.trim(), reason: reason.trim() || undefined, hostName: hostName.trim() || undefined });
      setVisitorName(''); setReason(''); setHostName(''); await refetch();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Kaydedilemedi.'); }
    finally { setSubmitting(false); }
  }
  async function checkout(id: string) {
    setBusyId(id);
    try { await api.patch(`/api/branch/visitors/${id}`); await refetch(); } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.visitors ?? []} keyExtractor={(v) => v.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Ziyaretçi</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Ziyaretçi Girişi</Label>
            <Field label="Ziyaretçi Adı" value={visitorName} onChangeText={setVisitorName} />
            <Field label="Sebep" value={reason} onChangeText={setReason} placeholder="Veli görüşmesi" />
            <Field label="Görüşülen Kişi" value={hostName} onChangeText={setHostName} />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Kaydediliyor…' : 'Girişi Kaydet'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Ziyaretçi kaydı yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.visitorName}</Label>
            <Chip label={item.checkOutAt ? 'Çıktı' : 'İçeride'} tone={item.checkOutAt ? 'neutral' : 'warning'} />
          </View>
          <MutedText>{item.reason ?? '—'}{item.hostName ? ` · ${item.hostName}` : ''}</MutedText>
          <MutedText>Giriş: {fmt(item.checkInAt)}{item.checkOutAt ? ` · Çıkış: ${fmt(item.checkOutAt)}` : ''}</MutedText>
          {!item.checkOutAt && <Button title="Çıkış Ver" variant="secondary" onPress={() => checkout(item.id)} loading={busyId === item.id} />}
        </Card>
      )}
    />
  );
}
