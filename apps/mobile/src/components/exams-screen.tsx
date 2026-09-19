import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, CenterLoading, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchExam, ExamDetail, BranchStudentRow, MyClassRow } from '@/lib/types';

type Mark = true | false | null;
const KEY_OPTIONS = ['A', 'B', 'C', 'D', 'E'];

function ResultEntry({ examId, source, onDone }: { examId: string; source: 'branch' | 'teacher'; onDone: () => void }) {
  const detail = useApiQuery<{ exam: ExamDetail }>(`/api/branch/exams/${examId}`);
  const branch = useApiQuery<{ students: BranchStudentRow[] }>(source === 'branch' ? '/api/branch/students' : null);
  const teacher = useApiQuery<{ classrooms: MyClassRow[] }>(source === 'teacher' ? '/api/teacher/my-classes' : null);
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({}); // elle D/Y/B modu
  const [marked, setMarked] = useState<Record<string, string>>({}); // şık modu (A–E veya '' = boş)
  const [entryMode, setEntryMode] = useState<'sik' | 'dyb'>('sik');
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const students = useMemo(() => {
    if (source === 'branch') return (branch.data?.students ?? []).map((s) => ({ id: s.id, name: s.name }));
    return (teacher.data?.classrooms ?? []).flatMap((c) => c.students.map((s) => ({ id: s.studentId, name: s.name })));
  }, [source, branch.data, teacher.data]);
  const filtered = useMemo(() => q.trim() ? students.filter((s) => s.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) : students.slice(0, 40), [students, q]);

  const questions = detail.data?.exam.questions ?? [];
  const hasFullKey = questions.length > 0 && questions.every((qq) => !!qq.correctAnswer);
  const effectiveMode: 'sik' | 'dyb' = hasFullKey ? entryMode : 'dyb';

  function outcomeFor(qq: { id: string; correctAnswer: string | null }): Mark | undefined {
    if (effectiveMode === 'dyb') return marks[qq.id];
    const m = marked[qq.id];
    if (m === undefined) return undefined;
    if (m === '') return null;
    if (!qq.correctAnswer) return null;
    return m === qq.correctAnswer;
  }

  const live = questions.reduce((acc, qq) => {
    const o = outcomeFor(qq);
    if (o === true) acc.c++; else if (o === false) acc.w++; else if (o === null) acc.b++; else acc.u++;
    return acc;
  }, { c: 0, w: 0, b: 0, u: 0 });
  const net = Math.round((live.c - live.w / 4) * 100) / 100;

  function applyBulk() {
    const seq: string[] = [];
    for (const ch of bulkText.toLocaleUpperCase('tr')) {
      if (/[A-E]/.test(ch)) seq.push(ch);
      else if ('-._*0X'.includes(ch)) seq.push('');
    }
    const next: Record<string, string> = { ...marked };
    questions.forEach((qq, i) => { if (i < seq.length) next[qq.id] = seq[i]; });
    setMarked(next);
  }

  function reset() {
    setStudent(null); setMarks({}); setMarked({}); setBulkText(''); setOk(false); setErr(null);
  }

  async function submit() {
    if (!student) return;
    if (questions.some((qq) => outcomeFor(qq) === undefined)) {
      setErr(effectiveMode === 'sik' ? 'Her soru için bir şık (veya Boş) işaretleyin.' : 'Her soru için D/Y/B işaretleyin.');
      return;
    }
    const answers = questions.map((qq) => ({ questionId: qq.id, isCorrect: outcomeFor(qq) ?? null }));
    setBusy(true); setErr(null);
    try { await api.post(`/api/branch/exams/${examId}/results`, { studentId: student.id, answers }); setOk(true); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); }
    finally { setBusy(false); }
  }

  if (ok) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Subtitle>Sonuç kaydedildi ✓</Subtitle>
        <MutedText>{student?.name} için {detail.data?.exam.name} · {live.c} doğru, {live.w} yanlış, {live.b} boş → Net {net}</MutedText>
        <Button title="Başka Öğrenci" onPress={reset} />
        <Button title="Sınav Listesine Dön" variant="secondary" onPress={onDone} />
      </View>
    );
  }

  if (!student) {
    if (detail.loading) return <CenterLoading />;
    return (
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={filtered} keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Pressable onPress={onDone}><Label>‹ Geri</Label></Pressable>
            <Subtitle>{detail.data?.exam.name}</Subtitle>
            <MutedText>{questions.length} soru · Sonuç girmek için öğrenci seçin</MutedText>
            <Field label="Öğrenci Ara" value={q} onChangeText={setQ} autoCapitalize="none" />
          </View>
        }
        ListEmptyComponent={<EmptyState message="Öğrenci bulunamadı." />}
        renderItem={({ item }) => (
          <Pressable onPress={() => setStudent(item)}>
            <Card><Label>{item.name}</Label></Card>
          </Pressable>
        )}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Pressable onPress={() => { setStudent(null); setMarks({}); setMarked({}); setBulkText(''); }}><Label>‹ {student.name}</Label></Pressable>

      {hasFullKey && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setEntryMode('sik')}><Chip label="Şık Bazlı" tone="brand" selected={entryMode === 'sik'} /></Pressable>
          <Pressable onPress={() => setEntryMode('dyb')}><Chip label="D/Y/B" tone="brand" selected={entryMode === 'dyb'} /></Pressable>
        </View>
      )}
      {!hasFullKey && questions.length > 0 && <MutedText>Cevap anahtarı eksik — elle D/Y/B işaretleyin.</MutedText>}

      {effectiveMode === 'sik' && (
        <Card style={{ gap: 6 }}>
          <Field label="Toplu Yapıştır (ör. ABCEDA…)" value={bulkText} onChangeText={setBulkText} autoCapitalize="characters" placeholder="Öğrencinin şıklarını sırayla" />
          <Button title="Uygula" variant="secondary" onPress={applyBulk} disabled={!bulkText.trim()} />
        </Card>
      )}

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
        <Chip label={`D: ${live.c}`} tone="success" />
        <Chip label={`Y: ${live.w}`} tone="critical" />
        <Chip label={`B: ${live.b}`} tone="neutral" />
        <Chip label={`Net: ${net}`} tone="brand" />
        {live.u > 0 && <Chip label={`${live.u} eksik`} tone="warning" />}
      </View>

      {questions.map((qq) => {
        const o = outcomeFor(qq);
        return (
          <Card key={qq.id} style={{ gap: 6 }}>
            <Label>{qq.orderIndex}. {qq.subject} {o === true ? '✓' : o === false ? '✗' : ''}{qq.correctAnswer ? ` · Anahtar: ${qq.correctAnswer}` : ''}</Label>
            <MutedText>{qq.achievementLabel}</MutedText>
            {effectiveMode === 'sik' ? (
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {KEY_OPTIONS.map((opt) => (
                  <Pressable key={opt} onPress={() => setMarked((m) => ({ ...m, [qq.id]: opt }))}>
                    <Chip label={opt} tone={marked[qq.id] === opt ? (qq.correctAnswer === opt ? 'success' : 'critical') : 'neutral'} selected={marked[qq.id] === opt} />
                  </Pressable>
                ))}
                <Pressable onPress={() => setMarked((m) => ({ ...m, [qq.id]: '' }))}><Chip label="Boş" tone="neutral" selected={marked[qq.id] === ''} /></Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: true }))}><Chip label="D" tone="success" selected={marks[qq.id] === true} /></Pressable>
                <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: false }))}><Chip label="Y" tone="critical" selected={marks[qq.id] === false} /></Pressable>
                <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: null }))}><Chip label="B" tone="neutral" selected={marks[qq.id] === null && qq.id in marks} /></Pressable>
              </View>
            )}
          </Card>
        );
      })}
      {err && <ErrorBanner message={err} />}
      <Button title="Sonucu Kaydet" onPress={submit} loading={busy} />
    </ScrollView>
  );
}

