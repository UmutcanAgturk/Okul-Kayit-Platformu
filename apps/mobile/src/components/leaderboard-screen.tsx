import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { LeaderboardRow } from '@/lib/types';

export function LeaderboardScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ rows: LeaderboardRow[] }>('/api/branch/leaderboard');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.rows ?? []} keyExtractor={(r) => r.studentId}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Sıralama verisi yok." icon="trophy-outline" /> : null}
      renderItem={({ item, index }) => (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Label>{index + 1}.</Label>
          <View style={{ flex: 1 }}>
            <Label>{item.name}</Label>
            <MutedText>{item.classroom ?? ''} · Sv {item.level} · {item.badgeCount} rozet</MutedText>
          </View>
          <Label>{item.xp} XP</Label>
        </Card>
      )}
    />
  );
}
