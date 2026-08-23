import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const MODULES: HubModule[] = [
  { title: 'Şube Performansı', description: 'Doluluk/tahsilat/ciro', icon: 'map', route: '/(admin)/sube-haritasi' },
  { title: 'Kurum Yönetimi', description: 'Ekle/düzenle/pasifleştir', icon: 'business', route: '/(admin)/kurumlar' },
  { title: 'Öğrenciler', description: 'Tüm şubeler arama', icon: 'school', route: '/(admin)/ogrenciler' },
  { title: 'Mesaj Yayını', description: 'Tüm sisteme duyuru', icon: 'megaphone', route: '/(admin)/mesaj-yayini' },
  { title: 'Global Analytics', description: 'Org geneli başarı', icon: 'analytics', route: '/(admin)/analytics' },
  { title: 'Konsolide Muhasebe', description: 'Tüm kurumlar mali', icon: 'wallet', route: '/(admin)/muhasebe' },
  { title: 'İletişim', description: 'Gelen mesajlar', icon: 'mail', route: '/(admin)/iletisim' },
  { title: 'Roller', description: 'Tüm kullanıcılar', icon: 'key', route: '/(admin)/roller' },
  { title: 'Genel Sınav Merkezi', description: 'Ağ sınavları', icon: 'clipboard', route: '/(admin)/olcme-degerlendirme' },
  { title: 'Güvenlik', description: '2FA kurulumu', icon: 'lock-closed', route: '/(admin)/guvenlik' },
];

export default function AdminHubScreen() {
  const { user } = useAuth();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>Genel Merkez · Superadmin</MutedText>
      </View>
      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
