import { ScrollView, View } from 'react-native';

import { Card, Chip, ErrorBanner, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { AgingBucket, LedgerEntry, LedgerSummary, PaymentInstallment } from '@/lib/types';

function tl(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

export default function BranchHomeScreen() {
  const { user } = useAuth();
  const ledger = useApiQuery<{ entries: LedgerEntry[]; summary: LedgerSummary }>(
    '/api/branch/accounting-ledger',
  );
  const pending = useApiQuery<{ installments: PaymentInstallment[] }>(
    '/api/branch/payment-installments?status=PENDING',
  );
  const aging = useApiQuery<{ buckets: AgingBucket[] }>('/api/branch/payment-installments/aging');

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>Şube Yönetimi</MutedText>
        </View>

        {ledger.error && <ErrorBanner message={ledger.error} />}

        <Card style={{ gap: 8 }}>
          <Label>Muhasebe Özeti</Label>
          <MutedText>Gelir: {tl(ledger.data?.summary.totalGelir ?? 0)}</MutedText>
          <MutedText>Gider: {tl(ledger.data?.summary.totalGider ?? 0)}</MutedText>
          <Label>Net: {tl(ledger.data?.summary.net ?? 0)}</Label>
        </Card>

        <Card style={{ gap: 8 }}>
          <Label>Bekleyen Taksitler</Label>
          <MutedText>{pending.data?.installments.length ?? 0} taksit tahsilat bekliyor</MutedText>
        </Card>

        <Card style={{ gap: 10 }}>
          <Label>Tahsilat Yaşlandırma</Label>
          {aging.error && <ErrorBanner message={aging.error} />}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(aging.data?.buckets ?? []).map((bucket) => (
              <Chip
                key={bucket.id}
                label={`${bucket.label} · ${bucket.count} · ${tl(bucket.amount)}`}
                tone={bucket.count > 0 ? 'critical' : 'neutral'}
              />
            ))}
          </View>
          <MutedText>Vadesi geçmiş taksitler, en eski vadeye göre gecikme aralığına ayrılır.</MutedText>
        </Card>
      </Screen>
    </ScrollView>
  );
}
