import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { RoleStudentRow } from '@/lib/types';

interface GuardianRow { parentId: string; guardianName: string; studentName: string; relation: string; username: string; }

export default function RollerScreen() {
  const [mode, setMode] = useState<'ogrenci' | 'veli'>('ogrenci');
  const st = useApiQuery<{ students: RoleStudentRow[] }>(mode === 'ogrenci' ? '/api/branch/roles/students' : null);
  const gd = useApiQuery<{ guardians: GuardianRow[] }>(mode === 'veli' ? '/api/branch/roles/guardians' : null);
  const [editId, setEditId] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(id: string) {
    setBusy(true); setErr(null);
    const url = mode === 'ogrenci' ? `/api/branch/roles/students/${id}` : `/api/branch/roles/guardians/${id}`;
    try { await api.patch(url, { username: val.trim() }); setEditId(null); mode === 'ogrenci' ? await st.refetch() : await gd.refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); } finally { setBusy(false); }
  }

  const items: { id: string; name: string; sub: string; username: string }[] =
    mode === 'ogrenci'
      ? (st.data?.students ?? []).map((s) => ({ id: s.id, name: s.name, sub: `No: ${s.studentNo}${s.classroomName ? ` · ${s.classroomName}` : ''}`, username: s.username }))
      : (gd.data?.guardians ?? []).map((g) => ({ id: g.parentId, name: g.guardianName, sub: `${g.relation} · ${g.studentName}`, username: g.username }));
  const loading = mode === 'ogrenci' ? st.loading : gd.loading;
  const error = mode === 'ogrenci' ? st.error : gd.error;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={items} keyExtractor={(x) => x.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => setMode('ogrenci')}><Chip label="Öğrenciler" tone="brand" selected={mode === 'ogrenci'} /></Pressable>
            <Pressable onPress={() => setMode('veli')}><Chip label="Veliler" tone="brand" selected={mode === 'veli'} /></Pressable>
          </View>
          {(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Kayıt yok." icon="key-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <Label>{item.name}</Label>
          <MutedText>{item.sub}</MutedText>
          {editId === item.id ? (
            <>
              <Field label="Kullanıcı Adı" value={val} onChangeText={setVal} autoCapitalize="none" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="Kaydet" onPress={() => save(item.id)} loading={busy} />
                <Button title="Vazgeç" variant="secondary" onPress={() => setEditId(null)} />
              </View>
            </>
          ) : (
            <>
              <MutedText>Kullanıcı: {item.username}</MutedText>
              <Button title="Kullanıcı Adını Düzenle" variant="secondary" onPress={() => { setEditId(item.id); setVal(item.username); }} />
            </>
          )}
        </Card>
      )}
    />
  );
}
