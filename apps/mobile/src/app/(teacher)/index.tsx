import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { Card, Chip, Label, MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';
import type { StudySession } from '@/lib/types';

const MODULES: HubModule[] = [
  { title: 'SÄ±nÄ±flarÄ±m', description: 'ÃÄrenci listeleri', icon: 'people', route: '/(teacher)/siniflarim' },
  { title: 'EtÃ¼t OnayÄ±', description: 'AI Ã¶nerileri', icon: 'book', route: '/(teacher)/study-sessions' },
  { title: 'AI SÄ±nÄ±f RÃ¶ntgeni', description: 'KazanÄ±m Ä±sÄ± haritasÄ±', icon: 'analytics', route: '/(teacher)/class-xray' },
  { title: 'Ders ProgramÄ±', description: 'HaftalÄ±k program', icon: 'time', route: '/(teacher)/ders-programi' },
  { title: 'Veli GÃ¶rÃ¼Åmeleri', description: 'Randevu onayÄ±', icon: 'chatbubbles', route: '/(teacher)/veli-gorusme' },
  { title: 'MentÃ¶rlÃ¼k', description: 'DanÄ±Åan Ã¶Ärenciler', icon: 'person-add', route: '/(teacher)/mentorluk' },
  { title: 'KulÃ¼plerim', description: 'DanÄ±Åman kulÃ¼pler', icon: 'star', route: '/(teacher)/kulupler' },
  { title: 'Yoklama Al', description: 'SÄ±nÄ±f yoklamasÄ±', icon: 'checkbox', route: '/(teacher)/yoklama' },
  { title: 'Ä°letiÅim', description: 'Gelen mesajlar', icon: 'mail', route: '/(teacher)/iletisim' },
  { title: 'ÃlÃ§me-DeÄerlendirme', description: 'SÄ±navlar', icon: 'clipboard', route: '/(teacher)/olcme-degerlendirme' },
  { title: 'Mobil Optik Okuyucu', description: 'FotoÄrafla AI optik okuma', icon: 'scan', route: '/(teacher)/optik-okuyucu' },
  { title: 'Mesajlaşma', description: 'Velilerle bire bir', icon: 'chatbubbles', route: '/(teacher)/mesajlasma' },
  { title: 'Disiplin', description: 'DavranÄ±Å kayÄ±tlarÄ±', icon: 'shield-checkmark', route: '/(teacher)/disiplin' },
  { title: 'Karne', description: 'ÃÄrenci karnesi', icon: 'document-text', route: '/(teacher)/karne' },
  { title: 'Lider Tablosu', description: 'SÄ±nÄ±f sÄ±ralamasÄ±', icon: 'trophy', route: '/(teacher)/lider-tablosu' },
  { title: 'KazanÄ±m Ãzeti', description: 'KazanÄ±m bazlÄ± baÅarÄ±', icon: 'analytics', route: '/(teacher)/kazanim-ozeti' },
  { title: 'GÃ¼venlik', description: '2FA kurulumu', icon: 'lock-closed', route: '/(teacher)/guvenlik' },
];

export default function TeacherHubScreen() {
  const { user } = useAuth();
  const { data } = useApiQuery<{ sessions: StudySession[] }>('/api/teacher/study-sessions');
  const pending = (data?.sessions ?? []).filter((s) => s.status === 'AI_SUGGESTED').length;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>ÃÄretmen PortalÄ±</MutedText>
      </View>

      <Card style={{ gap: 8 }}>
        <Label>YanÄ±t Bekleyen EtÃ¼t Talepleri</Label>
        <Chip label={pending > 0 ? `${pending} talep bekliyor` : 'Bekleyen talep yok'} tone={pending > 0 ? 'warning' : 'success'} />
      </Card>

      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
