import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function AdminPortalLayout() {
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
      <Tabs.Screen name="muhasebe" options={{ title: 'Muhasebe', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />

      <Tabs.Screen name="kurumlar" options={{ ...hidden, title: 'Kurum Yönetimi' }} />
      <Tabs.Screen name="analytics" options={{ ...hidden, title: 'Global Analytics' }} />
      <Tabs.Screen name="sube-haritasi" options={{ ...hidden, title: 'Şube Performansı' }} />
      <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'İletişim' }} />
      <Tabs.Screen name="roller" options={{ ...hidden, title: 'Roller' }} />
      <Tabs.Screen name="olcme-degerlendirme" options={{ ...hidden, title: 'Genel Sınav Merkezi' }} />
      <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'Güvenlik' }} />
    </Tabs>
  );
}
