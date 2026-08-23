import { useState } from 'react';
import { FlatList, RefreshControl, View, Pressable } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorBanner,
  Field,
  Label,
  MutedText,
  Title,
} from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { LedgerEntry, LedgerSummary, LedgerType } from '@/lib/types';

function tl(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function LedgerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    entries: LedgerEntry[];
    summary: LedgerSummary;
  }>('/api/branch/accounting-ledger');

  const [type, setType] = useState<LedgerType>('GELIR');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  async function del(id: string) {
    setDeletingId(id);
    try { await api.del(`/api/branch/accounting-ledger/${id}`); await refetch(); }
    catch { /* yut */ } finally { setDeletingId(null); }
  }

  async function handleSubmit() {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!category.trim() || !parsedAmount || parsedAmount <= 0 || !entryDate) {
      setFormError('Kategori ve geçerli bir tutar (>0) zorunludur');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/api/branch/accounting-ledger', {
        type,
        category: category.trim(),
        amount: parsedAmount,
        entryDate,
        note: note.trim() || undefined,
      });
      setCategory('');
      setAmount('');
      setNote('');
      await refetch();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Kayıt eklenemedi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Muhasebe Defteri</Title>
          {error && <ErrorBanner message={error} />}

          <Card style={{ gap: 10 }}>
            <Label>Yeni Kayıt</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label="Gelir" tone="success" selected={type === 'GELIR'} onPress={() => setType('GELIR')} />
              <Chip label="Gider" tone="critical" selected={type === 'GIDER'} onPress={() => setType('GIDER')} />
            </View>
            <Field label="Kategori" value={category} onChangeText={setCategory} placeholder="ör. Taksit Tahsilatı" />
            <Field label="Tutar (₺)" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="1000" />
            <Field label="Tarih (YYYY-AA-GG)" value={entryDate} onChangeText={setEntryDate} />
            <Field label="Not (opsiyonel)" value={note} onChangeText={setNote} />
            {formError && <ErrorBanner message={formError} />}
            <Button title="Kayıt Ekle" onPress={handleSubmit} loading={submitting} />
          </Card>
        </View>
      }
      data={data?.entries ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={!loading ? <EmptyState message="Henüz muhasebe kaydı yok." /> : null}
      renderItem={({ item }) => (
        <Pressable onLongPress={() => del(item.id)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4, flex: 1 }}>
              <Label>{item.category}</Label>
              <MutedText>{new Date(item.entryDate).toLocaleDateString('tr-TR')}{deletingId === item.id ? ' · siliniyor…' : ' · (sil: uzun bas)'}</MutedText>
              {item.note ? <MutedText>{item.note}</MutedText> : null}
            </View>
            <Chip label={tl(item.amount)} tone={item.type === 'GELIR' ? 'success' : 'critical'} />
          </Card>
        </Pressable>
      )}
    />
  );
}
