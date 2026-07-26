import { ScrollView, View } from 'react-native';

import { Card, Chip, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudySession } from '@/lib/types';

export default function TeacherHomeScreen() {
  const { user } = useAuth();
  const { data } = useApiQuery<{ sessions: StudySession[] }>('/api/teacher/study-sessions');
  const pendingCount = (data?.sessions ?? []).filter((s) => s.status === 'AI_SUGGESTED').length;

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>Öğretmen Portalı</MutedText>
        </View>

        <Card style={{ gap: 8 }}>
          <Label>Yanıt Bekleyen Etüt Talepleri</Label>
          <Chip
            label={pendingCount > 0 ? `${pendingCount} talep bekliyor` : 'Bekleyen talep yok'}
            tone={pendingCount > 0 ? 'warning' : 'success'}
          />
          <MutedText>Detaylar için Etüt Seansları sekmesine geçin.</MutedText>
        </Card>

        <Card style={{ gap: 8 }}>
          <Label>AI Sınıf Röntgeni</Label>
          <MutedText>
            Bir sınavın kazanım ısı haritasını görmek için Sınıf Röntgeni sekmesinden sınav ve
            sınıf bilgisini girin.
          </MutedText>
        </Card>
      </Screen>
    </ScrollView>
  );
}
