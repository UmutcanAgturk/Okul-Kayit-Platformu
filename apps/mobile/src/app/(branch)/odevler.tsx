import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface AssignmentSummary { id: string; title: string; description: string | null; startDate: string | null; dueDate: string | null; submissionCount: number; }
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—');

export default function BranchOdevlerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ assignments: AssignmentSummary[] }>('/api/branch/assignments');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) { setFormError('Başlık zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      const due = dueDate.trim() ? new Date(dueDate.trim()) : null;
      await api.post('/api/branch/assignments', { title: title.trim(), dueDate: due && !Number.isNaN(due.getTime()) ? due.toISOString() : undefined });
      setTitle(''); setDueDate(''); await refetch();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Oluşturulamadı.'); }
    finally { setSubmitting(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.assignments ?? []} keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Ödevler</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Ödev</Label>
            <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="1. Ünite Testi" />
            <Field label="Teslim Tarihi (ISO, ops.)" value={dueDate} onChangeText={setDueDate} placeholder="2026-09-15" autoCapitalize="none" />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Oluşturuluyor…' : 'Ödevi Oluştur'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Ödev yok." icon="book-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.title}</Label>
            <Chip label={`${item.submissionCount} teslim`} tone="neutral" />
          </View>
          <MutedText>Başlama: {fmt(item.startDate)} · Teslim: {fmt(item.dueDate)}</MutedText>
          {item.description ? <MutedText>{item.description}</MutedText> : null}
        </Card>
      )}
    />
  );
}
