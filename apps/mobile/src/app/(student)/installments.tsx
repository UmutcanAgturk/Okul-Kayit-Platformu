import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { FlatList, RefreshControl, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText, Screen, Subtitle, Title } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
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
  const { selectedStudent, isParent } = useStudentSelection();
  const path = selectedStudent ? `/api/students/${selectedStudent.studentId}/installments` : null;
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ installments: PaymentInstallment[] }>(path);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);

  async function uploadReceipt(installmentId: string) {
    if (!selectedStudent) return;
    const res = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    const a = res.assets[0];
    const mime = a.mimeType ?? 'image/jpeg';
    setBusyId(installmentId); setPayErr(null);
    try {
      await api.post(`/api/students/${selectedStudent.studentId}/payment-receipts`, {
        installmentId, fileName: a.fileName ?? 'dekont.jpg', mimeType: mime, dataUrl: `data:${mime};base64,${a.base64}`,
      });
      await refetch();
    } catch (e) { setPayErr(e instanceof ApiError ? e.message : 'Dekont yüklenemedi'); }
    finally { setBusyId(null); }
  }

  async function pay(installmentId: string) {
    if (!selectedStudent) return;
    setBusyId(installmentId); setPayErr(null);
    try {
      await api.post(`/api/students/${selectedStudent.studentId}/installments/${installmentId}/pay`);
      await refetch();
    } catch (e) {
      setPayErr(e instanceof ApiError ? e.message : 'Ödeme yapılamadı');
    } finally { setBusyId(null); }
  }

  if (!selectedStudent) {
    return <Screen><EmptyState message="Taksitleri görüntülemek için bir öğrenci seçin." /></Screen>;
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4, gap: 6 }}>
          <Title>Taksitler</Title>
          <Subtitle>{selectedStudent.fullName}</Subtitle>
          {error && <ErrorBanner message={error} />}
          {payErr && <ErrorBanner message={payErr} />}
        </View>
      }
      data={data?.installments ?? []}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={!loading ? <EmptyState message="Taksit kaydı bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 4 }}>
              <Label>{item.installmentNo}. Taksit</Label>
              <MutedText>Vade: {formatDate(item.dueDate)}</MutedText>
              {item.paidAt && <MutedText>Ödendi: {formatDate(item.paidAt)}</MutedText>}
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Label>{formatAmount(item.amount)}</Label>
              <Chip label={item.status === 'PAID' ? 'Ödendi' : 'Bekliyor'} tone={item.status === 'PAID' ? 'success' : 'warning'} />
            </View>
          </View>
          {isParent && item.status === 'PENDING' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Online Öde" onPress={() => pay(item.id)} loading={busyId === item.id} />
              <Button title="Dekont Yükle" variant="secondary" onPress={() => uploadReceipt(item.id)} loading={busyId === item.id} />
            </View>
          )}
        </Card>
      )}
    />
  );
}
