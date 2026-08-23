import { useState } from 'react';
import { Image, ScrollView, View } from 'react-native';

import { Button, Card, Chip, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

/** İki faktörlü doğrulama (TOTP) kurulumu — tüm roller (bkz. web /guvenlik). */
export function SecurityScreen() {
  const status = useApiQuery<{ twoFactorEnabled: boolean }>('/api/me/2fa');
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const enabled = !!status.data?.twoFactorEnabled;

  async function start() {
    setBusy(true); setErr(null);
    try { setSetup(await api.post('/api/me/2fa/setup')); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Başlatılamadı'); }
    finally { setBusy(false); }
  }
  async function enable() {
    setBusy(true); setErr(null);
    try { await api.post('/api/me/2fa/enable', { code }); setSetup(null); setCode(''); setMsg('2FA etkinleştirildi.'); await status.refetch(); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kod hatalı'); }
    finally { setBusy(false); }
  }
  async function disable() {
    setBusy(true); setErr(null);
    try {
      await api.del('/api/me/2fa', { password: pw });
      setPw(''); setMsg('2FA kapatıldı.'); await status.refetch();
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Kapatılamadı'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Subtitle>İki Faktörlü Doğrulama</Subtitle>
      {msg && <Chip label={msg} tone="success" />}
      {err && <Chip label={err} tone="critical" />}
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Label>Durum</Label>
          <Chip label={enabled ? 'Etkin' : 'Kapalı'} tone={enabled ? 'success' : 'neutral'} />
        </View>

        {!enabled && !setup && (
          <>
            <MutedText>Google/Microsoft Authenticator veya Authy gerekir.</MutedText>
            <Button title="Kurulumu Başlat" onPress={start} loading={busy} />
          </>
        )}

        {!enabled && setup && (
          <>
            <MutedText>1) Authenticator ile QR'ı tarayın:</MutedText>
            <Image source={{ uri: setup.qrDataUrl }} style={{ width: 200, height: 200, alignSelf: 'center' }} />
            <MutedText>Elle: {setup.secret}</MutedText>
            <Field label="2) 6 haneli kod" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="000000" />
            <Button title="Etkinleştir" onPress={enable} loading={busy} />
          </>
        )}

        {enabled && (
          <>
            <MutedText>Kapatmak için hesap şifrenizi girin.</MutedText>
            <Field label="Şifre" value={pw} onChangeText={setPw} secureTextEntry />
            <Button title="2FA'yı Kapat" variant="danger" onPress={disable} loading={busy} />
          </>
        )}
      </Card>
    </ScrollView>
  );
}
