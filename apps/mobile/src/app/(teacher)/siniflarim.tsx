import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { MyClassRow } from '@/lib/types';

export default function SiniflarimScreen() {
  const { data, loading, error } = useApiQuery<{ classrooms: MyClassRow[] }>('/api/teacher/my-classes');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const classes = data?.classrooms ?? [];
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {classes.length === 0 && <EmptyState message="Atanmış sınıfınız yok." />}
      {classes.map((c) => (
        <View key={c.classroomId} style={{ gap: 8 }}>
          <Subtitle>{c.classroomName} · {c.students.length} öğrenci</Subtitle>
          {c.students.map((s) => (
            <Card key={s.studentId} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Label>{s.name}</Label>
                <MutedText>{s.netAvg != null ? `Net ${s.netAvg}` : '—'}</MutedText>
              </View>
              <MutedText>No: {s.studentNo} · {s.gradeLevel}</MutedText>
              {s.guardianName ? <MutedText>Veli: {s.guardianName}{s.guardianPhone ? ` · ${s.guardianPhone}` : ''}</MutedText> : null}
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
