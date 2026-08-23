import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { PaymentStudentOverviewRow } from '@/lib/types';

const LABEL: Record<string, string> = { KREDI_KARTI: 'Kredi Kartı', BANKA_HAVALESI: 'Havale', NAKIT: 'Nakit', SENET: 'Senet', NONE: 'Tanımsız' };
function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }
const ST: Record<string, 'success' | 'warning' | 'critical' | 'neutral'> = { GUNCEL: 'success', YAKLASAN: 'warning', GECIKMIS: 'critical' };

export default function OdemeAnaliziScreen() {
  const dist = useApiQuery<{ counts: Record<string, number>; total: number }>('/api/branch/payment-methods/distribution');
  const ov = useApiQuery<{ students: PaymentStudentOverviewRow[] }>('/api/branch/payment-methods/student-overview');
  if (dist.loading) return <CenterLoading />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {(dist.error || ov.error) ? <ErrorBanner message={dist.error ?? ov.error ?? ''} /> : null}
      <Subtitle>Ödeme Yöntemi Dağılımı</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {Object.entries(dist.data?.counts ?? {}).map(([k, v]) => (
          <StatTile key={k} icon="card" label={LABEL[k] ?? k} value={String(v)} />
        ))}
      </View>
      <Subtitle>Öğrenci Ödeme Durumu</Subtitle>
      {(ov.data?.students.length ?? 0) === 0 && <MutedText>Kayıt yok.</MutedText>}
      {ov.data?.students.map((s) => (
        <Card key={s.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{s.name}</Label>
            <Chip label={s.paymentStatus} tone={ST[s.paymentStatus] ?? 'neutral'} />
          </View>
          <MutedText>{tl(s.totalTuition)} · {LABEL[s.methodType] ?? s.methodType}</MutedText>
        </Card>
      ))}
    </ScrollView>
  );
}
