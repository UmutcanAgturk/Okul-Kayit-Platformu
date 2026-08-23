import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface Template { id: string; kind: string; category: string; title: string; body: string; createdAt: string; }

export default function MesajSablonlariScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ templates: Template[] }>('/api/branch/message-templates');
  const [kind, setKind] = useState('mesaj');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || !body.trim() || !category.trim()) { setErr('Kategori, başlık ve içerik zorunlu'); return; }
    setBusy(true); setErr(null);
    try { await api.post('/api/branch/message-templates', { kind, category: category.trim(), title: title.trim(), body: body.trim() }); setTitle(''); setBody(''); setCategory(''); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Eklenemedi'); } finally { setBusy(false); }
  }
  async function del(id: string) { try { await api.del(`/api/branch/message-templates/${id}`); await refetch(); } catch { /* */ } }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.templates ?? []} keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <Card style={{ gap: 10, marginBottom: 4 }}>
          <Label>Yeni Şablon</Label>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {['mesaj', 'bildirim'].map((k) => <Pressable key={k} onPress={() => setKind(k)}><Chip label={k === 'mesaj' ? 'Mesaj' : 'Bildirim'} tone="brand" selected={kind === k} /></Pressable>)}
          </View>
          <Field label="Kategori" value={category} onChangeText={setCategory} placeholder="ör. Devamsızlık" />
          <Field label="Başlık" value={title} onChangeText={setTitle} />
          <Field label="İçerik" value={body} onChangeText={setBody} multiline />
          {err && <ErrorBanner message={err} />}
          <Button title="Şablon Ekle" onPress={create} loading={busy} />
        </Card>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Şablon yok." icon="documents-outline" /> : (error ? <ErrorBanner message={error} /> : null)}
      renderItem={({ item }) => (
        <Pressable onLongPress={() => del(item.id)}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.title}</Label><Chip label={item.category} tone="neutral" />
            </View>
            <MutedText>{item.body}</MutedText>
            <MutedText>(sil: uzun bas)</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
