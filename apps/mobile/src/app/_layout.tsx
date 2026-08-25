import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { CenterLoading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { initSentry, setSentryUser, wrapWithSentry } from '@/lib/sentry';

initSentry();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { user, loading } = useAuth();

  const role = user?.role;

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  useEffect(() => { setSentryUser(role, user?.id); }, [role, user?.id]);

  if (loading) return <CenterLoading />;

  const isStudentOrParent = role === 'STUDENT' || role === 'PARENT';
  const isBranch = role === 'BRANCH_ADMIN' || role === 'ACCOUNTING' || role === 'GUIDANCE_COORDINATOR';
  const isOther = !!user && !isStudentOrParent && role !== 'TEACHER' && !isBranch && role !== 'SUPERADMIN';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={!!user && isStudentOrParent}>
        <Stack.Screen name="(student)" />
      </Stack.Protected>
      <Stack.Protected guard={role === 'TEACHER'}>
        <Stack.Screen name="(teacher)" />
      </Stack.Protected>
      {/* (admin) SUPERADMIN'in açılış portalı (Genel/konsolide bölüm). ÖNCE
          deklare edilir ki SUPERADMIN buraya düşsün. */}
      <Stack.Protected guard={role === 'SUPERADMIN'}>
        <Stack.Screen name="(admin)" />
      </Stack.Protected>
      {/* (branch) hem şube rolleri hem de SUPERADMIN için — HQ bir şube seçince
          (acting tenant) o şubenin tüm operasyonel modüllerini burada yönetir. */}
      <Stack.Protected guard={isBranch || role === 'SUPERADMIN'}>
        <Stack.Screen name="(branch)" />
      </Stack.Protected>
      <Stack.Protected guard={isOther}>
        <Stack.Screen name="(other)" />
      </Stack.Protected>
    </Stack>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="auto" />
      <RootNavigator />
    </AuthProvider>
  );
}

export default wrapWithSentry(RootLayout);
