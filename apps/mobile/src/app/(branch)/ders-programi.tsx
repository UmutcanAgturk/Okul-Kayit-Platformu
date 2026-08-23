import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchTimetableSlot } from '@/lib/types';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export default function BranchDersProgramiScreen() {
  const { data, loading, error } = useApiQuery<{ slots: BranchTimetableSlot[] }>('/api/branch/timetable');
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  const slots = data?.slots ?? [];
  const byDay = DAYS.map((d, i) => ({ d, items: slots.filter((s) => s.dayOfWeek === i + 1).sort((a, b) => a.startTime.localeCompare(b.startTime)) })).filter((x) => x.items.length);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {byDay.length === 0 && <EmptyState message="Ders programı yok." />}
      {byDay.map((g) => (
        <View key={g.d} style={{ gap: 8 }}>
          <Label>{g.d}</Label>
          {g.items.map((s) => (
            <Card key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View><Label>{s.subject}</Label><MutedText>{s.classroomName} · {s.teacherName}</MutedText></View>
              <MutedText>{s.startTime}–{s.endTime}</MutedText>
            </Card>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
