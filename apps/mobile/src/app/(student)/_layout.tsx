import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { StudentSelectionProvider } from '@/lib/student-selection';

/**
 * Öğrenci/Veli portalı. Alt sekme çubuğu sade tutulur (Modüller / Ödeme /
 * Profil); tüm modül ekranları `href: null` ile sekme çubuğundan gizlenir ama
 * Modüller hub'ından router.push ile açılır (web'deki DashboardHub deseni).
 */
export default function StudentPortalLayout() {
  const theme = useTheme();
  const hidden = { href: null as null };
  return (
    <StudentSelectionProvider>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.backgroundElement },
          headerTintColor: theme.text,
          tabBarActiveTintColor: theme.brand,
          tabBarInactiveTintColor: theme.textSecondary,
          tabBarStyle: { backgroundColor: theme.backgroundElement, borderTopColor: theme.border },
        }}>
        <Tabs.Screen
          name="index"
          options={{ title: 'Modüller', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="installments"
          options={{ title: 'Ödeme', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
        />

        {/* Modül ekranları — sekme çubuğunda gizli, hub'dan açılır */}
        <Tabs.Screen name="karne" options={{ ...hidden, title: 'Karne' }} />
        <Tabs.Screen name="sinav-sonuclarim" options={{ ...hidden, title: 'Sınav Sonuçlarım' }} />
        <Tabs.Screen name="devamsizligim" options={{ ...hidden, title: 'Devamsızlığım' }} />
        <Tabs.Screen name="ders-programi" options={{ ...hidden, title: 'Ders Programı' }} />
        <Tabs.Screen name="yol-haritasi" options={{ ...hidden, title: 'Akademik Yol Haritam' }} />
        <Tabs.Screen name="basari" options={{ ...hidden, title: 'Başarı Rozetlerim' }} />
        <Tabs.Screen name="davranis-notlarim" options={{ ...hidden, title: 'Davranış Notlarım' }} />
        <Tabs.Screen name="sinav-belgesi" options={{ ...hidden, title: 'QR Sınav Belgesi' }} />
        <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'İletişim' }} />
        <Tabs.Screen name="servis" options={{ ...hidden, title: 'Servis' }} />
        <Tabs.Screen name="quiz" options={{ ...hidden, title: 'Pratik Quiz' }} />
        <Tabs.Screen name="mentor" options={{ ...hidden, title: 'Seviye Mentör' }} />
        <Tabs.Screen name="etut-randevularim" options={{ ...hidden, title: 'Etüt Randevularım' }} />
        <Tabs.Screen name="kulupler" options={{ ...hidden, title: 'Kulüpler' }} />
        <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'Güvenlik' }} />
      </Tabs>
    </StudentSelectionProvider>
  );
}
