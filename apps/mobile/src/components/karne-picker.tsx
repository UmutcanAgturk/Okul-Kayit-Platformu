import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { ReportCardView } from '@/components/report-card-view';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchStudentRow, MyClassRow } from '@/lib/types';

type Row = { id: string; name: string; sub: string };

/**
 * Karne için öğrenci seçici. `source: 'branch'` şubenin tüm öğrenci listesini
 * (/api/branch/students), `source: 'teacher'` öğretmenin kendi sınıflarını
 * (/api/teacher/my-classes) kullanır — öğretmen şube listesine erişemez.
 */
export function KarnePicker({ source }: { source: 'branch' | 'teacher' }) {
  const branch = useApiQuery<{ students: BranchStudentRow[] }>(source === 'branch' ? '/api/branch/students' : null);
  const teacher = useApiQuery<{ classrooms: MyClassRow[] }>(source === 'teacher' ? '/api/teacher/my-classes' : null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);

  const rows: Row[] = useMemo(() => {
    if (source === 'branch') {
      return (branch.data?.students ?? []).map((s) => ({ id: s.id, name: s.name, sub: s.classroomName ?? s.studentNo }));
    }
    return (teacher.data?.classrooms ?? []).flatMap((c) =>
      c.students.map((s) => ({ id: s.studentId, name: s.name, sub: c.classroomName })),
    );
  }, [source, branch.data, teacher.data]);

  const loading = source === 'branch' ? branch.loading : teacher.loading;
  const error = source === 'branch' ? branch.error : teacher.error;

  const filtered = useMemo(() => {
    if (!q.trim()) return rows.slice(0, 60);
    const t = q.toLocaleLowerCase('tr');
    return rows.filter((r) => r.name.toLocaleLowerCase('tr').includes(t));
  }, [rows, q]);

  if (selected) {
    return (
      <View style={{ flex: 1 }}>
        <Pressable onPress={() => setSelected(null)} style={{ padding: 12 }}>
          <Label>‹ {selected.name} — Geri</Label>
        </Pressable>
        <ReportCardView studentId={selected.id} />
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={filtered}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Field label="Öğrenci Ara" value={q} onChangeText={setQ} placeholder="Ad" autoCapitalize="none" />
          {error && <ErrorBanner message={error} />}
          <MutedText>Karnesini görmek için bir öğrenci seçin.</MutedText>
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setSelected({ id: item.id, name: item.name })}>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label>
            <MutedText>{item.sub}</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
