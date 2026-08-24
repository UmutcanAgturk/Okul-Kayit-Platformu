import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export interface HubModule {
  title: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  group?: string;
}

// Modül ekranını (route'un son parçası) bir kategoriye eşler — böylece her hub
// dizisine tek tek `group` eklemeye gerek kalmaz; kategoriler tek yerden yönetilir.
const GROUP_FOR_SEGMENT: Record<string, string> = {
  // Genel Bakış
  index: 'Genel Bakış', bugun: 'Genel Bakış', takvim: 'Genel Bakış', 'sube-haritasi': 'Genel Bakış',
  kurumlar: 'Genel Bakış', analytics: 'Genel Bakış', 'gunluk-operasyon': 'Genel Bakış', arama: 'Genel Bakış',
  aktivite: 'Genel Bakış', iletisim: 'Genel Bakış', 'mesaj-yayini': 'Genel Bakış', 'tahsilat-oranlari': 'Genel Bakış',
  // Kayıt
  crm: 'Kayıt', 'on-kayit': 'Kayıt', 'normal-kayit': 'Kayıt', ogrenciler: 'Kayıt', siniflar: 'Kayıt', roller: 'Kayıt',
  // Akademik
  'olcme-degerlendirme': 'Akademik', karne: 'Akademik', odevler: 'Akademik', kurslar: 'Akademik',
  devamsizlik: 'Akademik', devamsizligim: 'Akademik', 'ders-programi': 'Akademik', siniflarim: 'Akademik',
  quiz: 'Akademik', 'yol-haritasi': 'Akademik', 'sinav-sonuclarim': 'Akademik', 'sinav-belgesi': 'Akademik',
  kazanimlar: 'Akademik', 'kazanim-ozeti': 'Akademik', 'class-xray': 'Akademik', 'sinav-dagitimi': 'Akademik',
  'sinav-karsilastirma': 'Akademik', 'lider-tablosu': 'Akademik', basari: 'Akademik', 'ogretmen-performansi': 'Akademik',
  'risk-ogrenciler': 'Akademik',
  // Öğrenci Yaşamı
  disiplin: 'Öğrenci Yaşamı', 'davranis-notlarim': 'Öğrenci Yaşamı', 'veli-gorusme': 'Öğrenci Yaşamı',
  kulupler: 'Öğrenci Yaşamı', etkinlikler: 'Öğrenci Yaşamı', 'rehberlik-olay': 'Öğrenci Yaşamı', etut: 'Öğrenci Yaşamı',
  'etut-onayi': 'Öğrenci Yaşamı', 'etut-randevularim': 'Öğrenci Yaşamı', 'study-sessions': 'Öğrenci Yaşamı',
  mentor: 'Öğrenci Yaşamı', mentorluk: 'Öğrenci Yaşamı', servis: 'Öğrenci Yaşamı', yemekhane: 'Öğrenci Yaşamı',
  saglik: 'Öğrenci Yaşamı', ziyaretci: 'Öğrenci Yaşamı', 'alma-talepleri': 'Öğrenci Yaşamı',
  // Finans & Yönetim
  muhasebe: 'Finans & Yönetim', ledger: 'Finans & Yönetim', 'mali-ozet': 'Finans & Yönetim',
  installments: 'Finans & Yönetim', senetler: 'Finans & Yönetim', 'dekont-onay': 'Finans & Yönetim',
  'odeme-analizi': 'Finans & Yönetim', 'odeme-yontemleri': 'Finans & Yönetim', 'vergi-ayarlari': 'Finans & Yönetim',
  'mesaj-sablonlari': 'Finans & Yönetim', belgeler: 'Finans & Yönetim', personel: 'Finans & Yönetim',
  'personel-yoklama': 'Finans & Yönetim', ogretmenler: 'Finans & Yönetim', gorevler: 'Finans & Yönetim',
  mezunlar: 'Finans & Yönetim', 'donem-gecisleri': 'Finans & Yönetim', 'odeme-islemlerim': 'Finans & Yönetim',
  raporlar: 'Finans & Yönetim', dokumanlar: 'Finans & Yönetim', stok: 'Finans & Yönetim', kutuphane: 'Öğrenci Yaşamı',
  // Hesabım
  profile: 'Hesabım', guvenlik: 'Hesabım',
};

const GROUP_ORDER = ['Genel Bakış', 'Kayıt', 'Akademik', 'Öğrenci Yaşamı', 'Finans & Yönetim', 'Hesabım', 'Diğer'];
const USAGE_KEY = 'seviye360.hub-usage';
const FEATURED_LABEL = 'Sık Kullanılanlar';

function segmentOf(route: string): string {
  const parts = route.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}
