import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Card, Chip, Label, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Genel Merkez · Superadmin',
  BRANCH_ADMIN: 'Şube Yöneticisi',
  ACCOUNTING: 'Muhasebe',
  GUIDANCE_COORDINATOR: 'Rehberlik Koordinatörü',
  TEACHER: 'Öğretmen',
  STUDENT: 'Öğrenci',
  PARENT: 'Veli',
};

export function ProfileScreen() {
  const { user, logout, logoutAll } = useAuth();
  const [busy, setBusy] = useState<'logout' | 'logout-all' | null>(null);

  async function handleLogout() {
    setBusy('logout');
    try {
      await logout();
    } finally {
      setBusy(null);
    }
  }

  async function handleLogoutAll() {
    setBusy('logout-all');
    try {
      await logoutAll();
    } finally {
      setBusy(null);
    }
  }

  if (!user) return null;

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <Title>Profilim</Title>

        <Card>
          <Label>
            {user.firstName} {user.lastName}
          </Label>
          <MutedText>{user.email}</MutedText>
          <Chip label={ROLE_LABELS[user.role] ?? user.role} tone="brand" />
        </Card>

        <Card style={{ gap: 12 }}>
          <Label>Oturum</Label>
          <MutedText>
            Çıkış yaptığınızda yalnızca bu cihazdaki oturum kapanır. "Tüm Cihazlardan Çıkış",
            hesabınızın açık olduğu her cihazdaki oturumu anında iptal eder — çalınmış bir
            oturuma karşı acil durum düğmesidir.
          </MutedText>
          <Button title="Çıkış Yap" variant="secondary" onPress={handleLogout} loading={busy === 'logout'} />
          <Button
            title="Tüm Cihazlardan Çıkış"
            variant="danger"
            onPress={handleLogoutAll}
            loading={busy === 'logout-all'}
          />
        </Card>
      </Screen>
    </ScrollView>
  );
}
