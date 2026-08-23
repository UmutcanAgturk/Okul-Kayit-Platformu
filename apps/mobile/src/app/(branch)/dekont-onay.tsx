import { useState } from 'react';
import { FlatList, Image, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface PendingReceipt {
  id: string; studentName: string; installmentNo: number; amount: string;
  fileName: string; mimeType: string; dataUrl: string; note: string | null;
  status: 'BEKLIYOR' | 'ONAYLANDI' | 'REDDEDILDI';
}

export default function DekontOnayScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ receipts: PendingReceipt[] }>('/api/branch/payment-receipts');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function review(id: string, decision: 'APPROVE' | 'REJECT') {
    setBusyId(id); setErr(null);
    try { await api.post(`/api/branch/payment-receipts/${id}/review`, { decision }); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'İşlem başarısız'); }
    finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.receipts ?? []} keyExtractor={(r) => r.id}
      ListHeaderComponent={(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Bekleyen dekont yok." icon="receipt-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.studentName}</Label>
            <Chip label={item.status === 'BEKLIYOR' ? 'Bekliyor' : item.status === 'ONAYLANDI' ? 'Onaylandı' : 'Reddedildi'}
              tone={item.status === 'BEKLIYOR' ? 'warning' : item.status === 'ONAYLANDI' ? 'success' : 'critical'} />
          </View>
          <MutedText>{item.installmentNo}. taksit · ₺{Math.round(parseFloat(item.amount)).toLocaleString('tr-TR')}</MutedText>
          {item.note ? <MutedText>{item.note}</MutedText> : null}
          {item.dataUrl?.startsWith('data:image') ? (
            <Image source={{ uri: item.dataUrl }} style={{ width: '100%', height: 200, borderRadius: 8, resizeMode: 'contain' }} />
          ) : <MutedText>{item.fileName}</MutedText>}
          {item.status === 'BEKLIYOR' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button title="Onayla" onPress={() => review(item.id, 'APPROVE')} loading={busyId === item.id} />
              <Button title="Reddet" variant="danger" onPress={() => review(item.id, 'REJECT')} loading={busyId === item.id} />
            </View>
          )}
        </Card>
      )}
    />
  );
}
