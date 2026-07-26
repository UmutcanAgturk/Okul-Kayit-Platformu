import { ScrollView, View } from 'react-native';

import { Card, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function AdminHomeScreen() {
  const { user } = useAuth();

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <View>
          <Title>Merhaba, {user?.firstName}</Title>
          <MutedText>Genel Merkez · Superadmin</MutedText>
        </View>

        <Card style={{ gap: 8 }}>
          <Label>Konsolide Genel Merkez Görünümü</Label>
          <MutedText>
            Muhasebe defteri ve taksit API'leri kasıtlı olarak tek bir şubeye scope edilmiş
            durumda — Genel Merkez'in tüm kurumlar genelinde konsolide bir görünümü şu an gerçek
            backend'de mevcut değil (bkz. apps/web/app/api/branch/accounting-ledger route'undaki
            not). Bu ekran, o API tasarlandığında doldurulacak.
          </MutedText>
        </Card>
      </Screen>
    </ScrollView>
  );
}
