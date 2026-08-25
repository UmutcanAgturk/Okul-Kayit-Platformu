import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Card, CenterLoading, Chip, ErrorBanner, Label, MutedText, StatTile, Subtitle } from '@/components/ui';
import { useApiQuery } from '@/lib/use-api-query';

/**
 * Mobil Resmi Muhasebe özeti — web'deki çift taraflı muhasebenin (bkz.
 * apps/web /resmi-muhasebe) salt-okunur mobil görünümü: Bilanço, Gelir Tablosu
 * ve Cari bakiyeleri. Genel Merkez, "şube olarak yönet" bağlamında görür.
 */

type StatementLine = { code: string; name: string; amount: number };
type BalanceSheet = { assets: StatementLine[]; liabilities: StatementLine[]; equity: StatementLine[]; totalAssets: number; totalPassive: number };
type IncomeStatement = { revenue: StatementLine[]; expense: StatementLine[]; totalRevenue: number; totalExpense: number; netProfit: number };
type CariRow = { accountId: string; code: string; name: string; balance: number };
type CariData = { students: CariRow[]; suppliers: CariRow[] };

function tl(n: number) {
  return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TABS = ['Bilanço', 'Gelir Tablosu', 'Cari'] as const;
type Tab = (typeof TABS)[number];

function LineRow({ l }: { l: StatementLine }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(127,127,127,0.15)' }}>
      <MutedText>{l.code} — {l.name}</MutedText>
      <Label>{tl(l.amount)}</Label>
    </View>
  );
}

function BalanceView() {
  const { data, loading, error } = useApiQuery<BalanceSheet>('/api/branch/accounting/reports?report=balance-sheet');
  if (loading) return <CenterLoading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 4 }}>
        <Subtitle>Aktif (Varlıklar)</Subtitle>
        {data.assets.length === 0 ? <MutedText>Kayıt yok.</MutedText> : data.assets.map((l) => <LineRow key={l.code} l={l} />)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 }}><Label>AKTİF TOPLAM</Label><Label>{tl(data.totalAssets)}</Label></View>
      </Card>
      <Card style={{ gap: 4 }}>
        <Subtitle>Pasif (Kaynaklar)</Subtitle>
        {[...data.liabilities, ...data.equity].length === 0 ? <MutedText>Kayıt yok.</MutedText> : [...data.liabilities, ...data.equity].map((l) => <LineRow key={l.code} l={l} />)}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 }}><Label>PASİF TOPLAM</Label><Label>{tl(data.totalPassive)}</Label></View>
      </Card>
    </View>
  );
}

function IncomeView() {
  const { data, loading, error } = useApiQuery<IncomeStatement>('/api/branch/accounting/reports?report=income-statement');
  if (loading) return <CenterLoading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <StatTile icon="trending-up-outline" label="Gelir" value={tl(data.totalRevenue)} tone="success" />
        <StatTile icon="trending-down-outline" label="Gider" value={tl(data.totalExpense)} tone="critical" />
      </View>
      <StatTile icon="cash-outline" label={data.netProfit >= 0 ? 'Dönem Net Kârı' : 'Dönem Net Zararı'} value={tl(data.netProfit)} tone={data.netProfit >= 0 ? 'success' : 'critical'} />
      <Card style={{ gap: 4 }}>
        <Subtitle>Gelirler</Subtitle>
        {data.revenue.length === 0 ? <MutedText>Kayıt yok.</MutedText> : data.revenue.map((l) => <LineRow key={l.code} l={l} />)}
      </Card>
      <Card style={{ gap: 4 }}>
        <Subtitle>Giderler</Subtitle>
        {data.expense.length === 0 ? <MutedText>Kayıt yok.</MutedText> : data.expense.map((l) => <LineRow key={l.code} l={l} />)}
      </Card>
    </View>
  );
}

function CariView() {
  const { data, loading, error } = useApiQuery<CariData>('/api/branch/accounting/cari');
  if (loading) return <CenterLoading />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;
  return (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Subtitle>Öğrenci Carileri</Subtitle><Chip label="Tahsil edilecek" tone="warning" /></View>
        {data.students.length === 0 ? <MutedText>Cari yok.</MutedText> : data.students.map((s) => (
          <View key={s.accountId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(127,127,127,0.15)' }}>
            <MutedText>{s.name.replace(/^Alıcı — /, '')}</MutedText>
            <Label>{tl(s.balance)}</Label>
          </View>
        ))}
      </Card>
      <Card style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Subtitle>Tedarikçi Carileri</Subtitle><Chip label="Ödenecek" tone="critical" /></View>
        {data.suppliers.length === 0 ? <MutedText>Cari yok.</MutedText> : data.suppliers.map((s) => (
          <View key={s.accountId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(127,127,127,0.15)' }}>
            <MutedText>{s.name.replace(/^Satıcı — /, '')}</MutedText>
            <Label>{tl(s.balance)}</Label>
          </View>
        ))}
      </Card>
    </View>
  );
}

export default function ResmiMuhasebeScreen() {
  const [tab, setTab] = useState<Tab>('Bilanço');
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View>
        <Subtitle>Resmi Muhasebe</Subtitle>
        <MutedText>Çift taraflı defter özeti — bilanço, gelir tablosu, cari</MutedText>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center' }}>
            <Chip label={t} tone="brand" selected={tab === t} />
          </Pressable>
        ))}
      </View>
      {tab === 'Bilanço' && <BalanceView />}
      {tab === 'Gelir Tablosu' && <IncomeView />}
      {tab === 'Cari' && <CariView />}
    </ScrollView>
  );
}
