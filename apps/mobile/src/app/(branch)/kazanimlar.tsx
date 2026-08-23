import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';

interface Achievement { id: string; code: string; label: string; subject: string; gradeLevel?: number; }

export default function KazanimlarScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ achievements: Achievement[] }>('/api/curriculum/achievements');
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const all = data?.achievements ?? [];
    if (!q.trim()) return all.slice(0, 80);
    const t = q.toLocaleLowerCase('tr');
    return all.filter((a) => a.label.toLocaleLowerCase('tr').includes(t) || a.code.toLocaleLowerCase('tr').includes(t) || a.subject.toLocaleLowerCase('tr').includes(t));
  }, [data, q]);
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }} onRefresh={refetch} refreshing={refreshing}
      data={filtered} keyExtractor={(a) => a.id}
      ListHeaderComponent={<View style={{ gap: 10, marginBottom: 4 }}><Field label="Kazanım Ara" value={q} onChangeText={setQ} placeholder="Ders veya kod" autoCapitalize="none" />{error && <ErrorBanner message={error} />}</View>}
      ListEmptyComponent={!loading ? <EmptyState message="Kazanım yok." icon="library-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>{item.code}</Label><MutedText>{item.subject}</MutedText></View>
          <MutedText>{item.label}</MutedText>
        </Card>
      )}
    />
  );
}
