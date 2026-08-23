import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { PaymentStudentOverviewRow } from '@/lib/types';

function tl(n: number) { return `₺${Math.round(n).toLocaleString('tr-TR')}`; }
const ST: Record<string, 'success' | 'warning' | 'critical' | 'neutral'> = { GUNCEL: 'success', YAKLASAN: 'warning', GECIKMIS: 'critical' };

export default function OdemeYontemleriScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: PaymentStudentOverviewRow[] }>('/api/branch/payment-methods/student-overview');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.students ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kayıt yok." icon="card-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.name}</Label>
            <Chip label={item.paymentStatus} tone={ST[item.paymentStatus] ?? 'neutral'} />
          </View>
          <MutedText>{item.guardianName ?? ''} · {tl(item.totalTuition)} · {item.methodType}</MutedText>
        </Card>
      )}
    />
  );
}
