import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { InboxMessage } from '@/lib/types';

const SENDER_ROLES = ['BRANCH_ADMIN', 'GUIDANCE_COORDINATOR', 'TEACHER', 'SUPERADMIN'];
const AUDIENCES: { key: string; label: string }[] = [
  { key: 'ALL_STUDENTS', label: 'Tüm Öğrenciler' },
  { key: 'ALL_GUARDIANS', label: 'Tüm Veliler' },
  { key: 'STUDENTS_AND_GUARDIANS', label: 'Öğrenci+Veli' },
  { key: 'ALL_TEACHERS', label: 'Öğretmenler' },
  { key: 'ALL_STAFF', label: 'Personel' },
];

export function InboxScreen() {
  const { user } = useAuth();
  const canSend = !!user && SENDER_ROLES.includes(user.role);
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ messages: InboxMessage[] }>('/api/messages/inbox');
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('ALL_STUDENTS');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!title.trim() || !body.trim()) { setErr('Başlık ve mesaj zorunlu'); return; }
    setBusy(true); setErr(null);
    try {
      await api.post('/api/branch/messages', { title: title.trim(), body: body.trim(), audience });
      setTitle(''); setBody(''); setCompose(false); setSent(true); await refetch();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gönderilemedi'); }
    finally { setBusy(false); }
  }

  if (compose) {
    return (
      <View style={{ flex: 1, padding: 16, gap: 12 }}>
        <Subtitle>Yeni Mesaj</Subtitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {AUDIENCES.map((a) => (
            <Pressable key={a.key} onPress={() => setAudience(a.key)}>
              <Chip label={a.label} tone="brand" selected={audience === a.key} />
            </Pressable>
          ))}
        </View>
        <Field label="Başlık" value={title} onChangeText={setTitle} />
        <Field label="Mesaj" value={body} onChangeText={setBody} multiline />
        {err && <ErrorBanner message={err} />}
        <Button title="Gönder" onPress={send} loading={busy} />
        <Button title="Vazgeç" variant="secondary" onPress={() => setCompose(false)} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={data?.messages ?? []} keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {canSend && <Button title="＋ Yeni Mesaj" onPress={() => { setCompose(true); setSent(false); }} />}
          {sent && <Chip label="Mesaj gönderildi" tone="success" />}
          {error ? <ErrorBanner message={error} /> : null}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Gelen kutunuz boş." icon="mail-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => { if (!item.readAt) { api.patch(`/api/messages/${item.id}`).then(refetch).catch(() => {}); } }}
          onLongPress={() => { api.del(`/api/messages/${item.id}`).then(refetch).catch(() => {}); }}>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.title}</Label>
              {!item.readAt && <Chip label="Yeni" tone="brand" />}
            </View>
            <MutedText>{item.senderLabel} · {new Date(item.createdAt).toLocaleDateString('tr-TR')}</MutedText>
            <MutedText>{item.body}</MutedText>
            <MutedText>{item.readAt ? 'Okundu' : 'Okundu işaretle: dokun'} · Sil: uzun bas</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
