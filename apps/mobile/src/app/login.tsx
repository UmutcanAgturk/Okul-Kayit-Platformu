import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button, ErrorBanner, Field, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { login, error } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!identifier.trim() || !password) {
      setLocalError('Kullanıcı adı/T.C. Kimlik No ve şifre zorunludur');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch {
      // hata mesajı useAuth().error üzerinden zaten gösteriliyor
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen style={{ justifyContent: 'center', gap: 20 }}>
          <Title>Seviye 360</Title>
          <MutedText>Kurs Merkezi otomasyon platformuna giriş yapın</MutedText>

          {/* Tek alan hem personel kullanıcı adını/e-postasını hem de
              Öğrenci/Veli'nin T.C. Kimlik No'sunu kabul eder — backend
              (bkz. apps/web/app/api/auth/login/route.ts) 11 haneli tamamen
              sayısal bir değeri otomatik T.C. Kimlik No olarak ayırt eder. */}
          <Field
            label="Kullanıcı Adı / T.C. Kimlik No"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="Personel: kullanıcı adı · Öğrenci/Veli: T.C. Kimlik No"
          />
          <Field
            label="Şifre"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
          />

          {(localError || error) && <ErrorBanner message={localError ?? error ?? ''} />}

          <Button title="Giriş Yap" onPress={handleSubmit} loading={submitting} />
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
