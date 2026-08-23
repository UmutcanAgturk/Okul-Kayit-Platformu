import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { CrmLead } from '@/lib/types';

const STAGE: Record<string, string> = { ARANDI: 'Arandı', GORUSULDU: 'Görüşüldü', DENEME_SINAVINA_GIRDI: 'Deneme Sınavı', KAYIT_OLDU: 'Kayıt Oldu' };

export default function CrmScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ leads: CrmLead[] }>('/api/branch/crm-leads');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.leads ?? []} keyExtractor={(l) => l.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Aday kaydı yok." icon="people-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>{item.candidateFullName}</Label>
            <Chip label={STAGE[item.stage] ?? item.stage} tone={item.stage === 'KAYIT_OLDU' ? 'success' : 'neutral'} />
          </View>
          <MutedText>{item.candidateGradeLevel}{item.school ? ` · ${item.school}` : ''}</MutedText>
          <MutedText>Veli: {item.guardianFullName} · {item.guardianPhone}</MutedText>
          {item.notes ? <MutedText>{item.notes}</MutedText> : null}
        </Card>
      )}
    />
  );
}
