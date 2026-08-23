import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Card, Chip, ErrorBanner, Field, Label, MutedText, Subtitle } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

type Doc = 'fatura' | 'dekont' | 'senet' | 'bordro';
const TABS: { k: Doc; l: string }[] = [
  { k: 'fatura', l: 'Fatura' }, { k: 'dekont', l: 'Dekont' }, { k: 'senet', l: 'Senet' }, { k: 'bordro', l: 'Bordro' },
];
const today = () => new Date().toISOString().slice(0, 10);

export default function BelgelerScreen() {
  const [tab, setTab] = useState<Doc>('fatura');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ortak alanlar
  const [date, setDate] = useState(today());
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  // fatura
  const [itemDesc, setItemDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [kdvExempt, setKdvExempt] = useState(false);
  // dekont
  const [rtype, setRtype] = useState('TAHSILAT');
  const [rmethod, setRmethod] = useState('NAKIT');
  // senet
  const [dueDate, setDueDate] = useState(today());
  // bordro
  const teachers = useApiQuery<{ teachers: { id: string; name: string }[] }>(tab === 'bordro' ? '/api/branch/teachers' : null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [gross, setGross] = useState('');

  function reset() { setName(''); setAmount(''); setItemDesc(''); setUnit(''); setGross(''); setTeacherId(null); }

  async function submit() {
    setErr(null); setOk(null); setBusy(true);
    try {
      if (tab === 'fatura') {
        if (!name.trim() || !itemDesc.trim() || !unit) throw new Error('Alıcı, kalem ve tutar zorunlu');
        await api.post('/api/branch/invoices', { invoiceDate: date, buyerName: name.trim(), items: [{ description: itemDesc.trim(), quantity: parseFloat(qty) || 1, unitPrice: parseFloat(unit) }], kdvExempt });
      } else if (tab === 'dekont') {
        if (!name.trim() || !amount) throw new Error('Kişi ve tutar zorunlu');
        await api.post('/api/branch/receipts', { receiptDate: date, type: rtype, personName: name.trim(), amount: parseFloat(amount), method: rmethod });
      } else if (tab === 'senet') {
        if (!name.trim() || !amount) throw new Error('Borçlu ve tutar zorunlu');
        await api.post('/api/branch/promissory-notes', { issueDate: date, dueDate, debtorName: name.trim(), amount: parseFloat(amount) });
      } else {
        if (!teacherId || !gross) throw new Error('Öğretmen ve brüt maaş zorunlu');
        await api.post('/api/branch/payroll', { teacherId, period, grossSalary: parseFloat(gross) });
      }
      setOk('Belge oluşturuldu.'); reset();
    } catch (e) { setErr(e instanceof ApiError ? e.message : (e as Error).message || 'Oluşturulamadı'); }
    finally { setBusy(false); }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {TABS.map((t) => (
          <Pressable key={t.k} onPress={() => { setTab(t.k); setErr(null); setOk(null); }}>
            <Chip label={t.l} tone="brand" selected={tab === t.k} />
          </Pressable>
        ))}
      </View>

      {tab === 'fatura' && (<>
        <Field label="Fatura Tarihi" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Field label="Alıcı" value={name} onChangeText={setName} />
        <Field label="Kalem Açıklaması" value={itemDesc} onChangeText={setItemDesc} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Adet" value={qty} onChangeText={(t) => setQty(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Birim Fiyat" value={unit} onChangeText={(t) => setUnit(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" /></View>
        </View>
        <Pressable onPress={() => setKdvExempt((v) => !v)}><Chip label={kdvExempt ? '✓ KDV İstisna' : 'KDV İstisna değil'} tone={kdvExempt ? 'success' : 'neutral'} selected={kdvExempt} /></Pressable>
      </>)}

      {tab === 'dekont' && (<>
        <Field label="Tarih" value={date} onChangeText={setDate} autoCapitalize="none" />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {['TAHSILAT', 'ODEME'].map((t) => <Pressable key={t} onPress={() => setRtype(t)}><Chip label={t === 'TAHSILAT' ? 'Tahsilat' : 'Ödeme'} tone="brand" selected={rtype === t} /></Pressable>)}
        </View>
        <Field label="Kişi" value={name} onChangeText={setName} />
        <Field label="Tutar (₺)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {['NAKIT', 'KREDI_KARTI', 'BANKA_HAVALESI', 'SENET'].map((m) => <Pressable key={m} onPress={() => setRmethod(m)}><Chip label={m} tone="neutral" selected={rmethod === m} /></Pressable>)}
        </View>
      </>)}

      {tab === 'senet' && (<>
        <Field label="Düzenleme Tarihi" value={date} onChangeText={setDate} autoCapitalize="none" />
        <Field label="Vade Tarihi" value={dueDate} onChangeText={setDueDate} autoCapitalize="none" />
        <Field label="Borçlu" value={name} onChangeText={setName} />
        <Field label="Tutar (₺)" value={amount} onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      </>)}

      {tab === 'bordro' && (<>
        <MutedText>Öğretmen</MutedText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {(teachers.data?.teachers ?? []).map((t) => <Pressable key={t.id} onPress={() => setTeacherId(t.id)}><Chip label={t.name} tone="brand" selected={teacherId === t.id} /></Pressable>)}
        </View>
        <Field label="Dönem (YYYY-AA)" value={period} onChangeText={setPeriod} autoCapitalize="none" />
        <Field label="Brüt Maaş (₺)" value={gross} onChangeText={(t) => setGross(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      </>)}

      {err && <ErrorBanner message={err} />}
      {ok && <Chip label={ok} tone="success" />}
      <Button title="Belge Oluştur" onPress={submit} loading={busy} />
    </ScrollView>
  );
}
