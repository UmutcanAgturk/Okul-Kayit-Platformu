import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface SurveySummary { id: string; title: string; description: string | null; audience: string; active: boolean; questionCount: number; responseCount: number; }
const AUD: Record<string, string> = { ALL: 'Herkes', STUDENT: 'Öğrenci', PARENT: 'Veli', TEACHER: 'Öğretmen', STAFF: 'Personel' };

export default function BranchAnketlerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ surveys: SurveySummary[] }>('/api/branch/surveys');
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  async function submit() {
    if (!title.trim()) { setFormError('Başlık zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try { await api.post('/api/branch/surveys', { title: title.trim(), questions: questions.split('\n').map((q) => q.trim()).filter(Boolean) }); setTitle(''); setQuestions(''); await refetch(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Oluşturulamadı.'); } finally { setSubmitting(false); }
  }
  return (
    <FlatList contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing} data={data?.surveys ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><Title>Anketler</Title>{error && <ErrorBanner message={error} />}
        <Card style={{ gap: 10 }}><Label>Yeni Anket</Label>
          <Field label="Başlık" value={title} onChangeText={setTitle} placeholder="Veli Memnuniyeti" />
          <Field label="Sorular (her satır bir soru)" value={questions} onChangeText={setQuestions} multiline placeholder={'Memnun musunuz?'} />
          {formError && <ErrorBanner message={formError} />}
          <Button title={submitting ? 'Oluşturuluyor…' : 'Anketi Oluştur'} onPress={submit} loading={submitting} /></Card></View>}
      ListEmptyComponent={!loading ? <EmptyState message="Anket yok." icon="stats-chart-outline" /> : null}
      renderItem={({ item }) => (<Card style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>{item.title}</Label><Chip label={AUD[item.audience] ?? item.audience} tone="brand" /></View>
        <MutedText>{item.questionCount} soru · {item.responseCount} yanıt · {item.active ? 'Aktif' : 'Kapalı'}</MutedText></Card>)}
    />
  );
}
