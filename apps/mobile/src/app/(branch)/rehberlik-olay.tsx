import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface CounselingCaseSummary { id: string; subjectName: string | null; reason: string; counselors: string[]; status: string; openedAt: string; }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

export default function BranchRehberlikOlayScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ cases: CounselingCaseSummary[] }>('/api/branch/counseling');
  const [subjectName, setSubjectName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  async function submit() {
    if (!reason.trim()) { setFormError('Açılma nedeni zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try { await api.post('/api/branch/counseling', { reason: reason.trim(), subjectName: subjectName.trim() || undefined }); setReason(''); setSubjectName(''); await refetch(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Açılamadı.'); } finally { setSubmitting(false); }
  }
  async function close(id: string) { setBusyId(id); try { await api.patch(`/api/branch/counseling/${id}`, {}); await refetch(); } finally { setBusyId(null); } }
  return (
    <FlatList contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing} data={data?.cases ?? []} keyExtractor={(c) => c.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><Title>Rehberlik Olay Takibi</Title>{error && <ErrorBanner message={error} />}
        <Card style={{ gap: 10 }}><Label>Yeni Olay</Label>
          <Field label="Görüşülen Kişi" value={subjectName} onChangeText={setSubjectName} />
          <Field label="Açılma Nedeni" value={reason} onChangeText={setReason} placeholder="Akademik kaygı" />
          {formError && <ErrorBanner message={formError} />}
          <Button title={submitting ? 'Kaydediliyor…' : 'Olay Aç'} onPress={submit} loading={submitting} /></Card></View>}
      ListEmptyComponent={!loading ? <EmptyState message="Olay yok." icon="flag-outline" /> : null}
      renderItem={({ item }) => (<Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>{item.reason}</Label><Chip label={item.status === 'ACIK' ? 'Açık' : 'Kapalı'} tone={item.status === 'ACIK' ? 'warning' : 'neutral'} /></View>
        <MutedText>{item.subjectName ? `${item.subjectName} · ` : ''}{fmt(item.openedAt)}{item.counselors.length ? ` · ${item.counselors.join(', ')}` : ''}</MutedText>
        {item.status === 'ACIK' && <Button title="Olayı Kapat" variant="secondary" onPress={() => close(item.id)} loading={busyId === item.id} />}</Card>)}
    />
  );
}
