import { ScrollView, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Button, Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { ReportCard } from '@/lib/types';

export function ReportCardView({ studentId }: { studentId: string }) {
  const { data, loading, error } = useApiQuery<ReportCard>(`/api/students/${studentId}/report-card`);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Karne verisi yok." />;

  async function exportPdf() {
    if (!data) return;
    const rows = data.subjectBreakdown.map((s) => `<tr><td>${s.subject}</td><td style="text-align:right">%${Math.round(s.avgMasteryPct)}</td></tr>`).join('');
    const exams = data.examHistory.map((e) => `<tr><td>${e.examName}</td><td style="text-align:right">Net ${e.netScore}</td></tr>`).join('');
    const html = `<html><body style="font-family:sans-serif;padding:24px">
      <h1>Karne — ${data.studentName}</h1>
      <p>Genel Başarı: ${data.summary.overallAvgMasteryPct != null ? '%'+Math.round(data.summary.overallAvgMasteryPct) : '—'} · Devamsızlık: %${Math.round(data.attendanceSummary.absenceRatePct)} · Davranış: ${data.disciplineSummary.netPoints}</p>
      <h3>Ders Bazlı Başarı</h3><table width="100%">${rows}</table>
      <h3>Sınav Geçmişi</h3><table width="100%">${exams}</table>
    </body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Label>{data.studentName}</Label><Button title="PDF" variant="secondary" onPress={exportPdf} /></View>
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
