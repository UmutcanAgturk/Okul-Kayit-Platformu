import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Button, Card, CenterLoading, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { clearActingTenant, fetchHqTenants, setActingTenant } from '@/lib/hq';
import type { HqTenant } from '@/lib/types';

/**
 * Genel Merkez (SUPERADMIN) şube bağlamı çubuğu — web'deki HqBranchSelector'ın
 * mobil karşılığı. `(branch)` ekranlarının en üstünde görünür: hangi şube olarak
 * yönetildiğini gösterir, şube değiştirmeye ve Genel Merkez'e (konsolide moda)
 * dönmeye izin verir. SUPERADMIN dışındaki rollerde hiçbir şey render etmez.
 *
 * mode="launcher": (admin) hub'ında "Bir şube olarak yönet" başlatıcısı olarak
 *   kullanılır; şube seçilince (branch) portalına yönlendirir.
 * mode="bar" (varsayılan): (branch) ekranlarının başında bağlam çubuğu.
 */
export function HqBranchBar({ mode = 'bar' }: { mode?: 'bar' | 'launcher' }) {
  const { user, refreshMe } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tenants, setTenants] = useState<HqTenant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (user?.role !== 'SUPERADMIN') return null;

  const acting = user.actingTenantId ? { id: user.actingTenantId, name: user.actingTenantName ?? 'Şube' } : null;

  async function openPicker() {
    setOpen(true);
    setErr(null);
    if (tenants) return;
    setLoading(true);
    try {
      const res = await fetchHqTenants();
      setTenants(res.tenants.filter((t) => t.type === 'SUBE'));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Şubeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }

  async function choose(t: HqTenant) {
    if (t.isActive === false) { setErr('Pasif şube yönetilemez.'); return; }
    setBusyId(t.id);
    setErr(null);
    try {
      await setActingTenant(t.id);
      await refreshMe();
      setOpen(false);
      router.replace('/(branch)');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Şube seçilemedi');
    } finally {
      setBusyId(null);
    }
  }

  async function backToHq() {
    setBusyId('__hq__');
    try {
      await clearActingTenant();
      await refreshMe();
      router.replace('/(admin)');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Genel Merkez\'e dönülemedi');
    } finally {
      setBusyId(null);
    }
  }

  const filtered = useMemo(() => {
    const list = tenants ?? [];
    const s = q.trim().toLocaleLowerCase('tr');
    return s ? list.filter((t) => t.name.toLocaleLowerCase('tr').includes(s) || (t.city ?? '').toLocaleLowerCase('tr').includes(s)) : list;
  }, [tenants, q]);

  const picker = (
    <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '82%', paddingTop: 12 }}>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Subtitle>Şube Seç</Subtitle>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}><Ionicons name="close" size={24} color={theme.text} /></Pressable>
          </View>
          <View style={{ paddingHorizontal: 16 }}>
            <Field label="Şube Ara" value={q} onChangeText={setQ} autoCapitalize="none" />
          </View>
          {err && <View style={{ padding: 16 }}><ErrorBanner message={err} /></View>}
          {loading ? (
            <CenterLoading />
          ) : (
            <FlatList
              contentContainerStyle={{ padding: 16, gap: 10 }}
              data={filtered}
              keyExtractor={(t) => t.id}
              ListEmptyComponent={<EmptyState message="Şube bulunamadı." icon="business-outline" />}
              renderItem={({ item }) => (
                <Pressable onPress={() => choose(item)} disabled={busyId === item.id}>
                  <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: item.isActive === false ? 0.5 : 1 }}>
                    <View style={{ flex: 1 }}>
                      <Label>{item.name}</Label>
                      <MutedText>{item.city ?? '—'} · {item.studentCount ?? 0} öğrenci{item.isActive === false ? ' · Pasif' : ''}</MutedText>
                    </View>
                    {acting?.id === item.id ? (
                      <Ionicons name="checkmark-circle" size={22} color={theme.brand} />
                    ) : (
                      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                    )}
                  </Card>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );

  if (mode === 'launcher') {
    return (
      <>
        <Pressable onPress={openPicker}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: theme.brand, borderWidth: 1 }}>
            <Ionicons name="git-branch-outline" size={22} color={theme.brand} />
            <View style={{ flex: 1 }}>
              <Label>Bir Şube Olarak Yönet</Label>
              <MutedText>{acting ? `Şu an: ${acting.name}` : 'Seçtiğiniz şubenin tüm modüllerini görüp düzenleyin'}</MutedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
          </Card>
        </Pressable>
        {picker}
      </>
    );
  }

  return (
    <View style={{ backgroundColor: theme.brand + '18', borderBottomColor: theme.brand + '40', borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="git-branch" size={18} color={theme.brand} />
        <View style={{ flex: 1 }}>
          <MutedText>Genel Merkez · şube olarak yönetiyorsunuz</MutedText>
          <Label>{acting?.name ?? 'Şube seçilmedi'}</Label>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Button title="Şube Değiştir" variant="secondary" onPress={openPicker} /></View>
        <View style={{ flex: 1 }}><Button title="Genel Merkez'e Dön" onPress={backToHq} loading={busyId === '__hq__'} /></View>
      </View>
      {picker}
    </View>
  );
}
