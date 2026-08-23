import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { Button, Card, Chip, ErrorBanner, Field, Label, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

export default function VergiAyarlariScreen() {
  const { data, loading } = useApiQuery<{ settings: { taxNo: string | null; taxOffice: string | null } }>('/api/branch/tax-settings');
  const [taxNo, setTaxNo] = useState(''); const [taxOffice, setTaxOffice] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState(false);

  useEffect(() => { if (data?.settings) { setTaxNo(data.settings.taxNo ?? ''); setTaxOffice(data.settings.taxOffice ?? ''); } }, [data]);

  async function save() {
    setBusy(true); setErr(null); setOk(false);
    try { await api.patch('/api/branch/tax-settings', { taxNo: taxNo.trim() || null, taxOffice: taxOffice.trim() || null }); setOk(true); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Kaydedilemedi'); } finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Subtitle>Vergi Ayarları</Subtitle>
      <Card style={{ gap: 12 }}>
        <Label>Şubenin vergi bilgileri (fatura üzerinde görünür).</Label>
        <Field label="Vergi No" value={taxNo} onChangeText={setTaxNo} keyboardType="number-pad" editable={!loading} />
        <Field label="Vergi Dairesi" value={taxOffice} onChangeText={setTaxOffice} editable={!loading} />
        {err && <ErrorBanner message={err} />}
        {ok && <Chip label="Kaydedildi" tone="success" />}
        <Button title="Kaydet" onPress={save} loading={busy} />
      </Card>
    </ScrollView>
  );
}
