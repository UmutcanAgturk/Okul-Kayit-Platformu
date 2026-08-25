import { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, CenterLoading, EmptyState, ErrorBanner, Field, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchExam, MyClassRow } from '@/lib/types';

/**
 * Mobil Optik Okuyucu (OMR) — SADECE mobil uygulamada olan ekran. Öğretmen
 * cevap kağıdının fotoğrafını çeker; sunucu Anthropic (Claude) görü modeliyle
 * işaretleri okuyup cevap anahtarıyla karşılaştırır ve sonucu kaydeder (bkz.
 * apps/web POST /api/teacher/exams/[examId]/omr). Web navigasyonunda YOKTUR.
 */

type OmrResult = { correctCount: number; wrongCount: number; emptyCount: number; netScore: number; readAnswers: string[] };

function Uploader({ examId, examName, onDone }: { examId: string; examName: string; onDone: () => void }) {
  const teacher = useApiQuery<{ classrooms: MyClassRow[] }>('/api/teacher/my-classes');
  const [q, setQ] = useState('');
  const [student, setStudent] = useState<{ id: string; name: string } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<OmrResult | null>(null);

  const students = useMemo(
    () => (teacher.data?.classrooms ?? []).flatMap((c) => c.students.map((s) => ({ id: s.studentId, name: s.name }))),
    [teacher.data],
  );
  const filtered = useMemo(
    () => (q.trim() ? students.filter((s) => s.name.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr'))) : students.slice(0, 40)),
    [students, q],
  );

  async function scan(mode: 'camera' | 'library') {
    if (!student) return;
    setErr(null);
    try {
      if (mode === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setErr('Kamera izni verilmedi.'); return; }
      }
      const res =
        mode === 'camera'
          ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const a = res.assets[0];
      const mime = a.mimeType && /^image\/(jpeg|png|webp)$/.test(a.mimeType) ? a.mimeType : 'image/jpeg';
      setPreview(a.uri);
      setBusy(true);
      const out = await api.post<OmrResult>(`/api/teacher/exams/${examId}/omr`, {
        studentId: student.id,
        imageBase64: a.base64,
        mediaType: mime,
      });
      setResult(out);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Optik okunamadı');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Subtitle>Optik okundu ✓</Subtitle>
        <MutedText>{student?.name} · {examName}</MutedText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile icon="checkmark-circle-outline" label="Doğru" value={String(result.correctCount)} tone="success" />
          <StatTile icon="close-circle-outline" label="Yanlış" value={String(result.wrongCount)} tone="critical" />
          <StatTile icon="ellipse-outline" label="Boş" value={String(result.emptyCount)} tone="warning" />
        </View>
        <StatTile icon="stats-chart-outline" label="Net" value={String(result.netScore)} tone="brand" />
        <MutedText>Okunan: {result.readAnswers.map((x) => x || '·').join(' ')}</MutedText>
        <Button title="Başka Öğrenci" onPress={() => { setStudent(null); setPreview(null); setResult(null); }} />
        <Button title="Sınav Listesine Dön" variant="secondary" onPress={onDone} />
      </ScrollView>
    );
  }

  if (!student) {
    if (teacher.loading) return <CenterLoading />;
    return (
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={filtered}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Pressable onPress={onDone}><Label>‹ Geri</Label></Pressable>
            <Subtitle>{examName}</Subtitle>
            <MutedText>Optik form yüklenecek öğrenciyi seçin</MutedText>
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
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable onPress={() => setStudent(null)}><Label>‹ {student.name}</Label></Pressable>
      <MutedText>{examName} · {student.name} için cevap kağıdının fotoğrafını çekin.</MutedText>
      {preview && <Image source={{ uri: preview }} style={{ width: '100%', height: 220, borderRadius: 10 }} resizeMode="contain" />}
      {err && <ErrorBanner message={err} />}
      {busy ? (
        <CenterLoading label="AI optik formu okuyor…" />
      ) : (
        <>
          <Button title="📷 Fotoğraf Çek" onPress={() => scan('camera')} />
          <Button title="Galeriden Seç" variant="secondary" onPress={() => scan('library')} />
        </>
      )}
    </ScrollView>
  );
}

export default function TeacherOptikOkuyucuScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: BranchExam[] }>('/api/branch/exams');
  const [exam, setExam] = useState<{ id: string; name: string } | null>(null);

  if (exam) return <Uploader examId={exam.id} examName={exam.name} onDone={() => { setExam(null); refetch(); }} />;

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch}
      refreshing={refreshing}
      data={data?.exams ?? []}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        error ? <ErrorBanner message={error} /> : <MutedText>Optik okuma için bir sınav seçin. Cevap anahtarı girilmiş sınavlar okunabilir.</MutedText>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setExam({ id: item.id, name: item.name })}>
          <Card style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{item.name}</Label>
              <MutedText>{item.questionCount} soru</MutedText>
            </View>
            <MutedText>{item.type} · {new Date(item.examDate).toLocaleDateString('tr-TR')} · {item.resultCount} sonuç</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
