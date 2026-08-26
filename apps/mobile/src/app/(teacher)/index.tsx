import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { Card, Chip, Label, MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudySession } from '@/lib/types';

const MODULES: HubModule[] = [
  { title: 'Sınıflarım', description: 'Öğrenci listeleri', icon: 'people', route: '/(teacher)/siniflarim' },
  { title: 'Etüt Onayı', description: 'AI önerileri', icon: 'book', route: '/(teacher)/study-sessions' },
  { title: 'AI Sınıf Röntgeni', description: 'Kazanım ısı haritası', icon: 'analytics', route: '/(teacher)/class-xray' },
  { title: 'Ders Programı', description: 'Haftalık program', icon: 'time', route: '/(teacher)/ders-programi' },
  { title: 'Veli Görüşmeleri', description: 'Randevu onayı', icon: 'chatbubbles', route: '/(teacher)/veli-gorusme' },
  { title: 'Mentörlük', description: 'Danışan öğrenciler', icon: 'person-add', route: '/(teacher)/mentorluk' },
  { title: 'Kulüplerim', description: 'Danışman kulüpler', icon: 'star', route: '/(teacher)/kulupler' },
  { title: 'Yoklama Al', description: 'Sınıf yoklaması', icon: 'checkbox', route: '/(teacher)/yoklama' },
  { title: 'İletişim', description: 'Gelen mesajlar', icon: 'mail', route: '/(teacher)/iletisim' },
  { title: 'Ölçme-Değerlendirme', description: 'Sınavlar', icon: 'clipboard', route: '/(teacher)/olcme-degerlendirme' },
  { title: 'Mobil Optik Okuyucu', description: 'Fotoğrafla AI optik okuma', icon: 'scan', route: '/(teacher)/optik-okuyucu' },
  { title: 'Mesajlaşma', description: 'Velilerle bire bir', icon: 'chatbubbles', route: '/(teacher)/mesajlasma' },
  { title: 'Disiplin', description: 'Davranış kayıtları', icon: 'shield-checkmark', route: '/(teacher)/disiplin' },
  { title: 'Karne', description: 'Öğrenci karnesi', icon: 'document-text', route: '/(teacher)/karne' },
  { title: 'Lider Tablosu', description: 'Sınıf sıralaması', icon: 'trophy', route: '/(teacher)/lider-tablosu' },
  { title: 'Kazanım Özeti', description: 'Kazanım bazlı başarı', icon: 'analytics', route: '/(teacher)/kazanim-ozeti' },
  { title: 'Güvenlik', description: '2FA kurulumu', icon: 'lock-closed', route: '/(teacher)/guvenlik' },
];

export default function TeacherHubScreen() {
  const { user } = useAuth();
  const { data } = useApiQuery<{ sessions: StudySession[] }>('/api/teacher/study-sessions');
  const pending = (data?.sessions ?? []).filter((s) => s.status === 'AI_SUGGESTED').length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>Öğretmen Portalı</MutedText>
      </View>

      <Card style={{ gap: 8 }}>
        <Label>Yanıt Bekleyen Etüt Talepleri</Label>
        <Chip label={pending > 0 ? `${pending} talep bekliyor` : 'Bekleyen talep yok'} tone={pending > 0 ? 'warning' : 'success'} />
      </Card>

      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
