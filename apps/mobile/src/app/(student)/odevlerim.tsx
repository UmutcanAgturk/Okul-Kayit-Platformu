import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, CenterLoading, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { useAuth } from '@/lib/auth-context';

/**
 * Mobil "Ödevlerim" — öğrenci/veli ödevlerini görür ve fotoğraf/metin ile
 * teslim eder. Web /odevlerim'in mobil karşılığı (aynı API).
 */

type StudentAssignment = {
  id: string; title: string; description: string | null; dueDate: string | null;
  status: 'ASSIGNED' | 'SUBMITTED' | 'GRADED'; note: string | null; fileName: string | null; grade: string | null; feedback: string | null;
};

const STATUS: Record<string, { label: string; tone: 'neutral' | 'warning' | 'success' }> = {
  ASSIGNED: { label: 'Bekliyor', tone: 'neutral' },
  SUBMITTED: { label: 'Teslim edildi', tone: 'warning' },
  GRADED: { label: 'Değerlendirildi', tone: 'success' },
};

function fmt(iso: string | null) { return iso ? new Date(iso).toLocaleDateString('tr-TR') : '—'; }

function SubmitCard({ studentId, a, onDone }: { studentId: string; a: StudentAssignment; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(a.note ?? '');
  const [file, setFile] = useState<{ fileName: string; mimeType: string; dataUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const asset = res.assets[0];
    const mime = asset.mimeType && /^image\/(jpeg|png|webp)$/.test(asset.mimeType) ? asset.mimeType : 'image/jpeg';
    setFile({ fileName: asset.fileName ?? 'odev.jpg', mimeType: mime, dataUrl: `data:${mime};base64,${asset.base64}` });
  }
  async function submit() {
    setBusy(true); setErr(null);
    try { await api.post(`/api/students/${studentId}/assignments/${a.id}/submit`, { note: note.trim() || undefined, ...(file ?? {}) }); setOpen(false); onDone(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Teslim edilemedi'); } finally { setBusy(false); }
  }

  const st = STATUS[a.status];
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label>{a.title}</Label>
        <Chip label={st.label} tone={st.tone} />
      </View>
      <MutedText>Teslim: {fmt(a.dueDate)}</MutedText>
      {a.description ? <MutedText>{a.description}</MutedText> : null}

      {a.status === 'GRADED' ? (
        <Card style={{ gap: 2 }}>
          <Label>Not: {a.grade}</Label>
          {a.feedback ? <MutedText>Öğretmen: {a.feedback}</MutedText> : null}
        </Card>
      ) : !open ? (
        <Button title={a.status === 'SUBMITTED' ? 'Teslimi Güncelle' : 'Teslim Et'} onPress={() => setOpen(true)} />
      ) : (
        <View style={{ gap: 8 }}>
          <Field label="Not / Açıklama" value={note} onChangeText={setNote} placeholder="Cevabınız" multiline />
          <Button title={file ? `📎 ${file.fileName}` : 'Fotoğraf Ekle'} variant="secondary" onPress={pick} />
          {err && <ErrorBanner message={err} />}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button title="Gönder" onPress={submit} loading={busy} disabled={!note.trim() && !file} /></View>
            <View style={{ flex: 1 }}><Button title="Vazgeç" variant="secondary" onPress={() => setOpen(false)} /></View>
          </View>
        </View>
      )}
    </Card>
  );
}

export default function OdevlerimScreen() {
  const { user } = useAuth();
  const children = useMemo(() => user?.students ?? [], [user]);
  const [studentId, setStudentId] = useState<string | null>(null);
  useEffect(() => { if (!studentId && children.length > 0) setStudentId(children[0].studentId); }, [children, studentId]);

  const { data, loading, error, refetch } = useApiQuery<{ assignments: StudentAssignment[] }>(studentId ? `/api/students/${studentId}/assignments` : null);
  const assignments = data?.assignments ?? [];

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      onRefresh={refetch}
      refreshing={loading}
      data={assignments}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Subtitle>Ödevlerim</Subtitle>
          {error && <ErrorBanner message={error} />}
          {children.length > 1 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {children.map((c) => (
                <Pressable key={c.studentId} onPress={() => setStudentId(c.studentId)}>
                  <Chip label={c.fullName} tone="brand" selected={studentId === c.studentId} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Henüz ödev yok." icon="book-outline" /> : null}
      renderItem={({ item }) => studentId ? <SubmitCard studentId={studentId} a={item} onDone={refetch} /> : null}
    />
  );
}
