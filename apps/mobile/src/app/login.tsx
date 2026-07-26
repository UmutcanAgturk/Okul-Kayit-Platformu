import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button, ErrorBanner, Field, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setLocalError('E-posta ve şifre zorunludur');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
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

          <Field
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="ornek@seviye360.com"
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
