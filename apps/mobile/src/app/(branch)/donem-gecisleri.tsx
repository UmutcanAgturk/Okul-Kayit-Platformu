import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, Chip, EmptyState, ErrorBanner, Label, MutedText, StatTile, Title } from '@/components/ui';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/use-api-query';

interface AcademicYearSummary { id: string; label: string; startYear: number; active: boolean; }
interface PromotionRunSummary { id: string; fromYearLabel: string; toYearLabel: string; promotedCount: number; graduatedCount: number; runAt: string; }
const fmt = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function BranchDonemGecisleriScreen() {
  const years = useApiQuery<{ years: AcademicYearSummary[] }>('/api/branch/academic/years');
  const runs = useApiQuery<{ runs: PromotionRunSummary[] }>('/api/branch/academic/promotions');
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const yearList = years.data?.years ?? [];
  const active = yearList.find((y) => y.active) ?? null;

  async function refetchAll() { await Promise.all([years.refetch(), runs.refetch()]); }
  async function generate() { setBusy('gen'); setError(null); try { const r = await api.post<{ created: number }>('/api/branch/academic/years', { action: 'generate' }); setBanner(`${r.created} yeni yıl oluşturuldu.`); await refetchAll(); } catch (e) { setError(e instanceof Error ? e.message : 'Hata'); } finally { setBusy(null); } }
  async function activate(id: string) { setBusy(id); try { await api.patch(`/api/branch/academic/years/${id}`, {}); await years.refetch(); } finally { setBusy(null); } }
  async function promote() { setBusy('promo'); setError(null); try { const r = await api.post<{ run: PromotionRunSummary }>('/api/branch/academic/promotions', {}); setArmed(false); setBanner(`Geçiş: ${r.run.fromYearLabel} → ${r.run.toYearLabel}. ${r.run.promotedCount} yükseltildi, ${r.run.graduatedCount} mezun.`); await refetchAll(); } catch (e) { setArmed(false); setError(e instanceof Error ? e.message : 'Hata'); } finally { setBusy(null); } }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Title>Dönem Geçişleri</Title>
      {(years.error || error) && <ErrorBanner message={years.error ?? error ?? ''} />}
      {banner && <Card style={{ backgroundColor: 'transparent' }}><MutedText>{banner}</MutedText></Card>}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <StatTile label="Aktif Yıl" value={active?.label ?? '—'} icon="calendar-outline" />
        <StatTile label="Tanımlı Yıl" value={String(yearList.length)} icon="albums-outline" />
      </View>
      <Card style={{ gap: 10 }}>
        <Label>Akademik Yıllar</Label>
        <Button title={busy === 'gen' ? 'Oluşturuluyor…' : "2050'ye Kadar Oluştur"} variant="secondary" onPress={generate} loading={busy === 'gen'} />
        {yearList.length === 0 ? <EmptyState message="Yıl yok." icon="calendar-outline" /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {yearList.map((y) => (
              <View key={y.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {y.active ? <Chip label={`${y.label} · Aktif`} tone="success" /> : <Button title={y.label} variant="secondary" onPress={() => activate(y.id)} loading={busy === y.id} />}
              </View>
            ))}
          </View>
        )}
      </Card>
      <Card style={{ gap: 10 }}>
        <Label>Sınıf Geçişi</Label>
        <MutedText>Aktif yıldaki tüm öğrencileri bir üst sınıfa taşır (12. sınıf → Mezun) ve sonraki yılı aktif yapar. Geri alınamaz.</MutedText>
        {!armed ? <Button title="Dönem Geçişini Başlat" variant="danger" onPress={() => setArmed(true)} /> : (
          <View style={{ gap: 8 }}>
            <MutedText>Emin misiniz? {active?.label} → sonraki yıl.</MutedText>
            <Button title={busy === 'promo' ? 'Uygulanıyor…' : 'Evet, Geçişi Yap'} variant="danger" onPress={promote} loading={busy === 'promo'} />
            <Button title="Vazgeç" variant="secondary" onPress={() => setArmed(false)} />
          </View>
        )}
      </Card>
      <Card style={{ gap: 8 }}>
        <Label>Geçiş Geçmişi</Label>
        {(runs.data?.runs ?? []).length === 0 ? <MutedText>Henüz geçiş yapılmadı.</MutedText> : (runs.data?.runs ?? []).map((r) => (
          <View key={r.id} style={{ paddingVertical: 4 }}>
            <MutedText>{fmt(r.runAt)} · {r.fromYearLabel} → {r.toYearLabel} · {r.promotedCount} yükseltildi, {r.graduatedCount} mezun</MutedText>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}