function groupFor(route: string): string {
  return GROUP_FOR_SEGMENT[segmentOf(route)] ?? 'Diğer';
}
function tr(s: string): string {
  return s.toLocaleLowerCase('tr-TR');
}

/**
 * Rolün modüllerini kategorilere ayrılmış, aranabilir ve "sık kullanılanlar"
 * öne çıkan bir ızgarada gösterir. Kullanım sayacı AsyncStorage'da tutulur;
 * en çok açılan modüller en üstte bir kısayol bölümünde belirir.
 */
export function ModuleHub({ modules }: { modules: HubModule[] }) {
  const router = useRouter();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [usage, setUsage] = useState<Record<string, number>>({});

  useEffect(() => {
    AsyncStorage.getItem(USAGE_KEY)
      .then((raw) => { if (raw) { try { setUsage(JSON.parse(raw)); } catch { /* yoksay */ } } })
      .catch(() => {});
  }, []);

  const open = useCallback(
    (route: string) => {
      setUsage((prev) => {
        const next = { ...prev, [route]: (prev[route] ?? 0) + 1 };
        AsyncStorage.setItem(USAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      router.push(route as never);
    },
    [router],
  );

  const q = tr(query.trim());
  const filtered = useMemo(
    () => (q ? modules.filter((m) => tr(m.title).includes(q) || (m.description ? tr(m.description).includes(q) : false)) : modules),
    [modules, q],
  );

  // Sık kullanılanlar — yalnızca arama yokken ve en az bir kez açılmış modüller varken.
  const featured = useMemo(() => {
    if (q) return [];
    return modules
      .filter((m) => (usage[m.route] ?? 0) > 0 && segmentOf(m.route) !== 'index')
      .sort((a, b) => (usage[b.route] ?? 0) - (usage[a.route] ?? 0))
      .slice(0, 6);
  }, [modules, usage, q]);

  const sections = useMemo(() => {
    const buckets = new Map<string, HubModule[]>();
    for (const m of filtered) {
      const g = m.group ?? groupFor(m.route);
      if (!buckets.has(g)) buckets.set(g, []);
      buckets.get(g)!.push(m);
    }
    const ordered: { label: string; items: HubModule[] }[] = [];
    for (const label of GROUP_ORDER) {
      const items = buckets.get(label);
      if (items && items.length) ordered.push({ label, items });
    }
    // GROUP_ORDER dışındaki (beklenmeyen) gruplar da sona eklenir.
    for (const [label, items] of buckets) {
      if (!GROUP_ORDER.includes(label) && items.length) ordered.push({ label, items });
    }
    return ordered;
  }, [filtered]);

  return (
    <View style={{ gap: 18 }}>
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12,
          paddingHorizontal: 12, height: 44, backgroundColor: theme.backgroundElement, borderColor: theme.border,
        }}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Modül ara…"
          placeholderTextColor={theme.textSecondary}
          style={{ flex: 1, color: theme.text, fontSize: 15, paddingVertical: 0 }}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {featured.length > 0 && <HubSection label={FEATURED_LABEL} items={featured} onOpen={open} theme={theme} featured />}

      {sections.length === 0 ? (
        <View style={{ padding: 28, alignItems: 'center', gap: 10 }}>
          <Ionicons name="search-outline" size={26} color={theme.textSecondary} />
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>&quot;{query}&quot; ile eşleşen modül yok.</Text>
        </View>
      ) : (
        sections.map((s) => <HubSection key={s.label} label={s.label} items={s.items} onOpen={open} theme={theme} />)
      )}
    </View>
  );
}

function HubSection({
  label, items, onOpen, theme, featured,
}: {
  label: string;
  items: HubModule[];
  onOpen: (route: string) => void;
  theme: ReturnType<typeof useTheme>;
  featured?: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {featured ? <Ionicons name="star" size={13} color={theme.brand} /> : null}
        <Text
          style={{
            fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase',
            color: featured ? theme.brand : theme.textSecondary,
          }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {items.map((m) => (
          <Pressable
            key={m.route}
            onPress={() => onOpen(m.route)}
            style={({ pressed }) => ({ width: '47.8%', flexGrow: 1, opacity: pressed ? 0.75 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={m.title}>
            <View
              style={{
                gap: 8, minHeight: 96, padding: 14, borderRadius: 14, borderWidth: 1,
                backgroundColor: theme.backgroundElement, borderColor: theme.border, justifyContent: 'space-between',
              }}>
              <View
                style={{
                  width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: theme.brand + '1A',
                }}>
                <Ionicons name={m.icon} size={19} color={theme.brand} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{m.title}</Text>
                {m.description ? (
                  <Text style={{ color: theme.textSecondary, fontSize: 11.5 }} numberOfLines={1}>{m.description}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
