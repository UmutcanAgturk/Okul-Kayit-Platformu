import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqExam, HqExamBranchBreakdownRow } from '@/lib/types';

const STATUSES = ['HAZIRLANIYOR', 'BASILIYOR', 'KARGOYA_VERILDI', 'TESLIM_EDILDI'] as const;
const LABEL: Record<string, string> = { HAZIRLANIYOR: 'Hazırlanıyor', BASILIYOR: 'Basılıyor', KARGOYA_VERILDI: 'Kargoda', TESLIM_EDILDI: 'Teslim' };

function Breakdown({ examId, onBack }: { examId: string; onBack: () => void }) {
  const { data, loading, error, refetch } = useApiQuery<{ exam: { name: string }; branches: HqExamBranchBreakdownRow[] }>(`/api/hq/exams/${examId}/branch-breakdown`);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function setStatus(tenantId: string, status: string) {
    setBusyId(tenantId);
    try { await api.patch(`/api/hq/exams/${examId}/dispatch`, { tenantId, status }); await refetch(); } catch { /* */ } finally { setBusyId(null); }
  }
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={data?.branches ?? []} keyExtractor={(b) => b.tenantId}
      ListHeaderComponent={<View style={{ gap: 8, marginBottom: 4 }}><Pressable onPress={onBack}><Label>‹ Geri</Label></Pressable><Label>{data?.exam.name} — Dağıtım</Label>{error && <ErrorBanner message={error} />}</View>}
      ListEmptyComponent={!loading ? <EmptyState message="Şube yok." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8, opacity: busyId === item.tenantId ? 0.5 : 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.tenantName}</Label><MutedText>{item.studentCount} öğrenci · {item.opticFormCount} optik</MutedText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUSES.map((s) => <Chip key={s} label={LABEL[s]} tone={item.dispatchStatus === s ? 'success' : 'neutral'} selected={item.dispatchStatus === s} onPress={() => setStatus(item.tenantId, s)} />)}
          </View>
        </Card>
      )}
    />
  );
}

export default function SinavDagitimiScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ exams: HqExam[] }>('/api/hq/exams');
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <Breakdown examId={open} onBack={() => { setOpen(null); refetch(); }} />;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.exams ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Kitapçık dağıtımı için sınava dokunun.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Sınav yok." icon="clipboard-outline" /> : null}
      renderItem={({ item }) => (
        <Pressable onPress={() => setOpen(item.id)}>
          <Card style={{ gap: 4 }}>
            <Label>{item.name}</Label>
            <MutedText>{new Date(item.examDate).toLocaleDateString('tr-TR')} · {item.branchCount} şube · {item.studentCount} öğrenci</MutedText>
          </Card>
        </Pressable>
      )}
    />
  );
}
