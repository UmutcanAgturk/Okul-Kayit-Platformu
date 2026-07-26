import { FlatList, RefreshControl, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Label, MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqTenantSummary } from '@/lib/types';

function tl(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

export default function AdminHomeScreen() {
  const { user } = useAuth();
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    tenants: HqTenantSummary[];
    grandTotal: { totalGelir: number; totalGider: number; net: number };
  }>('/api/hq/accounting-ledger');

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <View>
            <Title>Merhaba, {user?.firstName}</Title>
            <MutedText>Genel Merkez · Superadmin</MutedText>
          </View>
          {error && <ErrorBanner message={error} />}
          <Card style={{ gap: 8 }}>
            <Label>Konsolide Muhasebe — Genel Toplam</Label>
            <MutedText>Gelir: {tl(data?.grandTotal.totalGelir ?? 0)}</MutedText>
            <MutedText>Gider: {tl(data?.grandTotal.totalGider ?? 0)}</MutedText>
            <Label>Net: {tl(data?.grandTotal.net ?? 0)}</Label>
          </Card>
          <Label>Kurum Bazlı Döküm</Label>
        </View>
      }
      data={data?.tenants ?? []}
      keyExtractor={(item) => item.tenantId}
      ListEmptyComponent={!loading ? <EmptyState message="Henüz kurum kaydı yok." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.tenantName}</Label>
            <MutedText>{item.tenantCode}</MutedText>
          </View>
          <MutedText>
            Gelir {tl(item.totalGelir)} · Gider {tl(item.totalGider)} · {item.entryCount} kayıt
          </MutedText>
          <Label>Net: {tl(item.net)}</Label>
        </Card>
      )}
    />
  );
}
