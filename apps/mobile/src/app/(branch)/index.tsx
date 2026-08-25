import { ScrollView, View } from 'react-native';

import { ModuleHub, type HubModule } from '@/components/module-hub';
import { HqBranchBar } from '@/components/hq-branch-bar';
import { MutedText, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const MODULES: HubModule[] = [
  { title: 'Bugün', description: 'Günlük özet', icon: 'today', route: '/(branch)/bugun' },
  { title: 'Günlük Operasyon', description: 'Ödeme/etüt', icon: 'clipboard', route: '/(branch)/gunluk-operasyon' },
  { title: 'Öğrenciler', description: 'Kayıt & arama', icon: 'school', route: '/(branch)/ogrenciler' },
  { title: 'Taksitler', description: 'Tahsilat', icon: 'card', route: '/(branch)/installments' },
  { title: 'Muhasebe', description: 'Gelir/gider defteri', icon: 'wallet', route: '/(branch)/ledger' },
  { title: 'Belgeler', description: 'Fatura/dekont/senet/bordro', icon: 'document-text', route: '/(branch)/belgeler' },
  { title: 'Dekont Onayı', description: 'Veli dekontları', icon: 'receipt', route: '/(branch)/dekont-onay' },
  { title: 'Mali Özet', description: 'KDV/stopaj/yaşlandırma', icon: 'analytics', route: '/(branch)/mali-ozet' },
  { title: 'Resmi Muhasebe', description: 'Bilanço/gelir tablosu/cari', icon: 'library', route: '/(branch)/resmi-muhasebe' },
  { title: 'Mesaj Şablonları', description: 'Hazır duyurular', icon: 'documents', route: '/(branch)/mesaj-sablonlari' },
  { title: 'Personel Yoklama', description: 'Günlük personel', icon: 'people-circle', route: '/(branch)/personel-yoklama' },
  { title: 'Vergi Ayarları', description: 'Vergi no/dairesi', icon: 'settings', route: '/(branch)/vergi-ayarlari' },
  { title: 'Risk Öğrenciler', description: 'Kritik kazanım zayıf', icon: 'alert-circle', route: '/(branch)/risk-ogrenciler' },
  { title: 'Kazanım Özeti', description: 'Sınav kazanım analizi', icon: 'analytics', route: '/(branch)/kazanim-ozeti' },
  { title: 'Kazanımlar', description: 'Müfredat kazanım listesi', icon: 'library', route: '/(branch)/kazanimlar' },
  { title: 'Sınıflar', description: 'Sınıf detayı + program', icon: 'grid', route: '/(branch)/siniflar' },
  { title: 'Öğretmenler', description: 'Kadro + mentör havuzu', icon: 'people', route: '/(branch)/ogretmenler' },
  { title: 'Ödeme Analizi', description: 'Yöntem dağılımı + durum', icon: 'pie-chart', route: '/(branch)/odeme-analizi' },
  { title: 'Senetler', description: 'Senet takibi + ödendi', icon: 'document', route: '/(branch)/senetler' },
  { title: 'Personel', description: 'Kadro', icon: 'people', route: '/(branch)/personel' },
  { title: 'Öğretmen Performansı', description: 'Başarı ortalaması', icon: 'stats-chart', route: '/(branch)/ogretmen-performansi' },
  { title: 'Aktivite Akışı', description: 'Denetim izi', icon: 'time', route: '/(branch)/aktivite' },
  { title: 'İletişim', description: 'Gelen mesajlar', icon: 'mail', route: '/(branch)/iletisim' },
  { title: 'CRM', description: 'Aday takibi', icon: 'people-circle', route: '/(branch)/crm' },
  { title: 'Öğrenci Ön Kayıt', description: 'Kayıt adayları', icon: 'document-text', route: '/(branch)/on-kayit' },
  { title: 'Normal Kayıt', description: 'Adayı tam kayda çevir', icon: 'checkmark-circle', route: '/(branch)/normal-kayit' },
  { title: 'Ders Programı', description: 'Haftalık program', icon: 'time', route: '/(branch)/ders-programi' },
  { title: 'Servis', description: 'Güzergahlar', icon: 'bus', route: '/(branch)/servis' },
  { title: 'Kulüpler', description: 'Kulüp yönetimi', icon: 'star', route: '/(branch)/kulupler' },
  { title: 'Lider Tablosu', description: 'XP sıralaması', icon: 'trophy', route: '/(branch)/lider-tablosu' },
  { title: 'Ölçme-Değerlendirme', description: 'Sınavlar', icon: 'clipboard', route: '/(branch)/olcme-degerlendirme' },
  { title: 'Disiplin', description: 'Davranış kayıtları', icon: 'shield-checkmark', route: '/(branch)/disiplin' },
  { title: 'Veli Görüşmeleri', description: 'Randevu talepleri', icon: 'chatbubbles', route: '/(branch)/veli-gorusme' },
  { title: 'Etüt', description: 'Etüt seansları', icon: 'book', route: '/(branch)/etut' },
  { title: 'Seviye Mentör', description: 'Mentör havuzu', icon: 'person-add', route: '/(branch)/mentor' },
  { title: 'Roller', description: 'Kullanıcı adları', icon: 'key', route: '/(branch)/roller' },
  { title: 'Ödeme Yöntemleri', description: 'Öğrenci bazlı', icon: 'card', route: '/(branch)/odeme-yontemleri' },
  { title: 'Devamsızlık', description: 'Sınıf yoklama özeti', icon: 'calendar', route: '/(branch)/devamsizlik' },
  { title: 'Karne', description: 'Öğrenci karnesi', icon: 'document-text', route: '/(branch)/karne' },
  { title: 'Raporlar', description: 'Mali özet', icon: 'download', route: '/(branch)/raporlar' },
  { title: 'Takvim', description: 'Etkinlik takvimi', icon: 'calendar-outline', route: '/(branch)/takvim' },
  { title: 'Ödevler', description: 'Ödev takibi', icon: 'book-outline', route: '/(branch)/odevler' },
  { title: 'Kurslar', description: 'Ders kataloğu', icon: 'library-outline', route: '/(branch)/kurslar' },
  { title: 'Yemekhane', description: 'Menü planı', icon: 'restaurant-outline', route: '/(branch)/yemekhane' },
  { title: 'Sağlık / Revir', description: 'Vaka & tarama', icon: 'medkit-outline', route: '/(branch)/saglik' },
  { title: 'Sosyal Etkinlik', description: 'Etkinlik & katılım', icon: 'sparkles-outline', route: '/(branch)/etkinlikler' },
  { title: 'Rehberlik Olay', description: 'Vaka takibi', icon: 'flag-outline', route: '/(branch)/rehberlik-olay' },
  { title: 'Anketler', description: 'Memnuniyet anketi', icon: 'stats-chart-outline', route: '/(branch)/anketler' },
  { title: 'Görevler & Onaylar', description: 'İş akışı', icon: 'checkbox-outline', route: '/(branch)/gorevler' },
  { title: 'Ziyaretçi', description: 'Giriş/çıkış kaydı', icon: 'people-outline', route: '/(branch)/ziyaretci' },
  { title: 'Mezunlar', description: 'Mezun takibi', icon: 'ribbon-outline', route: '/(branch)/mezunlar' },
  { title: 'Dönem Geçişleri', description: 'Akademik yıl & geçiş', icon: 'swap-horizontal-outline', route: '/(branch)/donem-gecisleri' },
  { title: 'Güvenlik', description: '2FA kurulumu', icon: 'lock-closed', route: '/(branch)/guvenlik' },
];

export default function BranchHubScreen() {
  const { user } = useAuth();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* SUPERADMIN ise şube bağlamı çubuğu; şube rollerinde null döner. */}
      <HqBranchBar mode="bar" />
      <View>
        <Title>Merhaba, {user?.firstName}</Title>
        <MutedText>Şube Yönetimi</MutedText>
      </View>
      <ModuleHub modules={MODULES} />
    </ScrollView>
  );
}
