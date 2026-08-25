import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { HqBranchBar } from '@/components/hq-branch-bar';
import { Label, MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const MODULES: HubModule[] = [
  { title: 'Şube Performansı', description: 'Doluluk/tahsilat/ciro', icon: 'map', route: '/(admin)/sube-haritasi' },
  { title: 'Kurum Yönetimi', description: 'Ekle/düzenle/pasifleştir', icon: 'business', route: '/(admin)/kurumlar' },
  { title: 'Öğrenciler', description: 'Tüm şubeler arama', icon: 'school', route: '/(admin)/ogrenciler' },
  { title: 'Mesaj Yayını', description: 'Tüm sisteme duyuru', icon: 'megaphone', route: '/(admin)/mesaj-yayini' },
  { title: 'Tahsilat Oranları', description: 'Şube bazlı tahsilat', icon: 'stats-chart', route: '/(admin)/tahsilat-oranlari' },
  { title: 'Sınav Dağıtımı', description: 'Kitapçık kargo takibi', icon: 'cube', route: '/(admin)/sinav-dagitimi' },
  { title: 'Genel Arama', description: 'Öğrenci/personel/kurum', icon: 'search', route: '/(admin)/arama' },
  { title: 'Sınav Karşılaştırma', description: 'Şube ortalamaları', icon: 'bar-chart', route: '/(admin)/sinav-karsilastirma' },
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

      {/* Şube bağlamı: bir şube seçip o şubenin TÜM operasyonel modüllerini
          (kayıt, sınıflar, personel, disiplin…) görüp düzenleyin. */}
      <HqBranchBar mode="launcher" />

      <View style={{ gap: 4 }}>
        <Label>Genel (Tüm Şubeler)</Label>
        <MutedText>Aşağıdaki modüller tüm şubelerin verisini birleşik (konsolide) gösterir.</MutedText>
      </View>
      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
