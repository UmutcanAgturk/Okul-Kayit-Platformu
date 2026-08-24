import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface SchoolEventSummary { id: string; title: string; description: string | null; eventType: string | null; location: string | null; startAt: string; participantCount: number; }
const fmt = (iso: string) => new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function BranchEtkinliklerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ events: SchoolEventSummary[] }>('/api/branch/events');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [startAt, setStartAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setFormError('Başlık zorunludur.'); return; }
    const d = new Date(startAt.trim());
    if (Number.isNaN(d.getTime())) { setFormError('Geçerli tarih girin (2026-09-01T09:00).'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await api.post('/api/branch/events', { title: title.trim(), eventType: eventType.trim() || undefined, startAt: d.toISOString() });
      setTitle(''); setEventType(''); setStartAt(''); await refetch();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Oluşturulamadı.'); }
    finally { setSubmitting(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.events ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Sosyal Etkinlik</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Etkinlik</Label>
            <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Bahar Şenliği" />
            <Field label="Tür" value={eventType} onChangeText={setEventType} placeholder="Gezi / Tören" />
            <Field label="Başlangıç (ISO)" value={startAt} onChangeText={setStartAt} placeholder="2026-09-01T09:00" autoCapitalize="none" />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Oluşturuluyor…' : 'Etkinliği Oluştur'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Etkinlik yok." icon="sparkles-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.title}</Label>
            <Chip label={`${item.participantCount} katılım`} tone="neutral" />
          </View>
          <MutedText>{fmt(item.startAt)}{item.eventType ? ` · ${item.eventType}` : ''}</MutedText>
          {item.location ? <MutedText>Konum: {item.location}</MutedText> : null}
        </Card>
      )}
    />
  );
}
