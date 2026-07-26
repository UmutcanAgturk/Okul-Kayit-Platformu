import { ScrollView, View } from 'react-native';

import { Card, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function OtherHomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>{user?.role}</MutedText>
        </View>

        <Card>
          <MutedText>
            "{user?.role}" rolü için henüz özel bir mobil ekran tasarlanmadı. Profil sekmesinden
            oturumunuzu yönetebilirsiniz.
          </MutedText>
        </Card>
      </Screen>
    </ScrollView>
  );
}
