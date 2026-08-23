import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { TeacherTimetableSlotRow } from '@/lib/types';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function TeacherDersProgramiScreen() {
  const { data, loading, error } = useApiQuery<{ slots: TeacherTimetableSlotRow[] }>('/api/teacher/timetable');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const slots = data?.slots ?? [];
  const byDay = DAYS.map((day, i) => ({ day, items: slots.filter((s) => s.dayOfWeek === i + 1).sort((a, b) => a.startTime.localeCompare(b.startTime)) })).filter((d) => d.items.length);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {byDay.length === 0 && <EmptyState message="Ders programı bulunamadı." />}
      {byDay.map((d) => (
        <View key={d.day} style={{ gap: 8 }}>
          <Label>{d.day}</Label>
          {d.items.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View><Label>{s.subject}</Label><MutedText>{s.classroomName}</MutedText></View>
              <MutedText>{s.startTime}–{s.endTime}</MutedText>
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
