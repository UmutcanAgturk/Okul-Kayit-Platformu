import { ScrollView, View } from 'react-native';

import { Card, ErrorBanner, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { LedgerEntry, LedgerSummary, PaymentInstallment } from '@/lib/types';

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
      </Screen>
    </ScrollView>
  );
}
