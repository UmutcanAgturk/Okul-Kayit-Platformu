import { FlatList, RefreshControl, View } from 'react-native';

import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Screen, Subtitle, Title } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import { useStudentSelection } from '@/lib/student-selection';
import type { PaymentInstallment } from '@/lib/types';

function formatAmount(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InstallmentsScreen() {
  const { selectedStudent } = useStudentSelection();
  const path = selectedStudent ? `/api/students/${selectedStudent.studentId}/installments` : null;
  const { data, loading, refreshing, error, refetch } = useApiQuery<{
    installments: PaymentInstallment[];
  }>(path);

  if (!selectedStudent) {
    return (
      <Screen>
        <EmptyState message="Taksitleri görüntülemek için bir öğrenci seçin." />
      </Screen>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <Title>Taksitler</Title>
          <Subtitle>{selectedStudent.fullName}</Subtitle>
          {error && <ErrorBanner message={error} />}
        </View>
      }
      data={data?.installments ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !loading ? <EmptyState message="Bu öğrenciye ait taksit kaydı bulunamadı." /> : null
      }
      renderItem={({ item }) => (
        <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 4 }}>
            <Label>{item.installmentNo}. Taksit</Label>
            <MutedText>Vade: {formatDate(item.dueDate)}</MutedText>
            {item.paidAt && <MutedText>Ödendi: {formatDate(item.paidAt)}</MutedText>}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Label>{formatAmount(item.amount)}</Label>
            <Chip
              label={item.status === 'PAID' ? 'Ödendi' : 'Bekliyor'}
              tone={item.status === 'PAID' ? 'success' : 'warning'}
            />
          </View>
        </Card>
      )}
    />
  );
}
