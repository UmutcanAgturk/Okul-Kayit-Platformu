import { ScrollView, View } from 'react-native';

import { Card, CenterLoading, EmptyState, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useStudentSelection } from '@/lib/student-selection';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudentGamification } from '@/lib/types';

export default function BasariScreen() {
  const { studentId } = useStudentSelection();
  const theme = useTheme();
  const { data, loading, error } = useApiQuery<StudentGamification>(
    studentId ? `/api/students/${studentId}/gamification` : null,
  );

  if (loading) return <CenterLoading />;
  if (error) return <View style={{ padding: 16 }}><ErrorBanner message={error} /></View>;
  if (!data) return <EmptyState message="Rozet verisi yok." />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <StatTile icon="star" label="Seviye" value={String(data.level)} />
        <StatTile icon="flash" label="XP" value={String(data.xp)} tone="warning" />
        <StatTile icon="podium" label="Sınıf Sırası" value={data.classRank ? `${data.classRank}/${data.classSize}` : '—'} />
      </View>

      <Card style={{ gap: 8 }}>
        <Label>Sonraki Seviyeye</Label>
        <View style={{ height: 10, borderRadius: 6, backgroundColor: theme.border, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, Math.max(0, data.progressPct))}%`, height: 10, backgroundColor: theme.brand }} />
        </View>
        <MutedText>{data.xpIntoLevel} / {data.xpForNextLevel} XP</MutedText>
      </Card>

      {data.badges && data.badges.length > 0 && (
        <View style={{ gap: 8 }}>
          <Subtitle>Rozetler</Subtitle>
          {data.badges.map((b) => (
            <Card key={b.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: b.earned ? 1 : 0.45 }}>
              <View style={{ flex: 1 }}>
                <Label>{b.label}</Label>
                <MutedText>{b.desc}</MutedText>
              </View>
              <MutedText>{b.earned ? '✓' : '🔒'}</MutedText>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
