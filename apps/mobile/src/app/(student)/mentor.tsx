import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { MentorRequestRow, StudentMentorInfo } from '@/lib/types';

const STATUS: Record<string, { label: string; tone: 'success' | 'warning' | 'critical' | 'neutral' }> = {
  BEKLIYOR: { label: 'Bekliyor', tone: 'warning' },
  ONAYLANDI: { label: 'Onaylandı', tone: 'success' },
  REDDEDILDI: { label: 'Reddedildi', tone: 'critical' },
  TAMAMLANDI: { label: 'Tamamlandı', tone: 'neutral' },
};

export default function MentorScreen() {
  const { studentId } = useStudentSelection();
  const info = useApiQuery<StudentMentorInfo>(studentId ? `/api/students/${studentId}/mentor` : null);
  const reqs = useApiQuery<{ requests: MentorRequestRow[] }>(studentId ? `/api/students/${studentId}/mentor-requests` : null);

  if (info.loading) return <CenterLoading />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {info.error && <ErrorBanner message={info.error} />}
      <Card style={{ gap: 6 }}>
        <Label>Mentörüm</Label>
        {info.data?.mentor ? (
          <>
            <MutedText>{info.data.mentor.name} · {info.data.mentor.branch}</MutedText>
            {info.data.quota && <MutedText>Kota: {info.data.quota.used}/{info.data.quota.limit}</MutedText>}
          </>
        ) : (
          <MutedText>Henüz bir mentör atanmadı.</MutedText>
        )}
      </Card>

      <Subtitle>Randevu Talepleri</Subtitle>
      {(reqs.data?.requests.length ?? 0) === 0 && <EmptyState message="Talep bulunmuyor." />}
      {reqs.data?.requests.map((r) => {
        const m = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as const };
        return (
          <Card key={r.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{r.mentorName}</Label>
              <Chip label={m.label} tone={m.tone} />
            </View>
            {r.note ? <MutedText>{r.note}</MutedText> : null}
            <MutedText>{new Date(r.requestedAt).toLocaleDateString('tr-TR')}</MutedText>
          </Card>
        );
      })}
    </ScrollView>
  );
}
