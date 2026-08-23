import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqTenant } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = { GENEL_MERKEZ: 'Genel Merkez', SUBE: 'Şube', BOLUM: 'Bölüm' };

export default function KurumlarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ tenants: HqTenant[] }>('/api/hq/tenants');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cred, setCred] = useState<{ username: string; password: string } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(''); const [city, setCity] = useState('');
  const [mf, setMf] = useState(''); const [ml, setMl] = useState('');

  async function create() {
    if (!name.trim() || !city.trim() || !mf.trim() || !ml.trim()) { setErr('Ad, şehir, yönetici ad/soyad zorunlu'); return; }
    setBusyId('new'); setErr(null);
    try {
      const r = await api.post<{ credentials: { username: string; password: string } }>('/api/hq/tenants', { name: name.trim(), city: city.trim(), managerFirstName: mf.trim(), managerLastName: ml.trim() });
      setCred(r.credentials); setShowNew(false); setName(''); setCity(''); setMf(''); setMl(''); await refetch();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Oluşturulamadı'); } finally { setBusyId(null); }
  }
  async function toggle(id: string) {
    setBusyId(id); setErr(null);
    try { await api.post(`/api/hq/tenants/${id}/toggle-active`); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Değiştirilemedi'); } finally { setBusyId(null); }
  }
  async function resetCred(id: string) {
    setBusyId(id); setErr(null);
    try { const r = await api.post<{ credentials: { username: string; password: string } }>(`/api/hq/tenants/${id}/reset-credentials`); setCred(r.credentials); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Sıfırlanamadı'); } finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.tenants ?? []} keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
          {cred && <Card style={{ gap: 4 }}><Label>Giriş Bilgileri</Label><MutedText>Kullanıcı: {cred.username}</MutedText><MutedText>Şifre: {cred.password}</MutedText><Button title="Kapat" variant="secondary" onPress={() => setCred(null)} /></Card>}
          {!showNew ? <Button title="＋ Yeni Kurum" onPress={() => setShowNew(true)} /> : (
            <Card style={{ gap: 10 }}>
              <Label>Yeni Kurum</Label>
              <Field label="Kurum Adı" value={name} onChangeText={setName} />
              <Field label="Şehir" value={city} onChangeText={setCity} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Yönetici Ad" value={mf} onChangeText={setMf} /></View>
                <View style={{ flex: 1 }}><Field label="Yönetici Soyad" value={ml} onChangeText={setMl} /></View>
              </View>
              <Button title="Oluştur" onPress={create} loading={busyId === 'new'} />
              <Button title="Vazgeç" variant="secondary" onPress={() => setShowNew(false)} />
            </Card>
          )}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Kurum yok." icon="business-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6, opacity: item.isActive === false ? 0.55 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            <Chip label={TYPE_LABEL[item.type] ?? item.type} tone={item.type === 'SUBE' ? 'brand' : 'neutral'} />
          </View>
          <MutedText>{item.code}{item.city ? ` · ${item.city}` : ''}</MutedText>
          {item.type === 'SUBE' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title={item.isActive === false ? 'Etkinleştir' : 'Pasifleştir'} variant="secondary" onPress={() => toggle(item.id)} loading={busyId === item.id} />
              <Button title="Şifre Sıfırla" variant="secondary" onPress={() => resetCred(item.id)} loading={busyId === item.id} />
            </View>
          )}
        </Card>
      )}
    />
  );
}
