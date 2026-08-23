import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, Label, MutedText } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export interface HubModule {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}

/**
 * Web'deki DashboardHub'ın (nav-config kart ızgarası) mobil karşılığı — rolün
 * modüllerini iki sütunlu bir ızgarada gösterir; her kart ilgili stack
 * ekranına yönlendirir.
 */
export function ModuleHub({ modules }: { modules: HubModule[] }) {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {modules.map((m) => (
        <Pressable
          key={m.route}
          onPress={() => router.push(m.route as never)}
          style={{ width: '47.5%', flexGrow: 1 }}
          accessibilityRole="button"
          accessibilityLabel={m.title}>
          <Card style={{ gap: 8, minHeight: 104, justifyContent: 'space-between' }}>
            <View
              style={{
                width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                backgroundColor: theme.brand + '1A',
              }}>
              <Ionicons name={m.icon} size={20} color={theme.brand} />
            </View>
            <View>
              <Label>{m.title}</Label>
              {m.description ? <MutedText>{m.description}</MutedText> : null}
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
