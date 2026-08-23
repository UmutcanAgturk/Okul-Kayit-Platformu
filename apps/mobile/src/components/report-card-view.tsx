import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { ReportCard } from '@/lib/types';

export function ReportCardView({ studentId }: { studentId: string }) {
  const { data, loading, error } = useApiQuery<ReportCard>(`/api/students/${studentId}/report-card`);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Karne verisi yok." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Label>{data.studentName}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="ribbon" label="Genel Başarı" value={data.summary.overallAvgMasteryPct != null ? `%${Math.round(data.summary.overallAvgMasteryPct)}` : '—'} />
        <StatTile icon="calendar" label="Devamsızlık" value={`%${Math.round(data.attendanceSummary.absenceRatePct)}`} tone={data.attendanceSummary.absenceRatePct > 15 ? 'warning' : 'success'} />
        <StatTile icon="shield-checkmark" label="Davranış" value={String(data.disciplineSummary.netPoints)} tone={data.disciplineSummary.netPoints < 0 ? 'critical' : 'success'} />
      </View>
      <Subtitle>Ders Bazlı Başarı</Subtitle>
      {data.subjectBreakdown.length === 0 && <MutedText>Veri yok.</MutedText>}
      {data.subjectBreakdown.map((s) => (
        <Card key={s.subject} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Label>{s.subject}</Label><Label>%{Math.round(s.avgMasteryPct)}</Label>
        </Card>
      ))}
      <Subtitle>Sınav Geçmişi</Subtitle>
      {data.examHistory.length === 0 && <MutedText>Sınav yok.</MutedText>}
      {data.examHistory.map((e) => (
        <Card key={e.examId} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{e.examName}</Label><Label>Net {e.netScore}</Label>
          </View>
          <MutedText>{e.examType} · {new Date(e.examDate).toLocaleDateString('tr-TR')}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
