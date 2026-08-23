import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import { Button, ErrorBanner, Field, MutedText, Screen, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const { login, verifyMfa, cancelMfa, mfaRequired, error } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
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

  async function handleVerify() {
    if (code.trim().length !== 6) {
      setLocalError('6 haneli doğrulama kodunu girin');
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    try {
      await verifyMfa(code.trim());
    } catch {
      // hata useAuth().error üzerinden gösterilir
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Screen style={{ justifyContent: 'center', gap: 20 }}>
          <Title>Seviye 360</Title>

          {!mfaRequired ? (
            <>
              <MutedText>Kurs Merkezi otomasyon platformuna giriş yapın</MutedText>

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
            </>
          ) : (
            <>
              <MutedText>Authenticator uygulamanızdaki 6 haneli kodu girin</MutedText>

              <Field
                label="Doğrulama Kodu"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="000000"
              />

              {(localError || error) && <ErrorBanner message={localError ?? error ?? ''} />}

              <Button title="Doğrula ve Giriş Yap" onPress={handleVerify} loading={submitting} />
              <Button
                title="Geri"
                variant="secondary"
                onPress={() => {
                  setCode('');
                  setLocalError(null);
                  cancelMfa();
                }}
              />
            </>
          )}
        </Screen>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
