import { ScrollView, View } from 'react-native';

import { Card, Chip, ErrorBanner, Label, MutedText, Screen, StatTile, Title } from '@/components/ui';
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

  const overdueCount = (aging.data?.buckets ?? []).reduce((sum, b) => sum + b.count, 0);

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>Şube Yönetimi</MutedText>
        </View>

        {ledger.error && <ErrorBanner message={ledger.error} />}

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile icon="trending-up" label="Gelir" value={tl(ledger.data?.summary.totalGelir ?? 0)} tone="success" />
          <StatTile icon="trending-down" label="Gider" value={tl(ledger.data?.summary.totalGider ?? 0)} tone="critical" />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <StatTile icon="wallet" label="Net" value={tl(ledger.data?.summary.net ?? 0)} tone="brand" />
          <StatTile
            icon="time"
            label="Bekleyen Taksit"
            value={String(pending.data?.installments.length ?? 0)}
            tone={pending.data?.installments.length ? 'warning' : 'brand'}
          />
        </View>

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label>Tahsilat Yaşlandırma</Label>
            {overdueCount > 0 && <Chip label={`${overdueCount} vadesi geçmiş`} tone="critical" />}
          </View>
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
