import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { EnrollmentRow } from '@/lib/types';

type Done = { credentials: { username: string; password: string }; parentCredentials: { username: string; password: string } | null };

function CompleteForm({ enrollment, onDone, onBack }: { enrollment: EnrollmentRow; onDone: (d: Done) => void; onBack: () => void }) {
  const [nationalId, setNationalId] = useState('');
  const [guardianNationalId, setGuardianNationalId] = useState('');
  const [count, setCount] = useState('1');
  const [amount, setAmount] = useState('');
  const [firstDueDate, setFirstDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [contract, setContract] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (nationalId.length !== 11 || guardianNationalId.length !== 11) { setErr('Öğrenci ve veli T.C. Kimlik No 11 hane olmalı'); return; }
    if (!contract) { setErr('Sözleşme onayı gerekli'); return; }
    const ic = parseInt(count, 10); const ia = parseFloat(amount);
    if (!ic || ic < 1) { setErr('Geçerli taksit sayısı girin'); return; }
    if (!ia || ia <= 0) { setErr('Geçerli taksit tutarı girin'); return; }
    setBusy(true);
    try {
      const res = await api.post<Done>(`/api/branch/enrollments/${enrollment.id}/complete`, {
        installmentCount: ic, installmentAmount: ia, firstDueDate,
        nationalId, guardianNationalId, contractAccepted: true,
      });
      onDone(res);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Kayıt tamamlanamadı');
    } finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable>
      <Subtitle>{enrollment.candidateFullName} — Kaydı Tamamla</Subtitle>
      <MutedText>{enrollment.candidateGradeLevel} · {enrollment.programType}</MutedText>
      <Field label="Öğrenci T.C. Kimlik No" value={nationalId} onChangeText={(t) => setNationalId(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" placeholder="11 hane" />
      <Field label="Veli T.C. Kimlik No" value={guardianNationalId} onChangeText={(t) => setGuardianNationalId(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" placeholder="11 hane" />
      <Field label="Taksit Sayısı" value={count} onChangeText={(t) => setCount(t.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" />
      <Field label="Taksit Tutarı (₺)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="örn. 2500" />
      <Field label="İlk Vade (YYYY-AA-GG)" value={firstDueDate} onChangeText={setFirstDueDate} placeholder="2026-09-01" autoCapitalize="none" />
      <Pressable onPress={() => setContract((c) => !c)}>
        <Chip label={contract ? '✓ Sözleşme onaylandı' : 'Sözleşmeyi onayla'} tone={contract ? 'success' : 'neutral'} selected={contract} />
      </Pressable>
      {err && <ErrorBanner message={err} />}
      <Button title="Kaydı Tamamla" onPress={submit} loading={busy} />
    </ScrollView>
  );
}

export default function NormalKayitScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ enrollments: EnrollmentRow[] }>('/api/branch/enrollments');
  const [selected, setSelected] = useState<EnrollmentRow | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const candidates = useMemo(
    () => (data?.enrollments ?? []).filter((e) => e.stage !== 'KAYIT_TAMAMLANDI' && e.stage !== 'IPTAL_EDILDI'),
    [data],
  );

  if (done) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Subtitle>Kayıt Tamamlandı ✓</Subtitle>
        <Card style={{ gap: 6 }}>
          <Label>Öğrenci Girişi</Label>
          <MutedText>Kullanıcı: {done.credentials.username}</MutedText>
          <MutedText>Şifre: {done.credentials.password}</MutedText>
        </Card>
        {done.parentCredentials && (
          <Card style={{ gap: 6 }}>
            <Label>Veli Girişi</Label>
            <MutedText>Kullanıcı: {done.parentCredentials.username}</MutedText>
            <MutedText>Şifre: {done.parentCredentials.password}</MutedText>
          </Card>
        )}
        <MutedText>Bu bilgileri veliye iletin; şifreler tekrar gösterilmez.</MutedText>
        <Button title="Listeye Dön" onPress={() => { setDone(null); setSelected(null); refetch(); }} />
      </ScrollView>
    );
  }

  if (selected) return <CompleteForm enrollment={selected} onDone={setDone} onBack={() => setSelected(null)} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={candidates} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Tamamlanacak bir aday seçin.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Tamamlanacak aday yok." icon="document-text-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setSelected(item)}>
          <Card style={{ gap: 4 }}>
            <Label>{item.candidateFullName}</Label>
            <MutedText>{item.candidateGradeLevel} · {item.programType} · Veli: {item.guardianFullName}</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
