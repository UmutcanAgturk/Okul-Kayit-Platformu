import { Ionicons } from '@expo/vector-icons';
import { FlatList, RefreshControl, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Title } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqTenantSummary } from '@/lib/types';

function tl(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

export default function AdminHomeScreen() {
  const { user } = useAuth();
  const theme = useTheme();
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
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <StatTile icon="trending-up" label="Gelir" value={tl(data?.grandTotal.totalGelir ?? 0)} tone="success" />
            <StatTile icon="trending-down" label="Gider" value={tl(data?.grandTotal.totalGider ?? 0)} tone="critical" />
          </View>
          <StatTile icon="podium" label="Genel Net" value={tl(data?.grandTotal.net ?? 0)} tone="brand" />
          <Label>Kurum Bazlı Döküm</Label>
        </View>
      }
      data={data?.tenants ?? []}
      keyExtractor={(item) => item.tenantId}
      ListEmptyComponent={!loading ? <EmptyState icon="business-outline" message="Henüz kurum kaydı yok." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.backgroundSelected,
              }}>
              <Ionicons name="business" size={15} color={theme.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Label>{item.tenantName}</Label>
              <MutedText>{item.tenantCode}</MutedText>
            </View>
            <Chip label={`Net ${tl(item.net)}`} tone={item.net >= 0 ? 'success' : 'critical'} />
          </View>
          <MutedText>
            Gelir {tl(item.totalGelir)} · Gider {tl(item.totalGider)} · {item.entryCount} kayıt
          </MutedText>
        </Card>
      )}
    />
  );
}
