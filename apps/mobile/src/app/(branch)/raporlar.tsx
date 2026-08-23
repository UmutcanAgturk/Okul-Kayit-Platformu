import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { exportPdfReport } from '@/lib/pdf-report';
import { useApiQuery } from '@/lib/use-api-query';
import type { FinancialSummary, BranchStudentRow, StaffMember, BranchExam, AttendanceBranchSummary } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

export default function RaporlarScreen() {
  const fin = useApiQuery<FinancialSummary>('/api/branch/reports/financial-summary');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pdf(kind: string) {
    setBusy(kind); setErr(null);
    try {
      if (kind === 'mali' && fin.data) {
        await exportPdfReport('Mali Özet', [{
          heading: `Gelir ${tl(fin.data.totalIncome)} · Gider ${tl(fin.data.totalExpense)} · Net ${tl(fin.data.netProfit)}`,
          headers: ['Kategori', 'Tür', 'Tutar'],
          rows: fin.data.rows.map((r) => [r.category, r.type === 'GELIR' ? 'Gelir' : 'Gider', tl(r.amount)]),
        }]);
      } else if (kind === 'ogrenci') {
        const d = await api.get<{ students: BranchStudentRow[] }>('/api/branch/students');
        await exportPdfReport('Öğrenci Listesi', [{ heading: `${d.students.length} öğrenci`, headers: ['Ad', 'No', 'Sınıf', 'Veli'], rows: d.students.map((s) => [s.name, s.studentNo, s.classroomName ?? '—', s.guardianName ?? '—']) }]);
      } else if (kind === 'personel') {
        const d = await api.get<{ staff: StaffMember[] }>('/api/branch/staff');
        await exportPdfReport('Personel Listesi', [{ heading: `${d.staff.length} personel`, headers: ['Ad', 'Ünvan', 'Durum'], rows: d.staff.map((s) => [s.name, s.title, s.isActive ? 'Aktif' : 'Pasif']) }]);
      } else if (kind === 'sinav') {
        const d = await api.get<{ exams: BranchExam[] }>('/api/branch/exams');
        await exportPdfReport('Sınav Özeti', [{ heading: `${d.exams.length} sınav`, headers: ['Sınav', 'Tür', 'Sonuç', 'Ort. Net'], rows: d.exams.map((e) => [e.name, e.type, String(e.resultCount), e.avgNet != null ? String(e.avgNet) : '—']) }]);
      } else if (kind === 'devamsizlik') {
        const d = await api.get<AttendanceBranchSummary>('/api/branch/attendance-summary');
        await exportPdfReport('Devamsızlık Özeti', [{ heading: `${d.summary.classroomsTotal} sınıf · bugün ${d.summary.takenTodayCount} alındı`, headers: ['Sınıf', 'Öğrenci', 'Devamsızlık %'], rows: d.classrooms.map((c) => [c.name, String(c.studentCount), `%${Math.round(c.absentRate)}`]) }]);
      }
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Rapor oluşturulamadı'); }
    finally { setBusy(null); }
  }

  const reports = [
    { k: 'mali', l: 'Mali Özet' }, { k: 'ogrenci', l: 'Öğrenci Listesi' }, { k: 'personel', l: 'Personel Listesi' },
    { k: 'sinav', l: 'Sınav Özeti' }, { k: 'devamsizlik', l: 'Devamsızlık Özeti' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Subtitle>Mali Özet</Subtitle>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile icon="trending-up" label="Gelir" value={tl(fin.data?.totalIncome ?? 0)} tone="success" />
        <StatTile icon="trending-down" label="Gider" value={tl(fin.data?.totalExpense ?? 0)} tone="critical" />
      </View>
      <StatTile icon="podium" label="Net Kâr" value={tl(fin.data?.netProfit ?? 0)} tone="brand" />
      {err && <ErrorBanner message={err} />}
      <Subtitle>PDF Raporlar</Subtitle>
      <Card style={{ gap: 8 }}>
        <MutedText>Rapor oluşturup paylaşın (PDF).</MutedText>
        {reports.map((r) => (
          <Button key={r.k} title={`${r.l} — PDF`} variant="secondary" onPress={() => pdf(r.k)} loading={busy === r.k} />
        ))}
      </Card>
    </ScrollView>
  );
}
