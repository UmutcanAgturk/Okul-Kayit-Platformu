import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, CenterLoading, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Mobil Veli-Öğretmen Mesajlaşma — web /mesajlasma'nın mobil karşılığı. Hem
 * öğretmen hem veli portalında kullanılır (aynı /api/conversations API'si).
 */

type ConversationSummary = { id: string; subject: string; otherName: string; otherRole: string; studentName: string | null; lastMessage: string | null; lastMessageAt: string; unread: number };
type Thread = { subject: string; otherName: string; otherRole: string; studentName: string | null; messages: { id: string; body: string; mine: boolean; createdAt: string }[] };
type TeacherClasses = { classrooms: { classroomName: string; students: { studentId: string; name: string }[] }[] };

function fmt(iso: string) { return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }

export function MessagingScreen() {
  const { user } = useAuth();
  const isParent = user?.role === 'PARENT';
  const { data, loading, error, refetch } = useApiQuery<{ conversations: ConversationSummary[] }>('/api/conversations');
  const [openId, setOpenId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  if (openId) return <ThreadView conversationId={openId} onBack={() => { setOpenId(null); refetch(); }} />;
  if (composing) return <NewConversation isParent={isParent} onDone={(id) => { setComposing(false); refetch(); if (id) setOpenId(id); }} />;

  const conversations = data?.conversations ?? [];
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      onRefresh={refetch}
      refreshing={loading}
      data={conversations}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          {error && <ErrorBanner message={error} />}
          <Button title="+ Yeni Konuşma" onPress={() => setComposing(true)} />
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Henüz konuşma yok." icon="chatbubbles-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpenId(item.id)}>
          <Card style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{item.otherName} · {item.otherRole}</Label>
              {item.unread > 0 && <MutedText>🔵 {item.unread}</MutedText>}
            </View>
            <MutedText>{item.subject}{item.studentName ? ` · ${item.studentName}` : ''}</MutedText>
            <MutedText>{item.lastMessage ?? ''}</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}

function ThreadView({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const theme = useTheme();
  const { data, loading, error, refetch } = useApiQuery<Thread>(`/api/conversations/${conversationId}`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!text.trim()) return;
    setBusy(true);
    try { await api.post(`/api/conversations/${conversationId}/messages`, { body: text.trim() }); setText(''); await refetch(); }
    catch { /* */ } finally { setBusy(false); }
  }

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable><ErrorBanner message={error} /></View>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Pressable onPress={onBack}><Label>‹ {data?.otherName}</Label></Pressable>
        <MutedText>{data?.subject}{data?.studentName ? ` · ${data.studentName}` : ''}</MutedText>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {(data?.messages ?? []).map((m) => (
          <View key={m.id} style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
            <View style={{ backgroundColor: m.mine ? theme.brand : theme.backgroundElement, borderRadius: 12, padding: 9 }}>
              <Label>{m.body}</Label>
            </View>
            <MutedText>{fmt(m.createdAt)}</MutedText>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field label="" value={text} onChangeText={setText} placeholder="Mesaj yazın…" /></View>
        <Button title="Gönder" onPress={send} loading={busy} />
      </View>
    </View>
  );
}

function NewConversation({ isParent, onDone }: { isParent: boolean; onDone: (id: string | null) => void }) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const teacherClasses = useApiQuery<TeacherClasses>(!isParent ? '/api/teacher/my-classes' : null);
  const teachers = useApiQuery<{ teachers: { userId: string; name: string }[] }>(isParent && studentId ? `/api/students/${studentId}/teachers` : null);
  const teacherStudents = useMemo(() => (teacherClasses.data?.classrooms ?? []).flatMap((c) => c.students), [teacherClasses.data]);
  const children = user?.students ?? [];

  async function create() {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ id: string }>('/api/conversations', { studentId, subject: subject.trim(), firstMessage: message.trim(), otherUserId: isParent ? teacherUserId : undefined });
      onDone(r.id);
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Başlatılamadı'); } finally { setBusy(false); }
  }

  const canCreate = !!studentId && !!subject.trim() && !!message.trim() && (!isParent || !!teacherUserId);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable onPress={() => onDone(null)}><Label>‹ Geri</Label></Pressable>
      <Subtitle>Yeni Konuşma</Subtitle>

      <View>
        <Label>{isParent ? 'Çocuğunuz' : 'Öğrenci'}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          {(isParent ? children.map((c) => ({ id: c.studentId, name: c.fullName })) : teacherStudents.map((s) => ({ id: s.studentId, name: s.name }))).map((s) => (
            <Pressable key={s.id} onPress={() => { setStudentId(s.id); setTeacherUserId(''); }}>
              <Chip label={s.name} tone="brand" selected={studentId === s.id} />
            </Pressable>
          ))}
        </View>
      </View>

      {isParent && studentId && (
        <View>
          <Label>Öğretmen</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {(teachers.data?.teachers ?? []).map((t) => (
              <Pressable key={t.userId} onPress={() => setTeacherUserId(t.userId)}>
                <Chip label={t.name} tone="brand" selected={teacherUserId === t.userId} />
              </Pressable>
            ))}
          </View>
          {(teachers.data?.teachers.length ?? 0) === 0 && !teachers.loading && <MutedText>Ders programında öğretmen bulunamadı.</MutedText>}
        </View>
      )}

      <Field label="Konu" value={subject} onChangeText={setSubject} placeholder="Örn. Devamsızlık hakkında" />
      <Field label="Mesaj" value={message} onChangeText={setMessage} placeholder="Mesajınız…" multiline />
      {err && <ErrorBanner message={err} />}
      <Button title="Konuşmayı Başlat" onPress={create} loading={busy} disabled={!canCreate} />
    </ScrollView>
  );
}
