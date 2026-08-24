import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface AlumnusSummary { id: string; firstName: string; lastName: string; graduationYear: string | null; university: string | null; employment: string | null; phone: string | null; }

export default function BranchMezunlarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ alumni: AlumnusSummary[] }>('/api/branch/alumni');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [graduationYear, setGraduationYear] = useState('');
  const [university, setUniversity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) { setFormError('Ad ve soyad zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try {
      await api.post('/api/branch/alumni', { firstName: firstName.trim(), lastName: lastName.trim(), graduationYear: graduationYear.trim() || undefined, university: university.trim() || undefined });
      setFirstName(''); setLastName(''); setGraduationYear(''); setUniversity(''); await refetch();
    } catch (err) { setFormError(err instanceof Error ? err.message : 'Eklenemedi.'); }
    finally { setSubmitting(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.alumni ?? []} keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Mezunlar</Title>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 10 }}>
            <Label>Yeni Mezun</Label>
            <Field label="Ad" value={firstName} onChangeText={setFirstName} />
            <Field label="Soyad" value={lastName} onChangeText={setLastName} />
            <Field label="Mezuniyet Yılı" value={graduationYear} onChangeText={setGraduationYear} placeholder="2025" />
            <Field label="Üniversite" value={university} onChangeText={setUniversity} />
            {formError && <ErrorBanner message={formError} />}
            <Button title={submitting ? 'Ekleniyor…' : 'Mezun Ekle'} onPress={submit} loading={submitting} />
          </Card>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Mezun kaydı yok." icon="ribbon-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <Label>{item.firstName} {item.lastName}</Label>
          <MutedText>{item.graduationYear ? `Mezuniyet: ${item.graduationYear}` : ''}{item.university ? ` · ${item.university}` : ''}</MutedText>
          {item.employment ? <MutedText>İş: {item.employment}</MutedText> : null}
        </Card>
      )}
    />
  );
}
