import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { AtRiskStudentRow } from '@/lib/types';

export default function RiskOgrencilerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: AtRiskStudentRow[] }>('/api/branch/exams/at-risk-students');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.students ?? []} keyExtractor={(s) => s.studentId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : <MutedText>Kritik kazanımlarda zayıf öğrenciler.</MutedText>}
      ListEmptyComponent={!loading ? <EmptyState message="Risk altında öğrenci yok." icon="alert-circle-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label><MutedText>{item.classroomName ?? ''}</MutedText>
          </View>
          <MutedText>{item.criticalAchievements.length} kritik kazanım: {item.criticalAchievements.slice(0, 3).map((a) => a.label).join(', ')}{item.criticalAchievements.length > 3 ? '…' : ''}</MutedText>
        </Card>
      )}
    />
  );
}
