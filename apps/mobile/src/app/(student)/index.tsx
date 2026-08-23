import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { Card, Chip, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useStudentSelection } from '@/lib/student-selection';

const MODULES: HubModule[] = [
  { title: 'Karne', description: 'Sınav geçmişi ve başarı', icon: 'document-text', route: '/(student)/karne' },
  { title: 'Sınav Sonuçlarım', description: 'Doğru/yanlış/net', icon: 'stats-chart', route: '/(student)/sinav-sonuclarim' },
  { title: 'Devamsızlığım', description: 'Yoklama geçmişi', icon: 'calendar', route: '/(student)/devamsizligim' },
  { title: 'Ders Programı', description: 'Haftalık program', icon: 'time', route: '/(student)/ders-programi' },
  { title: 'Akademik Yol Haritam', description: 'Hedef ve tavsiye', icon: 'map', route: '/(student)/yol-haritasi' },
  { title: 'Başarı Rozetlerim', description: 'XP, seviye, rozetler', icon: 'trophy', route: '/(student)/basari' },
  { title: 'Davranış Notlarım', description: 'Olumlu/olumsuz', icon: 'shield-checkmark', route: '/(student)/davranis-notlarim' },
  { title: 'QR Sınav Belgesi', description: 'Salon/sıra bilgisi', icon: 'qr-code', route: '/(student)/sinav-belgesi' },
  { title: 'Ödeme İşlemleri', description: 'Taksit durumu', icon: 'wallet', route: '/(student)/installments' },
];

export default function StudentHubScreen() {
  const { user } = useAuth();
  const { students, studentId, setStudentId, isParent } = useStudentSelection();

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>{isParent ? 'Veli Portalı' : 'Öğrenci Portalı'}</MutedText>
      </View>

      {isParent && students.length > 1 && (
        <Card style={{ gap: 10 }}>
          <Label>Öğrenci</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {students.map((s) => (
              <Chip
                key={s.studentId}
                label={s.fullName}
                tone="brand"
                selected={s.studentId === studentId}
                onPress={() => setStudentId(s.studentId)}
              />
            ))}
          </View>
        </Card>
      )}

      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
