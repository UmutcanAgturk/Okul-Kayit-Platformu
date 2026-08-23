import { useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchClassroom } from '@/lib/types';

interface Detail {
  classroom: { name: string; gradeLevel: string; capacity: number };
  students: { id: string; studentNo: string; name: string; guardianName: string | null }[];
  subjectTeachers: { subject: string; teacherName: string }[];
  weeklyPlan: { id: string; dayOfWeek: number; startTime: string; endTime: string; subject: string; teacherName: string }[];
}
const DAYS = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

function ClassroomDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, loading, error } = useApiQuery<Detail>(`/api/branch/classrooms/${id}/detail`);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable>
      <Subtitle>{data?.classroom.name} · {data?.classroom.gradeLevel}</Subtitle>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile icon="people" label="Öğrenci" value={String(data?.students.length ?? 0)} />
        <StatTile icon="grid" label="Kapasite" value={String(data?.classroom.capacity ?? 0)} />
      </View>
      {(data?.subjectTeachers.length ?? 0) > 0 && <Subtitle>Branş Öğretmenleri</Subtitle>}
      {data?.subjectTeachers.map((t, i) => <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{t.subject}</Label><MutedText>{t.teacherName}</MutedText></Card>)}
      {(data?.weeklyPlan.length ?? 0) > 0 && <Subtitle>Haftalık Program</Subtitle>}
      {data?.weeklyPlan.map((p) => <Card key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{DAYS[p.dayOfWeek]} {p.startTime}</Label><MutedText>{p.subject} · {p.teacherName}</MutedText></Card>)}
      <Subtitle>Öğrenciler</Subtitle>
      {data?.students.map((s) => <Card key={s.id}><Label>{s.name}</Label><MutedText>No: {s.studentNo}{s.guardianName ? ` · Veli: ${s.guardianName}` : ''}</MutedText></Card>)}
    </ScrollView>
  );
}

export default function SiniflarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ classrooms: BranchClassroom[] }>('/api/branch/classrooms');
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <ClassroomDetail id={open} onBack={() => setOpen(null)} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.classrooms ?? []} keyExtractor={(c) => c.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Detay için sınıfa dokunun.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Sınıf yok." icon="grid-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpen(item.id)}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View><Label>{item.name}</Label><MutedText>{item.gradeLevel}</MutedText></View>
            <MutedText>{item.studentCount}/{item.capacity}</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
