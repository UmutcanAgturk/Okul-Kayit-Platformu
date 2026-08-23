import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Button, Card, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { RoleStudentRow } from '@/lib/types';

export default function RollerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: RoleStudentRow[] }>('/api/branch/roles/students');
  const [editId, setEditId] = useState<string | null>(null);
  const [val, setVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(id: string) {
    setBusy(true); setErr(null);
    try { await api.patch(`/api/branch/roles/students/${id}`, { username: val.trim() }); setEditId(null); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); }
    finally { setBusy(false); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.students ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kullanıcı yok." icon="key-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label><MutedText>{item.classroomName ?? '—'}</MutedText>
          </View>
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
              <MutedText>No: {item.studentNo} · Kullanıcı: {item.username}</MutedText>
              <Button title="Kullanıcı Adını Düzenle" variant="secondary" onPress={() => { setEditId(item.id); setVal(item.username); }} />
            </>
          )}
        </Card>
      )}
    />
  );
}
