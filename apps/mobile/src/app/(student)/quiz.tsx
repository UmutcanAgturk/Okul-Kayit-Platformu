import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { QuizAttemptRow } from '@/lib/types';

const SUBJECTS = ['Matematik', 'Türkçe', 'Fen Bilimleri', 'Sosyal Bilgiler', 'İngilizce'];

export default function QuizScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ attempts: QuizAttemptRow[] }>(studentId ? `/api/students/${studentId}/quiz-attempts` : null);
  const [subject, setSubject] = useState('Matematik');
  const [correct, setCorrect] = useState('');
  const [total, setTotal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!studentId) return;
    const c = parseInt(correct, 10), t = parseInt(total, 10);
    if (!t || t < 1 || isNaN(c) || c < 0 || c > t) { setErr('Geçerli doğru/toplam girin'); return; }
    setBusy(true); setErr(null);
    try { await api.post(`/api/students/${studentId}/quiz-attempts`, { subject, correctCount: c, totalCount: t }); setCorrect(''); setTotal(''); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); }
    finally { setBusy(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.attempts ?? []} keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <Card style={{ gap: 10, marginBottom: 8 }}>
          <Subtitle>Yeni Quiz Sonucu</Subtitle>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SUBJECTS.map((s) => (
              <Pressable key={s} onPress={() => setSubject(s)}>
                <Chip label={s} tone="brand" selected={subject === s} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="Doğru" value={correct} onChangeText={(t) => setCorrect(t.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
            <View style={{ flex: 1 }}><Field label="Toplam" value={total} onChangeText={(t) => setTotal(t.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          </View>
          {err && <ErrorBanner message={err} />}
          <Button title="Kaydet" onPress={submit} loading={busy} />
        </Card>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Henüz quiz kaydınız yok." icon="help-circle-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.subject}</Label><Label>{item.correctCount}/{item.totalCount}</Label>
          </View>
          {item.achievementLabel ? <MutedText>{item.achievementLabel}</MutedText> : null}
          <MutedText>{new Date(item.createdAt).toLocaleDateString('tr-TR')}</MutedText>
        </Card>
      )}
    />
  );
}
