import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { ReportCard } from '@/lib/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function KarneScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<ReportCard>(studentId ? `/api/students/${studentId}/report-card` : null);

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Karne verisi bulunamadı." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="ribbon" label="Genel Başarı" value={data.summary.overallAvgMasteryPct != null ? `%${Math.round(data.summary.overallAvgMasteryPct)}` : '—'} />
        <StatTile icon="calendar" label="Devamsızlık" value={`%${Math.round(data.attendanceSummary.absenceRatePct)}`} tone={data.attendanceSummary.absenceRatePct > 15 ? 'warning' : 'success'} />
        <StatTile icon="shield-checkmark" label="Davranış Puanı" value={String(data.disciplineSummary.netPoints)} tone={data.disciplineSummary.netPoints < 0 ? 'critical' : 'success'} />
      </View>

      {(data.summary.strongestSubject || data.summary.weakestSubject) && (
        <Card style={{ gap: 6 }}>
          <Label>Ders Özeti</Label>
          {data.summary.strongestSubject && <MutedText>En güçlü: {data.summary.strongestSubject}</MutedText>}
          {data.summary.weakestSubject && <MutedText>Geliştirilmeli: {data.summary.weakestSubject}</MutedText>}
        </Card>
      )}

      <View style={{ gap: 8 }}>
        <Subtitle>Ders Bazlı Başarı</Subtitle>
        {data.subjectBreakdown.length === 0 && <MutedText>Henüz veri yok.</MutedText>}
        {data.subjectBreakdown.map((s) => (
          <Card key={s.subject} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{s.subject}</Label>
            <Label>%{Math.round(s.avgMasteryPct)}</Label>
          </Card>
        ))}
      </View>

      <View style={{ gap: 8 }}>
        <Subtitle>Sınav Geçmişi</Subtitle>
        {data.examHistory.length === 0 && <MutedText>Henüz sınav sonucu yok.</MutedText>}
        {data.examHistory.map((e) => (
          <Card key={e.examId} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Label>{e.examName}</Label>
              <Label>Net {e.netScore}</Label>
            </View>
            <MutedText>{e.examType} · {formatDate(e.examDate)}{e.percentile != null ? ` · Yüzdelik ${e.percentile}` : ''}</MutedText>
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}
