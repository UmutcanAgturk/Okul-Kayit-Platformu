import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const MODULES: HubModule[] = [
  { title: 'Bugün', description: 'Günlük özet', icon: 'today', route: '/(branch)/bugun' },
  { title: 'Günlük Operasyon', description: 'Ödeme/etüt', icon: 'clipboard', route: '/(branch)/gunluk-operasyon' },
  { title: 'Öğrenciler', description: 'Kayıt & arama', icon: 'school', route: '/(branch)/ogrenciler' },
  { title: 'Taksitler', description: 'Tahsilat', icon: 'card', route: '/(branch)/installments' },
  { title: 'Muhasebe', description: 'Gelir/gider defteri', icon: 'wallet', route: '/(branch)/ledger' },
  { title: 'Personel', description: 'Kadro', icon: 'people', route: '/(branch)/personel' },
  { title: 'Öğretmen Performansı', description: 'Başarı ortalaması', icon: 'stats-chart', route: '/(branch)/ogretmen-performansi' },
  { title: 'Aktivite Akışı', description: 'Denetim izi', icon: 'time', route: '/(branch)/aktivite' },
  { title: 'İletişim', description: 'Gelen mesajlar', icon: 'mail', route: '/(branch)/iletisim' },
];

export default function BranchHubScreen() {
  const { user } = useAuth();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>Şube Yönetimi</MutedText>
      </View>
      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
