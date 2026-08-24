import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface CalendarEventSummary {
  id: string;
  title: string;
  eventType: string | null;
  location: string | null;
  description: string | null;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
}

function formatDate(iso: string, allDay: boolean) {
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(allDay ? {} : { hour: '2-digit', minute: '2-digit' }),
  });
}

export default function BranchTakvimScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ events: CalendarEventSummary[] }>('/api/branch/calendar');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setFormError('Başlık zorunludur.');
      return;
    }
    if (!startAt.trim()) {
      setFormError('Başlangıç tarihi (ISO) zorunludur.');
      return;
    }
    const parsed = new Date(startAt.trim());
    if (Number.isNaN(parsed.getTime())) {
      setFormError('Geçerli bir tarih girin (örn. 2026-09-01T09:00).');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post('/api/branch/calendar', {
        title: title.trim(),
        eventType: eventType.trim() || undefined,
        location: location.trim() || undefined,
        startAt: parsed.toISOString(),
      });
      setTitle('');
      setEventType('');
      setLocation('');
      setStartAt('');
      await refetch();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Etkinlik oluşturulamadı.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch}
      refreshing={refreshing}
      data={data?.events ?? []}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Takvim</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Etkinlik</Label>
            <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Örn. Veli Toplantısı" />
            <Field label="Tür (opsiyonel)" value={eventType} onChangeText={setEventType} placeholder="Örn. Toplantı" />
            <Field label="Konum (opsiyonel)" value={location} onChangeText={setLocation} placeholder="Örn. Konferans Salonu" />
            <Field
              label="Başlangıç (ISO)"
              value={startAt}
              onChangeText={setStartAt}
              placeholder="2026-09-01T09:00"
              autoCapitalize="none"
            />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Oluşturuluyor…' : 'Etkinliği Oluştur'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Etkinlik yok." icon="calendar-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.title}</Label>
            {item.eventType ? <MutedText>{item.eventType}</MutedText> : null}
          </View>
          <MutedText>
            {formatDate(item.startAt, item.allDay)}
            {item.endAt ? ` → ${formatDate(item.endAt, item.allDay)}` : ''}
          </MutedText>
          {item.location ? <MutedText>Konum: {item.location}</MutedText> : null}
          {item.description ? <MutedText>{item.description}</MutedText> : null}
        </Card>
      )}
    />
  );
}
