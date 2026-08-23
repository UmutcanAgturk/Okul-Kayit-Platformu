import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqRoleStudentRow, HqRoleStaffRow } from '@/lib/types';

interface HqGuardian { parentId: string; guardianName: string; studentName: string; relation: string; username: string; tenantName: string; }

export default function HqRollerScreen() {
  const [mode, setMode] = useState<'ogrenci' | 'personel' | 'veli'>('ogrenci');
  const st = useApiQuery<{ students: HqRoleStudentRow[] }>(mode === 'ogrenci' ? '/api/hq/roles/students' : null);
  const sf = useApiQuery<{ staff: HqRoleStaffRow[] }>(mode === 'personel' ? '/api/hq/roles/staff' : null);
  const gd = useApiQuery<{ guardians: HqGuardian[] }>(mode === 'veli' ? '/api/hq/roles/guardians' : null);

  const items: { id: string; name: string; sub: string }[] =
    mode === 'ogrenci' ? (st.data?.students ?? []).map((s) => ({ id: s.id, name: s.name, sub: `${s.tenantName} · ${s.username}` }))
    : mode === 'personel' ? (sf.data?.staff ?? []).map((s) => ({ id: s.id, name: s.name, sub: `${s.title} · ${s.tenantName ?? ''}` }))
    : (gd.data?.guardians ?? []).map((g) => ({ id: g.parentId, name: g.guardianName, sub: `${g.relation} · ${g.tenantName} · ${g.username}` }));
  const loading = mode === 'ogrenci' ? st.loading : mode === 'personel' ? sf.loading : gd.loading;
  const error = mode === 'ogrenci' ? st.error : mode === 'personel' ? sf.error : gd.error;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={items} keyExtractor={(x) => x.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['ogrenci', 'personel', 'veli'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)}><Chip label={m === 'ogrenci' ? 'Öğrenci' : m === 'personel' ? 'Personel' : 'Veli'} tone="brand" selected={mode === m} /></Pressable>
            ))}
          </View>
          {error && <ErrorBanner message={error} />}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Kayıt yok." icon="key-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}><Label>{item.name}</Label><MutedText>{item.sub}</MutedText></Card>
      )}
    />
  );
}