function QuestionStats({ examId, onBack }: { examId: string; onBack: () => void }) {
  const { data, loading, error } = useApiQuery<{ questions: { questionId: string; questionNo: number; subject: string; achievementLabel: string; correct: number; wrong: number; blank: number }[] }>(`/api/branch/exams/${examId}/question-stats`);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={data?.questions ?? []} keyExtractor={(q) => q.questionId}
      ListHeaderComponent={<Pressable onPress={onBack}><Label>‹ Soru İstatistikleri</Label></Pressable>}
      ListEmptyComponent={<EmptyState message="Soru verisi yok." />}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{item.questionNo}. {item.subject}</Label><MutedText>D:{item.correct} Y:{item.wrong} B:{item.blank}</MutedText></View>
          <MutedText>{item.achievementLabel}</MutedText>
        </Card>
      )}
    />
  );
}

export function ExamsScreen({ source = 'branch' }: { source?: 'branch' | 'teacher' }) {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: BranchExam[] }>('/api/branch/exams');
  const [entry, setEntry] = useState<string | null>(null);
  const [stats, setStats] = useState<string | null>(null);

  if (entry) return <ResultEntry examId={entry} source={source} onDone={() => { setEntry(null); refetch(); }} />;
  if (stats) return <QuestionStats examId={stats} onBack={() => setStats(null)} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.exams ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Dokun: sonuç gir · Uzun bas: soru istatistiği</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setEntry(item.id)} onLongPress={() => setStats(item.id)}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{item.name}</Label>
              <MutedText>{item.avgNet != null ? `Ort. ${item.avgNet}` : '—'}</MutedText>
            </View>
            <MutedText>{item.type} · {new Date(item.examDate).toLocaleDateString('tr-TR')} · {item.questionCount} soru · {item.resultCount} sonuç</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
