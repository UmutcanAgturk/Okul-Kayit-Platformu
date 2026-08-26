import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { StudentSelectionProvider } from '@/lib/student-selection';

/**
 * ÃÄrenci/Veli portalÄ±. Alt sekme Ã§ubuÄu sade tutulur (ModÃ¼ller / Ãdeme /
 * Profil); tÃ¼m modÃ¼l ekranlarÄ± `href: null` ile sekme Ã§ubuÄundan gizlenir ama
 * ModÃ¼ller hub'Ä±ndan router.push ile aÃ§Ä±lÄ±r (web'deki DashboardHub deseni).
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
          options={{ title: 'ModÃ¼ller', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="installments"
          options={{ title: 'Ãdeme', tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }}
        />

        {/* ModÃ¼l ekranlarÄ± â sekme Ã§ubuÄunda gizli, hub'dan aÃ§Ä±lÄ±r */}
        <Tabs.Screen name="karne" options={{ ...hidden, title: 'Karne' }} />
        <Tabs.Screen name="odevlerim" options={{ ...hidden, title: 'Ödevlerim' }} />
        <Tabs.Screen name="mesajlasma" options={{ ...hidden, title: 'Mesajlaşma' }} />
        <Tabs.Screen name="sinav-sonuclarim" options={{ ...hidden, title: 'SÄ±nav SonuÃ§larÄ±m' }} />
        <Tabs.Screen name="devamsizligim" options={{ ...hidden, title: 'DevamsÄ±zlÄ±ÄÄ±m' }} />
        <Tabs.Screen name="ders-programi" options={{ ...hidden, title: 'Ders ProgramÄ±' }} />
        <Tabs.Screen name="yol-haritasi" options={{ ...hidden, title: 'Akademik Yol Haritam' }} />
        <Tabs.Screen name="basari" options={{ ...hidden, title: 'BaÅarÄ± Rozetlerim' }} />
        <Tabs.Screen name="davranis-notlarim" options={{ ...hidden, title: 'DavranÄ±Å NotlarÄ±m' }} />
        <Tabs.Screen name="sinav-belgesi" options={{ ...hidden, title: 'QR SÄ±nav Belgesi' }} />
        <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'Ä°letiÅim' }} />
        <Tabs.Screen name="servis" options={{ ...hidden, title: 'Servis' }} />
        <Tabs.Screen name="quiz" options={{ ...hidden, title: 'Pratik Quiz' }} />
        <Tabs.Screen name="mentor" options={{ ...hidden, title: 'Seviye MentÃ¶r' }} />
        <Tabs.Screen name="etut-randevularim" options={{ ...hidden, title: 'EtÃ¼t RandevularÄ±m' }} />
        <Tabs.Screen name="kulupler" options={{ ...hidden, title: 'KulÃ¼pler' }} />
        <Tabs.Screen name="veli-gorusme" options={{ ...hidden, title: 'Veli GÃ¶rÃ¼Åmesi' }} />
        <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'GÃ¼venlik' }} />
      </Tabs>
    </StudentSelectionProvider>
  );
}
