import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, ErrorBanner, Field, Label, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';

const TYPES: { k: string; l: string }[] = [
  { k: 'STUDENTS', l: 'Öğrenciler' }, { k: 'GUARDIANS', l: 'Veliler' }, { k: 'TEACHERS', l: 'Öğretmenler' }, { k: 'MANAGERS', l: 'Yöneticiler' },
];

export default function MesajYayiniScreen() {
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [sel, setSel] = useState<string[]>(['STUDENTS']);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function toggle(k: string) { setSel((s) => s.includes(k) ? s.filter((x) => x !== k) : [...s, k]); }

  async function send() {
    if (!title.trim() || !body.trim() || sel.length === 0) { setErr('Başlık, mesaj ve en az bir hedef zorunlu'); return; }
    setBusy(true); setErr(null); setOk(null);
    try {
      const r = await api.post<{ recipientCount: number; tenantsReached: number }>('/api/hq/messages', { title: title.trim(), body: body.trim(), recipientTypes: sel });
      setOk(`${r.recipientCount} kişiye, ${r.tenantsReached} kuruma gönderildi.`); setTitle(''); setBody('');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gönderilemedi'); } finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Subtitle>Tüm Sisteme Duyuru</Subtitle>
      <Label>Hedef Kitle</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TYPES.map((t) => <Pressable key={t.k} onPress={() => toggle(t.k)}><Chip label={t.l} tone="brand" selected={sel.includes(t.k)} /></Pressable>)}
      </View>
      <Field label="Başlık" value={title} onChangeText={setTitle} />
      <Field label="Mesaj" value={body} onChangeText={setBody} multiline />
      {err && <ErrorBanner message={err} />}
      {ok && <Chip label={ok} tone="success" />}
      <Button title="Yayınla" onPress={send} loading={busy} />
    </ScrollView>
  );
}
