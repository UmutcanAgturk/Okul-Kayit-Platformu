import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Field, Label, MutedText } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import type { HqStudentRow } from '@/lib/types';

export default function HqOgrencilerScreen() {
  const [q, setQ] = useState('');
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: HqStudentRow[] }>(
    `/api/hq/students${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
  );
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12 }} onRefresh={refetch} refreshing={refreshing}
      data={data?.students ?? []} keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 4 }}>
          <Field label="Tüm Kurumlarda Ara" value={q} onChangeText={setQ} placeholder="Ad veya no" autoCapitalize="none" />
          {error && <ErrorBanner message={error} />}
        </View>
      }
      ListEmptyComponent={!loading ? <EmptyState message="Öğrenci bulunamadı." icon="school-outline" /> : null}
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Label>{item.name}</Label><MutedText>{item.tenantName}</MutedText>
          </View>
          <MutedText>No: {item.studentNo} · {item.gradeLevel}{item.classroomName ? ` · ${item.classroomName}` : ''}</MutedText>
          {item.guardianName ? <MutedText>Veli: {item.guardianName}</MutedText> : null}
        </Card>
      )}
    />
  );
}
