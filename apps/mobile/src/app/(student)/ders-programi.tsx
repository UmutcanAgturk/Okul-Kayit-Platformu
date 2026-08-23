import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentTimetableSlotRow } from '@/lib/types';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function DersProgramiScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<{ slots: StudentTimetableSlotRow[] }>(
    studentId ? `/api/students/${studentId}/timetable` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;

  const slots = data?.slots ?? [];
  const byDay = DAYS.map((day, idx) => ({
    day,
    // dayOfWeek: 1=Pazartesi varsayımı (web ile aynı)
    items: slots
      .filter((s) => s.dayOfWeek === idx + 1)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((d) => d.items.length > 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Subtitle>Ders Programı</Subtitle>
      {byDay.length === 0 && <EmptyState message="Ders programı bulunamadı." />}
      {byDay.map((d) => (
        <View key={d.day} style={{ gap: 8 }}>
          <Label>{d.day}</Label>
          {d.items.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Label>{s.subject}</Label>
                <MutedText>{s.teacherName}</MutedText>
              </View>
              <MutedText>{s.startTime}–{s.endTime}</MutedText>
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
