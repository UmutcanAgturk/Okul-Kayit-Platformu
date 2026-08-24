import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface MedicalCaseSummary { id: string; patientName: string | null; severity: string; status: string; description: string | null; openedAt: string; }
const SEV: Record<string, string> = { DUSUK: 'Düşük', ORTA: 'Orta', YUKSEK: 'Yüksek' };
const TONE: Record<string, 'neutral' | 'warning' | 'critical'> = { DUSUK: 'neutral', ORTA: 'warning', YUKSEK: 'critical' };
const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });

export default function BranchSaglikScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ cases: MedicalCaseSummary[] }>('/api/branch/health/cases');
  const [patientName, setPatientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  async function submit() {
    if (!patientName.trim()) { setFormError('Hasta adı zorunludur.'); return; }
    setSubmitting(true); setFormError(null);
    try { await api.post('/api/branch/health/cases', { patientName: patientName.trim() }); setPatientName(''); await refetch(); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Açılamadı.'); } finally { setSubmitting(false); }
  }
  async function close(id: string) { setBusyId(id); try { await api.patch(`/api/branch/health/cases/${id}`); await refetch(); } finally { setBusyId(null); } }
  return (
    <FlatList contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing} data={data?.cases ?? []} keyExtractor={(c) => c.id}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 4 }}><Title>Sağlık / Revir</Title>{error && <ErrorBanner message={error} />}
        <Card style={{ gap: 10 }}><Label>Yeni Vaka</Label>
          <Field label="Hasta" value={patientName} onChangeText={setPatientName} />
          {formError && <ErrorBanner message={formError} />}
          <Button title={submitting ? 'Kaydediliyor…' : 'Vaka Aç'} onPress={submit} loading={submitting} /></Card></View>}
      ListEmptyComponent={!loading ? <EmptyState message="Vaka yok." icon="medkit-outline" /> : null}
      renderItem={({ item }) => (<Card style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>{item.patientName ?? '—'}</Label><Chip label={SEV[item.severity]} tone={TONE[item.severity]} /></View>
        <MutedText>{fmt(item.openedAt)}{item.description ? ` · ${item.description}` : ''}</MutedText>
        {item.status === 'ACIK' ? <Button title="Vakayı Kapat" variant="secondary" onPress={() => close(item.id)} loading={busyId === item.id} /> : <Chip label="Kapalı" tone="neutral" />}</Card>)}
    />
  );
}
