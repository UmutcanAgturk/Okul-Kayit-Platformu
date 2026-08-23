import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface CatalogRow { id: string; type: string; label: string; extra: string | null; isDefault: boolean; isActive: boolean; }
const TYPES = ['KREDI_KARTI', 'BANKA_HAVALESI', 'NAKIT', 'SENET'] as const;
const TLABEL: Record<string, string> = { KREDI_KARTI: 'Kredi Kartı', BANKA_HAVALESI: 'Banka Havalesi', NAKIT: 'Nakit', SENET: 'Senet' };

export default function OdemeYontemleriScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ methods: CatalogRow[] }>('/api/branch/payment-method-catalog');
  const [type, setType] = useState<string>('KREDI_KARTI');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!label.trim()) { setErr('Etiket girin'); return; }
    setBusy(true); setErr(null);
    try { await api.post('/api/branch/payment-method-catalog', { type, label: label.trim() }); setLabel(''); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Eklenemedi'); }
    finally { setBusy(false); }
  }
  async function del(id: string) {
    setBusy(true); setErr(null);
    try { await api.del(`/api/branch/payment-method-catalog/${id}`); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Silinemedi'); }
    finally { setBusy(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.methods ?? []} keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <Card style={{ gap: 10, marginBottom: 8 }}>
          <Label>Yeni Ödeme Yöntemi</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)}>
                <Chip label={TLABEL[t]} tone="brand" selected={type === t} />
              </Pressable>
            ))}
          </View>
          <Field label="Etiket" value={label} onChangeText={setLabel} placeholder="örn. Ziraat POS" />
          {err && <ErrorBanner message={err} />}
          <Button title="Ekle" onPress={add} loading={busy} />
        </Card>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Tanımlı yöntem yok." icon="card-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.label}</Label>
            <Chip label={TLABEL[item.type] ?? item.type} tone="neutral" />
          </View>
          {item.extra ? <MutedText>{item.extra}</MutedText> : null}
          <Button title="Sil" variant="danger" onPress={() => del(item.id)} loading={busy} />
        </Card>
      )}
    />
  );
}
