import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Card, EmptyState, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';

interface Result {
  students: { id: string; name: string; studentNo: string }[];
  staff: { id: string; name: string; title: string | null }[];
  institutions: { id: string; name: string }[];
}

export default function AramaScreen() {
  const [q, setQ] = useState('');
  const { data, loading, error } = useApiQuery<Result>(q.trim().length >= 2 ? `/api/command-palette-search?q=${encodeURIComponent(q.trim())}` : null);
  const empty = !!data && (data.students.length + data.staff.length + data.institutions.length) === 0;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Field label="Genel Arama" value={q} onChangeText={setQ} placeholder="Öğrenci, personel, kurum…" autoCapitalize="none" />
      {error && <ErrorBanner message={error} />}
      {q.trim().length < 2 && <MutedText>En az 2 karakter yazın.</MutedText>}
      {empty && !loading && <EmptyState message="Sonuç bulunamadı." icon="search-outline" />}
      {(data?.institutions.length ?? 0) > 0 && <Subtitle>Kurumlar</Subtitle>}
      {data?.institutions.map((i) => <Card key={i.id}><Label>{i.name}</Label></Card>)}
      {(data?.students.length ?? 0) > 0 && <Subtitle>Öğrenciler</Subtitle>}
      {data?.students.map((s) => <Card key={s.id}><Label>{s.name}</Label><MutedText>No: {s.studentNo}</MutedText></Card>)}
      {(data?.staff.length ?? 0) > 0 && <Subtitle>Personel</Subtitle>}
      {data?.staff.map((s) => <Card key={s.id}><Label>{s.name}</Label><MutedText>{s.title ?? ''}</MutedText></Card>)}
    </ScrollView>
  );
}
