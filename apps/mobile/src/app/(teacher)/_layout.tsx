import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function TeacherPortalLayout() {
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
      <Tabs.Screen name="study-sessions" options={{ title: 'Etüt Onayı', tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />

      {/* Modül ekranları — hub'dan açılır */}
      <Tabs.Screen name="siniflarim" options={{ ...hidden, title: 'Sınıflarım' }} />
      <Tabs.Screen name="class-xray" options={{ ...hidden, title: 'AI Sınıf Röntgeni' }} />
      <Tabs.Screen name="ders-programi" options={{ ...hidden, title: 'Ders Programı' }} />
      <Tabs.Screen name="veli-gorusme" options={{ ...hidden, title: 'Veli Görüşmeleri' }} />
      <Tabs.Screen name="mentorluk" options={{ ...hidden, title: 'Mentörlük' }} />
      <Tabs.Screen name="kulupler" options={{ ...hidden, title: 'Kulüplerim' }} />
      <Tabs.Screen name="yoklama" options={{ ...hidden, title: 'Yoklama Al' }} />
      <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'İletişim' }} />
      <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'Güvenlik' }} />
    </Tabs>
  );
}
