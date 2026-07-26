import { useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Title } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { PaymentInstallment, PaymentStatus } from '@/lib/types';

function tl(amount: string | number) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

type Filter = 'ALL' | PaymentStatus;

export default function BranchInstallmentsScreen() {
  const [filter, setFilter] = useState<Filter>('PENDING');
  const path =
    filter === 'ALL' ? '/api/branch/payment-installments' : `/api/branch/payment-installments?status=${filter}`;
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ installments: PaymentInstallment[] }>(path);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function collect(installmentId: string) {
    setBusyId(installmentId);
    setActionError(null);
    try {
      await api.post(`/api/branch/payment-installments/${installmentId}/collect`);
      await refetch();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Tahsilat işlenemedi');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Taksitler</Title>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Chip label="Bekleyen" tone="warning" selected={filter === 'PENDING'} onPress={() => setFilter('PENDING')} />
            <Chip label="Ödenen" tone="success" selected={filter === 'PAID'} onPress={() => setFilter('PAID')} />
            <Chip label="Tümü" tone="neutral" selected={filter === 'ALL'} onPress={() => setFilter('ALL')} />
          </View>
          {error && <ErrorBanner message={error} />}
          {actionError && <ErrorBanner message={actionError} />}
        </View>
      }
      data={data?.installments ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={!loading ? <EmptyState message="Bu filtrede taksit bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.studentName ?? item.studentId}</Label>
            <Chip label={item.status === 'PAID' ? 'Ödendi' : 'Bekliyor'} tone={item.status === 'PAID' ? 'success' : 'warning'} />
          </View>
          <MutedText>
            {item.installmentNo}. Taksit · Vade: {formatDate(item.dueDate)}
          </MutedText>
          <Label>{tl(item.amount)}</Label>
          {item.status === 'PENDING' && (
            <Button title="Tahsil Et" onPress={() => collect(item.id)} loading={busyId === item.id} />
          )}
        </Card>
      )}
    />
  );
}
