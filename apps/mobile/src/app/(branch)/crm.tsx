import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';
import type { CrmLead } from '@/lib/types';

const STAGES = ['ARANDI', 'GORUSULDU', 'DENEME_SINAVINA_GIRDI', 'KAYIT_OLDU'] as const;
const LABEL: Record<string, string> = { ARANDI: 'Arandı', GORUSULDU: 'Görüşüldü', DENEME_SINAVINA_GIRDI: 'Deneme Sınavı', KAYIT_OLDU: 'Kayıt Oldu' };

export default function CrmScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ leads: CrmLead[] }>('/api/branch/crm-leads');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function setStage(id: string, stage: string) {
    setBusyId(id); setErr(null);
    try { await api.patch(`/api/branch/crm-leads/${id}`, { stage }); await refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Güncellenemedi'); }
    finally { setBusyId(null); }
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.leads ?? []} keyExtractor={(l) => l.id}
      ListHeaderComponent={(error || err) ? <ErrorBanner message={error ?? err ?? ''} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Aday kaydı yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 8, opacity: busyId === item.id ? 0.5 : 1 }}>
          <Label>{item.candidateFullName}</Label>
          <MutedText>{item.candidateGradeLevel} · Veli: {item.guardianFullName} · {item.guardianPhone}</MutedText>
          <MutedText>Aşama:</MutedText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STAGES.map((s) => (
              <Pressable key={s} onPress={() => item.stage !== s && setStage(item.id, s)}>
                <Chip label={LABEL[s]} tone={item.stage === s ? 'success' : 'neutral'} selected={item.stage === s} />
              </Pressable>
            ))}
          </View>
        </Card>
      )}
    />
  );
}
