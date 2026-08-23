import { FlatList, View } from 'react-native';
import { Card, Chip, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { EnrollmentRow } from '@/lib/types';

const STAGE: Record<string, { label: string; tone: 'success' | 'warning' | 'neutral' | 'critical' }> = {
  ON_KAYIT_ALINDI: { label: 'Ön Kayıt', tone: 'warning' },
  SOZLESME_BEKLENIYOR: { label: 'Sözleşme Bekliyor', tone: 'warning' },
  ODEME_PLANI_OLUSTURULDU: { label: 'Ödeme Planı', tone: 'neutral' },
  KAYIT_TAMAMLANDI: { label: 'Tamamlandı', tone: 'success' },
  IPTAL_EDILDI: { label: 'İptal', tone: 'critical' },
};

export default function OnKayitScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ enrollments: EnrollmentRow[] }>('/api/branch/enrollments');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.enrollments ?? []} keyExtractor={(e) => e.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kayıt bulunamadı." icon="document-text-outline" /> : null}
      renderItem={({ item }) => {
        const s = STAGE[item.stage] ?? { label: item.stage, tone: 'neutral' as const };
        return (
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>{item.candidateFullName}</Label>
              <Chip label={s.label} tone={s.tone} />
            </View>
            <MutedText>{item.candidateGradeLevel} · {item.programType} · {item.type}</MutedText>
            <MutedText>Veli: {item.guardianFullName} · {item.guardianPhone}</MutedText>
          </Card>
        );
      }}
    />
  );
}
