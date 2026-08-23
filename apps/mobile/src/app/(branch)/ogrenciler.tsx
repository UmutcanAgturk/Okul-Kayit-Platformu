import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { BranchStudentRow } from '@/lib/types';

export default function OgrencilerScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: BranchStudentRow[] }>('/api/branch/students');
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const all = data?.students ?? [];
    if (!q.trim()) return all;
    const t = q.toLocaleLowerCase('tr');
    return all.filter((s) => s.name.toLocaleLowerCase('tr').includes(t) || s.studentNo.includes(t));
  }, [data, q]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }}
      onRefresh={refetch} refreshing={refreshing}
      data={filtered}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Field label="Ara" value={q} onChangeText={setQ} placeholder="Ad veya öğrenci no" autoCapitalize="none" />
          {error && <ErrorBanner message={error} />}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci bulunamadı." /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label>
            <MutedText>{item.classroomName ?? 'Sınıfsız'}</MutedText>
          </View>
          <MutedText>No: {item.studentNo} · {item.gradeLevel}</MutedText>
          {item.guardianName ? <MutedText>Veli: {item.guardianName}{item.guardianPhone ? ` · ${item.guardianPhone}` : ''}</MutedText> : null}
        </Card>
      )}
    />
  );
}
