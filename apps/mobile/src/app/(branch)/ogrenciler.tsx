import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchStudentRow } from '@/lib/types';

function StudentDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, loading, error } = useApiQuery<{ student: any }>(`/api/branch/students/${id}/detail`);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const d = data?.student;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable>
      <Subtitle>Öğrenci No: {d?.studentNo}</Subtitle>
      <Card style={{ gap: 4 }}>
        {d?.nationalId ? <MutedText>T.C.: {d.nationalId}</MutedText> : null}
        {d?.birthDate ? <MutedText>Doğum: {new Date(d.birthDate).toLocaleDateString('tr-TR')}</MutedText> : null}
        {d?.gender ? <MutedText>Cinsiyet: {d.gender}</MutedText> : null}
        {d?.phone ? <MutedText>Telefon: {d.phone}</MutedText> : null}
        {d?.targetGoal ? <MutedText>Hedef: {d.targetGoal}</MutedText> : null}
      </Card>
      {d?.lastExamStats && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <StatTile icon="stats-chart" label="Son Net" value={String(d.lastExamStats.netScore)} tone="brand" />
          <StatTile icon="checkmark" label="Doğru" value={String(d.lastExamStats.correct)} tone="success" />
          <StatTile icon="close" label="Yanlış" value={String(d.lastExamStats.wrong)} tone="critical" />
        </View>
      )}
      <PaymentMethods studentId={id} />
    </ScrollView>
  );
}

function PaymentMethods({ studentId }: { studentId: string }) {
  const { data, refetch } = useApiQuery<{ methods: { id: string; type: string; provider: string; maskedCardNumber: string | null; isDefault: boolean }[] }>(`/api/branch/students/${studentId}/payment-methods`);
  const [busy, setBusy] = useState(false);
  async function add(type: string) {
    setBusy(true);
    try { await api.post(`/api/branch/students/${studentId}/payment-methods`, { type }); await refetch(); } catch { /* */ } finally { setBusy(false); }
  }
  async function del(id: string) { try { await api.del(`/api/branch/students/${studentId}/payment-methods/${id}`); await refetch(); } catch { /* */ } }
  return (
    <Card style={{ gap: 8 }}>
      <Label>Kayıtlı Ödeme Yöntemleri</Label>
      {(data?.methods ?? []).map((m) => (
        <Pressable key={m.id} onLongPress={() => del(m.id)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MutedText>{m.type}{m.maskedCardNumber ? ` · ${m.maskedCardNumber}` : ''}</MutedText>
            {m.isDefault ? <Chip label="Varsayılan" tone="success" /> : <MutedText>(sil: uzun bas)</MutedText>}
          </Card>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {['KREDI_KARTI', 'BANKA_HAVALESI', 'NAKIT'].map((t) => <Pressable key={t} onPress={() => add(t)} disabled={busy}><Chip label={`+ ${t}`} tone="brand" /></Pressable>)}
      </View>
    </Card>
  );
}

export default function OgrencilerScreen() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: BranchStudentRow[] }>('/api/branch/students');
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const all = data?.students ?? [];
    if (!q.trim()) return all;
    const t = q.toLocaleLowerCase('tr');
    return all.filter((s) => s.name.toLocaleLowerCase('tr').includes(t) || s.studentNo.includes(t));
  }, [data, q]);

  if (openId) return <StudentDetail id={openId} onBack={() => setOpenId(null)} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={filtered}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Field label="Ara" value={q} onChangeText={setQ} placeholder="Ad veya öğrenci no" autoCapitalize="none" />
          {error && <ErrorBanner message={error} />}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpenId(item.id)}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{item.name}</Label>
              <MutedText>{item.classroomName ?? 'Sınıfsız'}</MutedText>
            </View>
            <MutedText>No: {item.studentNo} · {item.gradeLevel}</MutedText>
            {item.guardianName ? <MutedText>Veli: {item.guardianName}{item.guardianPhone ? ` · ${item.guardianPhone}` : ''}</MutedText> : null}
          </Card>
        </Pressable>
      )}
    />
  );
}
