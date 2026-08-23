import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function BranchPortalLayout() {
  const theme = useTheme();
  const hidden = { href: null as null };
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.backgroundElement },
        headerTintColor: theme.text,
        tabBarActiveTintColor: theme.brand,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Modüller', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="installments" options={{ title: 'Taksitler', tabBarIcon: ({ color, size }) => <Ionicons name="card" size={size} color={color} /> }} />
      <Tabs.Screen name="ledger" options={{ title: 'Muhasebe', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />

      {/* Modül ekranları — hub'dan açılır */}
      <Tabs.Screen name="bugun" options={{ ...hidden, title: 'Bugün' }} />
      <Tabs.Screen name="gunluk-operasyon" options={{ ...hidden, title: 'Günlük Operasyon' }} />
      <Tabs.Screen name="ogrenciler" options={{ ...hidden, title: 'Öğrenciler' }} />
      <Tabs.Screen name="personel" options={{ ...hidden, title: 'Personel' }} />
      <Tabs.Screen name="ogretmen-performansi" options={{ ...hidden, title: 'Öğretmen Performansı' }} />
      <Tabs.Screen name="aktivite" options={{ ...hidden, title: 'Aktivite Akışı' }} />
      <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'İletişim' }} />
      <Tabs.Screen name="crm" options={{ ...hidden, title: 'CRM' }} />
      <Tabs.Screen name="on-kayit" options={{ ...hidden, title: 'Öğrenci Ön Kayıt' }} />
      <Tabs.Screen name="ders-programi" options={{ ...hidden, title: 'Ders Programı' }} />
      <Tabs.Screen name="servis" options={{ ...hidden, title: 'Servis' }} />
      <Tabs.Screen name="kulupler" options={{ ...hidden, title: 'Kulüpler' }} />
      <Tabs.Screen name="lider-tablosu" options={{ ...hidden, title: 'Lider Tablosu' }} />
      <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'Güvenlik' }} />
    </Tabs>
  );
}
