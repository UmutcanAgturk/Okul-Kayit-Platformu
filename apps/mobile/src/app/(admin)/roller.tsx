import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqRoleStudentRow } from '@/lib/types';

export default function HqRollerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: HqRoleStudentRow[] }>('/api/hq/roles/students');
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.students ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={error ? <ErrorBanner message={error} /> : null}
      ListEmptyComponent={!loading ? <EmptyState message="Kullanıcı yok." icon="key-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label><MutedText>{item.tenantName}</MutedText>
          </View>
          <MutedText>No: {item.studentNo} · Kullanıcı: {item.username}{item.classroomName ? ` · ${item.classroomName}` : ''}</MutedText>
        </Card>
      )}
    />
  );
}
