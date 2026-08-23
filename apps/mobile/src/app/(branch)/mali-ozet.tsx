import { ScrollView, View } from 'react-native';
import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }

interface Vat { summary: { hesaplananKdv: number; indirilecekKdv: number; odenecekKdv: number; devredenKdv: number }; }
interface Wh { summary: { kayitSayisi: number; brutToplam: number; stopajKesintisi: number; netOdenecek: number }; }
interface Aging { buckets: { id: string; label: string; count: number; amount: number }[]; rows: { studentId: string; studentName: string; count: number; totalAmount: number; daysLate: number }[]; }

export default function MaliOzetScreen() {
  const vat = useApiQuery<Vat>('/api/branch/accounting-ledger/vat-summary');
  const wh = useApiQuery<Wh>('/api/branch/accounting-ledger/withholding-summary');
  const aging = useApiQuery<Aging>('/api/branch/payment-installments/aging');

  if (vat.loading || wh.loading || aging.loading) return <CenterLoading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {(vat.error || wh.error || aging.error) ? <ErrorBanner message={vat.error ?? wh.error ?? aging.error ?? ''} /> : null}

      <Subtitle>KDV Özeti</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="add-circle" label="Hesaplanan" value={tl(vat.data?.summary.hesaplananKdv ?? 0)} />
        <StatTile icon="remove-circle" label="İndirilecek" value={tl(vat.data?.summary.indirilecekKdv ?? 0)} />
        <StatTile icon="cash" label="Ödenecek" value={tl(vat.data?.summary.odenecekKdv ?? 0)} tone="warning" />
        <StatTile icon="arrow-forward-circle" label="Devreden" value={tl(vat.data?.summary.devredenKdv ?? 0)} />
      </View>

      <Subtitle>Stopaj Özeti</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="documents" label="Kayıt" value={String(wh.data?.summary.kayitSayisi ?? 0)} />
        <StatTile icon="wallet" label="Brüt" value={tl(wh.data?.summary.brutToplam ?? 0)} />
        <StatTile icon="cut" label="Stopaj" value={tl(wh.data?.summary.stopajKesintisi ?? 0)} tone="critical" />
        <StatTile icon="checkmark-circle" label="Net" value={tl(wh.data?.summary.netOdenecek ?? 0)} tone="success" />
      </View>

      <Subtitle>Tahsilat Yaşlandırma</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {(aging.data?.buckets ?? []).map((b) => (
          <StatTile key={b.id} icon="time" label={b.label} value={`${b.count} · ${tl(b.amount)}`} tone={b.id === '90+' ? 'critical' : 'warning'} />
        ))}
      </View>
      {(aging.data?.rows.length ?? 0) === 0 && <MutedText>Vadesi geçmiş taksit yok.</MutedText>}
      {(aging.data?.rows ?? []).map((r) => (
        <Card key={r.studentId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View><Label>{r.studentName}</Label><MutedText>{r.count} taksit · {r.daysLate} gün gecikme</MutedText></View>
          <Label>{tl(r.totalAmount)}</Label>
        </Card>
      ))}
    </ScrollView>
  );
}
