import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Button, Card, CenterLoading, Chip, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchExam, ExamDetail, BranchStudentRow, MyClassRow } from '@/lib/types';

type Mark = true | false | null;

function ResultEntry({ examId, source, onDone }: { examId: string; source: 'branch' | 'teacher'; onDone: () => void }) {
  const detail = useApiQuery<{ exam: ExamDetail }>(`/api/branch/exams/${examId}`);
  const branch = useApiQuery<{ students: BranchStudentRow[] }>(source === 'branch' ? '/api/branch/students' : null);
  const teacher = useApiQuery<{ classrooms: MyClassRow[] }>(source === 'teacher' ? '/api/teacher/my-classes' : null);
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const students = useMemo(() => {
    if (source === 'branch') return (branch.data?.students ?? []).map((s) => ({ id: s.id, name: s.name }));
    return (teacher.data?.classrooms ?? []).flatMap((c) => c.students.map((s) => ({ id: s.studentId, name: s.name })));
  }, [source, branch.data, teacher.data]);
  const filtered = useMemo(() => q.trim() ? students.filter((s) => s.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) : students.slice(0, 40), [students, q]);

  const questions = detail.data?.exam.questions ?? [];

  async function submit() {
    if (!student) return;
    const answers = questions.map((qq) => ({ questionId: qq.id, isCorrect: marks[qq.id] ?? null }));
    setBusy(true); setErr(null);
    try { await api.post(`/api/branch/exams/${examId}/results`, { studentId: student.id, answers }); setOk(true); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); }
    finally { setBusy(false); }
  }

  if (ok) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Subtitle>Sonuç kaydedildi ✓</Subtitle>
        <MutedText>{student?.name} için {detail.data?.exam.name} sonucu işlendi.</MutedText>
        <Button title="Başka Öğrenci" onPress={() => { setStudent(null); setMarks({}); setOk(false); }} />
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

  const answered = Object.keys(marks).length;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Pressable onPress={() => setStudent(null)}><Label>‹ {student.name}</Label></Pressable>
      <MutedText>{answered}/{questions.length} işaretlendi (D=Doğru, Y=Yanlış, B=Boş)</MutedText>
      {questions.map((qq) => (
        <Card key={qq.id} style={{ gap: 6 }}>
          <Label>{qq.orderIndex}. {qq.subject}</Label>
          <MutedText>{qq.achievementLabel}</MutedText>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: true }))}><Chip label="D" tone="success" selected={marks[qq.id] === true} /></Pressable>
            <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: false }))}><Chip label="Y" tone="critical" selected={marks[qq.id] === false} /></Pressable>
            <Pressable onPress={() => setMarks((m) => ({ ...m, [qq.id]: null }))}><Chip label="B" tone="neutral" selected={marks[qq.id] === null && qq.id in marks} /></Pressable>
          </View>
        </Card>
      ))}
      {err && <ErrorBanner message={err} />}
      <Button title="Sonucu Kaydet" onPress={submit} loading={busy} />
    </ScrollView>
  );
}

export function ExamsScreen({ source = 'branch' }: { source?: 'branch' | 'teacher' }) {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: BranchExam[] }>('/api/branch/exams');
  const [entry, setEntry] = useState<string | null>(null);

  if (entry) return <ResultEntry examId={entry} source={source} onDone={() => { setEntry(null); refetch(); }} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.exams ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Sonuç girmek için sınava dokunun.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setEntry(item.id)}>
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
