import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { Card, EmptyState, ErrorBanner, Field, Label, MutedText, Title } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';
import { GRADE_LEVEL_LABEL, type StudentRow } from '@/lib/types';

// Şube öğrenci roster'ı — apps/web/components/students-roster/StudentsRosterDashboard.tsx'in
// mobil karşılığı, salt-okunur (arama + liste). Sınıf atama gibi düzenleme
// işlemleri web'de kalır.
export default function StudentsScreen() {
  const { data, loading, refreshing, error, refetch } = useApiQuery<{ students: StudentRow[] }>(
    '/api/branch/students',
  );
  const [query, setQuery] = useState('');

  const students = data?.students ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLocaleLowerCase('tr-TR').includes(q) ||
        s.studentNo.includes(q) ||
        (s.classroomName ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
        (s.guardianName ?? '').toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [students, query]);

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refetch} />}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 4 }}>
          <Title>Öğrenciler</Title>
          <MutedText>{students.length} öğrenci</MutedText>
          {error && <ErrorBanner message={error} />}
          <Field
            label="Ara"
            value={query}
            onChangeText={setQuery}
            placeholder="İsim, öğrenci no, sınıf veya veli"
            autoCapitalize="none"
          />
        </View>
      }
      data={filtered}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        !loading ? (
          <EmptyState message={query ? 'Aramayla eşleşen öğrenci yok.' : 'Henüz kayıtlı öğrenci yok.'} icon="people-outline" />
        ) : null
      }
      renderItem={({ item }) => (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Label>{item.name}</Label>
            <MutedText>#{item.studentNo}</MutedText>
          </View>
          <MutedText>
            {GRADE_LEVEL_LABEL[item.gradeLevel] ?? item.gradeLevel}
            {item.classroomName ? ` · ${item.classroomName}` : ' · Sınıf atanmamış'}
          </MutedText>
          {item.guardianName && (
            <MutedText>
              Veli: {item.guardianName}
              {item.guardianPhone ? ` · ${item.guardianPhone}` : ''}
            </MutedText>
          )}
        </Card>
      )}
    />
  );
}
