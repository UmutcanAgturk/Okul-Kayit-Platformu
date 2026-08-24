import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface CourseSummary {
  id: string; code: string; name: string; description: string | null;
  credit: number | null; weeklyHours: number | null; mandatory: boolean; gradeLevels: string[];
}

export default function BranchKurslarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ courses: CourseSummary[] }>('/api/branch/courses');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gradeLevels, setGradeLevels] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!code.trim() || !name.trim()) { setFormError('Kod ve ad zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await api.post('/api/branch/courses', { code: code.trim(), name: name.trim(), gradeLevels: gradeLevels.split(',').map((g) => g.trim()).filter(Boolean) });
      setCode(''); setName(''); setGradeLevels(''); await refetch();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Kurs oluşturulamadı.'); }
    finally { setSubmitting(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.courses ?? []} keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Kurslar</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Kurs</Label>
            <Field label="Kurs Kodu" value={code} onChangeText={setCode} placeholder="IO-2010" autoCapitalize="characters" />
            <Field label="Kurs Adı" value={name} onChangeText={setName} placeholder="Robotik Kodlama" />
            <Field label="Sınıf Seviyeleri (virgülle)" value={gradeLevels} onChangeText={setGradeLevels} placeholder="01, 02, 03" autoCapitalize="none" />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Oluşturuluyor…' : 'Kursu Oluştur'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Kurs yok." icon="library-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            {item.mandatory ? <Chip label="Zorunlu" tone="warning" /> : null}
          </View>
          <MutedText>{item.code}{item.credit != null ? ` · ${item.credit} kredi` : ''}{item.weeklyHours != null ? ` · ${item.weeklyHours} saat/hafta` : ''}</MutedText>
          {item.gradeLevels.length ? <MutedText>Seviyeler: {item.gradeLevels.join(', ')}</MutedText> : null}
        </Card>
      )}
    />
  );
}
