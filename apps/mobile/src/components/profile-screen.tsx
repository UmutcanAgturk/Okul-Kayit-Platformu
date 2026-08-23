import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Card, Chip, ErrorBanner, Field, Label, MutedText, Screen, Title } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useApiQuery } from '@/lib/use-api-query';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Genel Merkez · Superadmin',
  BRANCH_ADMIN: 'Şube Yöneticisi',
  ACCOUNTING: 'Muhasebe',
  GUIDANCE_COORDINATOR: 'Rehberlik Koordinatörü',
  TEACHER: 'Öğretmen',
  STUDENT: 'Öğrenci',
  PARENT: 'Veli',
};

interface ProfileDetail {
  firstName: string; lastName: string; email: string; phone: string | null; role: string;
  tenantName: string | null; branch?: string | null; title?: string | null; department?: string | null; studentNo?: string | null;
}

export function ProfileScreen() {
  const { user, logout, logoutAll } = useAuth();
  const profile = useApiQuery<ProfileDetail>('/api/me/profile');
  const [busy, setBusy] = useState<'logout' | 'logout-all' | 'pw' | null>(null);

  const [showPw, setShowPw] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  async function changePassword() {
    setPwErr(null);
    if (next.length < 6) { setPwErr('Yeni şifre en az 6 karakter olmalı'); return; }
    if (next !== next2) { setPwErr('Yeni şifreler eşleşmiyor'); return; }
    setBusy('pw');
    try {
      await api.patch('/api/me/password', { currentPassword: current, newPassword: next });
      setCurrent(''); setNext(''); setNext2(''); setShowPw(false); setPwOk(true);
    } catch (e) {
      setPwErr(e instanceof ApiError ? e.message : 'Şifre değiştirilemedi');
    } finally { setBusy(null); }
  }

  async function handleLogout() { setBusy('logout'); try { await logout(); } finally { setBusy(null); } }
  async function handleLogoutAll() { setBusy('logout-all'); try { await logoutAll(); } finally { setBusy(null); } }

  if (!user) return null;
  const d = profile.data;

  return (
    <ScrollView>
      <Screen style={{ gap: 16 }}>
        <Title>Profilim</Title>

        <Card>
          <Label>{user.firstName} {user.lastName}</Label>
          <MutedText>{user.email}</MutedText>
          <Chip label={ROLE_LABELS[user.role] ?? user.role} tone="brand" />
          {d?.phone ? <MutedText>Telefon: {d.phone}</MutedText> : null}
          {d?.tenantName ? <MutedText>Kurum: {d.tenantName}</MutedText> : null}
          {d?.title ? <MutedText>Ünvan: {d.title}{d.department ? ` · ${d.department}` : ''}</MutedText> : null}
          {d?.studentNo ? <MutedText>Öğrenci No: {d.studentNo}</MutedText> : null}
        </Card>

        <Card style={{ gap: 12 }}>
          <Label>Şifre Değiştir</Label>
          {pwOk && <Chip label="Şifre değiştirildi" tone="success" />}
          {!showPw ? (
            <Button title="Şifre Değiştir" variant="secondary" onPress={() => { setShowPw(true); setPwOk(false); }} />
          ) : (
            <>
              <Field label="Mevcut Şifre" value={current} onChangeText={setCurrent} secureTextEntry />
              <Field label="Yeni Şifre" value={next} onChangeText={setNext} secureTextEntry />
              <Field label="Yeni Şifre (Tekrar)" value={next2} onChangeText={setNext2} secureTextEntry />
              {pwErr && <ErrorBanner message={pwErr} />}
              <Button title="Kaydet" onPress={changePassword} loading={busy === 'pw'} />
              <Button title="Vazgeç" variant="secondary" onPress={() => setShowPw(false)} />
            </>
          )}
        </Card>

        <Card style={{ gap: 12 }}>
          <Label>Oturum</Label>
          <MutedText>
            Çıkış yaptığınızda yalnızca bu cihazdaki oturum kapanır. "Tüm Cihazlardan Çıkış",
            hesabınızın açık olduğu her cihazdaki oturumu anında iptal eder.
          </MutedText>
          <Button title="Çıkış Yap" variant="secondary" onPress={handleLogout} loading={busy === 'logout'} />
          <Button title="Tüm Cihazlardan Çıkış" variant="danger" onPress={handleLogoutAll} loading={busy === 'logout-all'} />
        </Card>
      </Screen>
    </ScrollView>
  );
}
