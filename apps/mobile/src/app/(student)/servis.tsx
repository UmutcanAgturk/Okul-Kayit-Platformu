import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText } from '@/components/ui';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentBusRoute } from '@/lib/types';

export default function ServisScreen() {
  const { studentId } = useStudentSelection();
  const { data, loading, error } = useApiQuery<StudentBusRoute>(studentId ? `/api/students/${studentId}/bus-route` : null);
  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data?.route) return <EmptyState message="Servis kaydınız yok." icon="bus-outline" />;
  const r = data.route;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card style={{ gap: 8 }}>
        <Label>{r.name}</Label>
        {r.driverName ? <MutedText>Şoför: {r.driverName}</MutedText> : null}
        {r.driverPhone ? <MutedText>Telefon: {r.driverPhone}</MutedText> : null}
        {r.stops ? <MutedText>Duraklar: {r.stops}</MutedText> : null}
      </Card>
    </ScrollView>
  );
}
