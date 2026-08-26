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
      <Tabs.Screen name="index" options={{ title: 'ModÃ¼ller', tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="study-sessions" options={{ title: 'EtÃ¼t OnayÄ±', tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} /> }} />

      {/* ModÃ¼l ekranlarÄ± â hub'dan aÃ§Ä±lÄ±r */}
      <Tabs.Screen name="siniflarim" options={{ ...hidden, title: 'SÄ±nÄ±flarÄ±m' }} />
      <Tabs.Screen name="class-xray" options={{ ...hidden, title: 'AI SÄ±nÄ±f RÃ¶ntgeni' }} />
      <Tabs.Screen name="ders-programi" options={{ ...hidden, title: 'Ders ProgramÄ±' }} />
      <Tabs.Screen name="veli-gorusme" options={{ ...hidden, title: 'Veli GÃ¶rÃ¼Åmeleri' }} />
      <Tabs.Screen name="mentorluk" options={{ ...hidden, title: 'MentÃ¶rlÃ¼k' }} />
      <Tabs.Screen name="kulupler" options={{ ...hidden, title: 'KulÃ¼plerim' }} />
      <Tabs.Screen name="yoklama" options={{ ...hidden, title: 'Yoklama Al' }} />
      <Tabs.Screen name="iletisim" options={{ ...hidden, title: 'Ä°letiÅim' }} />
      <Tabs.Screen name="olcme-degerlendirme" options={{ ...hidden, title: 'ÃlÃ§me-DeÄerlendirme' }} />
      <Tabs.Screen name="optik-okuyucu" options={{ ...hidden, title: 'Mobil Optik Okuyucu' }} />
      <Tabs.Screen name="mesajlasma" options={{ ...hidden, title: 'Mesajlaşma' }} />
      <Tabs.Screen name="disiplin" options={{ ...hidden, title: 'Disiplin' }} />
      <Tabs.Screen name="karne" options={{ ...hidden, title: 'Karne' }} />
      <Tabs.Screen name="lider-tablosu" options={{ ...hidden, title: 'Lider Tablosu' }} />
      <Tabs.Screen name="kazanim-ozeti" options={{ ...hidden, title: 'KazanÄ±m Ãzeti' }} />
      <Tabs.Screen name="guvenlik" options={{ ...hidden, title: 'GÃ¼venlik' }} />
    </Tabs>
  );
}
