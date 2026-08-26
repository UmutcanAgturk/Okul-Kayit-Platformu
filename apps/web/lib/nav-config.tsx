import type { UserRole } from "@/lib/api/auth";

export interface ModuleCard {
  href: string;
  title: string;
  description: string;
  icon: string;
  group: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Genel Merkez Yöneticisi",
  BRANCH_ADMIN: "Şube Yöneticisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
  ACCOUNTING: "Muhasebe Görevlisi",
  TEACHER: "Öğretmen",
  STUDENT: "Öğrenci",
  PARENT: "Veli",
};

const BUGUN_CARD: ModuleCard = { href: "/bugun", title: "Bugün", description: "Devamsızlık, ödeme, veli görüşmesi ve aktivite akışının günlük özeti.", icon: "chart", group: "Genel Bakış" };
const YONETIM_PANELI_CARD: ModuleCard = { href: "/yonetim-paneli", title: "Yönetim Paneli", description: "Doluluk, tahsilat, ciro, akademik başarı ve kadro KPI’ları tek ekranda.", icon: "chart", group: "Genel Bakış" };
const GUNLUK_OPS_CARD: ModuleCard = { href: "/gunluk-operasyon", title: "Günlük Operasyon", description: "Geciken/yaklaşan ödemeler ve bugünkü etüt doluluğu.", icon: "clock", group: "Yönetim & Finans" };
const CRM_CARD: ModuleCard = { href: "/crm", title: "CRM", description: "Ön Kayıt öncesi aday öğrencileri statü bazında takip edin.", icon: "kanban", group: "Kayıt İşlemleri" };
const ON_KAYIT_CARD: ModuleCard = { href: "/on-kayit", title: "Öğrenci Ön Kayıt", description: "Aday öğrenci ön kaydı oluşturma ve tam kayda dönüştürme.", icon: "users", group: "Kayıt İşlemleri" };
const OGRENCILER_CARD: ModuleCard = { href: "/ogrenciler", title: "Öğrenciler", description: "Tüm öğrenci kaydı, arama ve sınıf atama.", icon: "seat", group: "Kayıt İşlemleri" };
const NORMAL_KAYIT_CARD: ModuleCard = { href: "/normal-kayit", title: "Normal Kayıt", description: "Ön kaydı olan bir adayı sözleşme ve ödeme planıyla tam kayda dönüştürün.", icon: "check", group: "Kayıt İşlemleri" };
const ODEME_YONTEMLERI_CARD: ModuleCard = { href: "/odeme-yontemleri", title: "Ödeme Yöntemleri", description: "Öğrenci bazında kayıtlı kart/havale/nakit ödeme aracı.", icon: "cardIcon", group: "Kayıt İşlemleri" };
const MUHASEBE_CARD: ModuleCard = { href: "/muhasebe", title: "Muhasebe", description: "Kayıt defteri, tahsilat takibi, bordro, belgeler.", icon: "ledger", group: "Yönetim & Finans" };
const RESMI_MUHASEBE_CARD: ModuleCard = { href: "/resmi-muhasebe", title: "Resmi Muhasebe", description: "Çift taraflı yevmiye, hesap planı, mizan, gelir tablosu ve bilanço.", icon: "ledger", group: "Yönetim & Finans" };
const PERSONEL_CARD: ModuleCard = { href: "/personel", title: "Personel", description: "Öğretmen dışı personel (Şube Müdürü, Ön Büro, Muhasebe, Rehber Öğretmen).", icon: "users", group: "Yönetim & Finans" };
const ROLLER_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "Personelin sistem rolünü (yetki seviyesini) değiştirin.", icon: "shield", group: "Yönetim & Finans" };
// Bare SUPERADMIN (henüz bir şubeye "Bu Şube Olarak Yönet" ile geçmemiş Genel
// Merkez) için AYNI /roller sayfası salt-okunur çapraz-şube moduna geçer (task
// #100, bkz. RolesDashboard.tsx isHqCrossBranch) — kart metni buna göre farklı.
const ROLLER_HQ_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "Tüm şubelerdeki personel/öğrenci/veli kullanıcı adlarını salt-okunur görüntüleyin.", icon: "shield", group: "Yönetim & Finans" };
const OGRETMEN_PERF_CARD: ModuleCard = { href: "/ogretmen-performansi", title: "Öğretmen Performansı", description: "Branş bazında ortalama başarı yüzdesi — gerçek sınav verisinden.", icon: "chart", group: "Yönetim & Finans" };
const DEVAMSIZLIK_CARD: ModuleCard = { href: "/devamsizlik", title: "Devamsızlık", description: "Sınıf bazlı yoklama alma ve devamsızlık geçmişi.", icon: "calendar", group: "Akademik" };
const DERS_PROGRAMI_CARD: ModuleCard = { href: "/ders-programi", title: "Ders Programı", description: "Haftalık ders programı.", icon: "clock", group: "Akademik" };
const SINIFLARIM_CARD: ModuleCard = { href: "/siniflarim", title: "Sınıflarım", description: "Ders verdiğiniz sınıfların öğrenci listesi.", icon: "users", group: "Akademik" };
const KARNE_CARD: ModuleCard = { href: "/karne", title: "Karne", description: "Sınav geçmişi, ders bazlı başarı ve devamsızlık özeti.", icon: "ledger", group: "Akademik" };
const DEVAMSIZLIGIM_CARD: ModuleCard = { href: "/devamsizligim", title: "Devamsızlığım", description: "Tüm yoklama geçmişiniz.", icon: "calendar", group: "Akademik" };
const DAVRANIS_NOTLARIM_CARD: ModuleCard = { href: "/davranis-notlarim", title: "Davranış Notlarım", description: "Olumlu/olumsuz davranış kayıtlarınız.", icon: "shield", group: "Öğrenci Yaşamı" };
const DISIPLIN_CARD: ModuleCard = { href: "/disiplin", title: "Disiplin", description: "Olumlu/olumsuz davranış kaydı ekleme ve geçmişi.", icon: "shield", group: "Öğrenci Yaşamı" };
const VELI_GORUSME_CARD: ModuleCard = { href: "/veli-gorusme", title: "Veli Görüşmeleri", description: "Veli-öğretmen görüşme randevusu talep etme ve onaylama.", icon: "users", group: "Öğrenci Yaşamı" };
const KULUPLER_CARD: ModuleCard = { href: "/kulupler", title: "Kulüpler", description: "Kulüp oluşturma, danışman atama ve üyelik yönetimi.", icon: "flag", group: "Öğrenci Yaşamı" };
const AKTIVITE_CARD: ModuleCard = { href: "/aktivite", title: "Aktivite Akışı", description: "Kritik işlemlerin denetim izi.", icon: "clock", group: "Yönetim & Finans" };
const SERVIS_CARD: ModuleCard = { href: "/servis", title: "Servis", description: "Servis güzergahları, şoför bilgisi ve öğrenci ataması.", icon: "bus", group: "Öğrenci Yaşamı" };
const QUIZ_CARD: ModuleCard = { href: "/quiz", title: "Pratik Quiz", description: "Ders bazlı hızlı pratik denemeleri ve geçmiş sonuçlar.", icon: "help", group: "Akademik" };
const RAPORLAR_CARD: ModuleCard = { href: "/raporlar", title: "Raporlar", description: "Öğrenci, personel, devamsızlık, sınav ve mali özet raporları.", icon: "download", group: "Yönetim & Finans" };
const KURUMLAR_CARD: ModuleCard = { href: "/kurumlar", title: "Kurum Yönetimi", description: "Tüm şubelerin öğrenci/personel/sınıf sayıları ve konsolide mali özet.", icon: "briefcase", group: "Genel Bakış" };
const SUBE_HARITASI_CARD: ModuleCard = { href: "/sube-haritasi", title: "Şube Performans Haritası", description: "Türkiye haritasında gerçek doluluk/tahsilat/ciro verisi.", icon: "map", group: "Genel Bakış" };
const ANALYTICS_CARD: ModuleCard = { href: "/analytics", title: "Global Analytics", description: "Tüm şubelerin konsolide akademik başarı ve gelir analizi.", icon: "chart", group: "Genel Bakış" };
const ILETISIM_CARD: ModuleCard = { href: "/iletisim", title: "İletişim", description: "Öğrenci/veli/öğretmenlere mesaj gönderme ve gelen kutusu.", icon: "bell", group: "Diğer" };
// Bare SUPERADMIN için AYNI /iletisim sayfası "Tüm Sistem" yayın moduna geçer
// (task #101, bkz. MessagesDashboard.tsx isHqBroadcast) — kart metni buna göre.
const ILETISIM_HQ_CARD: ModuleCard = { href: "/iletisim", title: "İletişim", description: "Tüm şubelere tek seferde duyuru/mesaj yayınlayın.", icon: "bell", group: "Diğer" };
const MESAJLASMA_CARD: ModuleCard = { href: "/mesajlasma", title: "Mesajlaşma", description: "Veli–öğretmen birebir yazışma.", icon: "send", group: "Öğrenci Yaşamı" };
const MENTOR_CARD: ModuleCard = { href: "/mentor", title: "Seviye Mentör", description: "Otomatik atanan mentör öğretmenle online randevu talebi.", icon: "road", group: "Öğrenci Yaşamı" };
const ETUT_ONAYI_CARD: ModuleCard = { href: "/etut-onayi", title: "Etüt Onayı", description: "Yapay zekanın önerdiği etüt seanslarını onaylama/reddetme.", icon: "heart", group: "Öğrenci Yaşamı" };
const ETUT_CARD: ModuleCard = { href: "/etut", title: "Etüt", description: "Şubedeki tüm etüt taleplerinin genel görünümü.", icon: "heart", group: "Öğrenci Yaşamı" };
const ETUT_RANDEVU_CARD: ModuleCard = { href: "/etut-randevularim", title: "Etüt Randevularım", description: "Önerilen ve onaylanmış etüt seanslarınız.", icon: "heart", group: "Öğrenci Yaşamı" };
const BASARI_CARD: ModuleCard = { href: "/basari", title: "Başarı Rozetlerim", description: "XP, seviye ve rozetler.", icon: "trophy", group: "Ben" };
const LEADERBOARD_CARD: ModuleCard = { href: "/basari", title: "Lider Tablosu", description: "Öğrencilerin gerçek katılım/başarı verisinden hesaplanan XP sıralaması.", icon: "trophy", group: "Akademik" };
const ROADMAP_CARD: ModuleCard = { href: "/yol-haritasi", title: "Akademik Yol Haritam", description: "Net ortalama, hedef ve sınav/kazanım verisinden hesaplanan kişiye özel AI tavsiyesi.", icon: "road", group: "Akademik" };
const ODEME_ISLEMLERIM_CARD: ModuleCard = { href: "/odeme-islemlerim", title: "Ödeme İşlemleri", description: "Çocuğunuzun taksit durumu ve ödeme işlemleri.", icon: "wallet", group: "Ben" };
const PROFILIM_CARD: ModuleCard = { href: "/profilim", title: "Profilim", description: "Hesap bilgileriniz ve şifre değişikliği.", icon: "users", group: "Diğer" };
const GUVENLIK_CARD: ModuleCard = { href: "/guvenlik", title: "Güvenlik", description: "İki faktörlü doğrulama (authenticator) kurulumu.", icon: "lock", group: "Diğer" };
const SINAV_BELGESI_CARD: ModuleCard = { href: "/sinav-belgesi", title: "QR Sınav Belgesi", description: "Girdiğiniz sınavlar için kimlik/salon belgesi.", icon: "qr", group: "Akademik" };
const OLCME_CARD: ModuleCard = { href: "/olcme-degerlendirme", title: "Ölçme-Değerlendirme", description: "Sınav uygulaması oluşturma, sonuç girişi ve kazanım analizi.", icon: "chart", group: "Akademik" };
const SINAV_SONUCLARIM_CARD: ModuleCard = { href: "/sinav-sonuclarim", title: "Sınav Sonuçlarım", description: "Sınav bazlı doğru/yanlış/boş, kazanım kırılımı ve kazanım gelişimi.", icon: "chart", group: "Akademik" };

// --- K12NET parite modülleri (12 yeni modül) ---
const TAKVIM_CARD: ModuleCard = { href: "/takvim", title: "Takvim", description: "Kurum geneli etkinlik takvimi ve kişisel ajanda.", icon: "calendar", group: "Genel Bakış" };
const ODEVLER_CARD: ModuleCard = { href: "/odevler", title: "Ödevler", description: "Ödev verme, teslim takibi ve değerlendirme.", icon: "book", group: "Akademik" };
const ODEVLERIM_CARD: ModuleCard = { href: "/odevlerim", title: "Ödevlerim", description: "Ödevlerinizi görün, dosya/metin ile teslim edin, notunuzu görün.", icon: "book", group: "Akademik" };
const KURSLAR_CARD: ModuleCard = { href: "/kurslar", title: "Kurslar", description: "Kredili ders/kurs kataloğu ve sınıf seviyeleri.", icon: "book", group: "Akademik" };
const YEMEKHANE_CARD: ModuleCard = { href: "/yemekhane", title: "Yemekhane", description: "Yemek ürünleri ve seviyeye göre günlük menü planı.", icon: "grid", group: "Öğrenci Yaşamı" };
const SAGLIK_CARD: ModuleCard = { href: "/saglik", title: "Sağlık / Revir", description: "Tıbbi vaka takibi ve sağlık tarama kampanyaları.", icon: "heart", group: "Öğrenci Yaşamı" };
const ETKINLIKLER_CARD: ModuleCard = { href: "/etkinlikler", title: "Sosyal Etkinlik", description: "Gezi/tören/etkinlik ve katılım yönetimi.", icon: "star", group: "Öğrenci Yaşamı" };
const REHBERLIK_OLAY_CARD: ModuleCard = { href: "/rehberlik-olay", title: "Rehberlik Olay Takibi", description: "Rehberlik vaka/olay kaydı ve iş akışı.", icon: "flag", group: "Öğrenci Yaşamı" };
const ANKETLER_CARD: ModuleCard = { href: "/anketler", title: "Anketler", description: "Veli/öğrenci/personel memnuniyet anketleri.", icon: "chart", group: "Yönetim & Finans" };
const GOREVLER_CARD: ModuleCard = { href: "/gorevler", title: "Görevler & Onaylar", description: "Kurumsal görev ve onay iş akışı.", icon: "kanban", group: "Yönetim & Finans" };
const ZIYARETCI_CARD: ModuleCard = { href: "/ziyaretci", title: "Ziyaretçi", description: "Okul girişinde ziyaretçi giriş/çıkış kaydı.", icon: "users", group: "Yönetim & Finans" };
const MEZUNLAR_CARD: ModuleCard = { href: "/mezunlar", title: "Mezun Yönetimi", description: "Mezun profili, üniversite ve iş takibi.", icon: "trophy", group: "Yönetim & Finans" };
const DONEM_GECISLERI_CARD: ModuleCard = { href: "/donem-gecisleri", title: "Dönem Geçişleri", description: "Akademik yıl yönetimi ve sınıf geçişi (2050'ye kadar).", icon: "clock", group: "Yönetim & Finans" };

export const MODULES_BY_ROLE: Record<UserRole, ModuleCard[]> = {
  BRANCH_ADMIN: [BUGUN_CARD, YONETIM_PANELI_CARD, TAKVIM_CARD, GUNLUK_OPS_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, DONEM_GECISLERI_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, ROLLER_CARD, OGRETMEN_PERF_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, KURSLAR_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, ETUT_CARD, SERVIS_CARD, YEMEKHANE_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ZIYARETCI_CARD, MEZUNLAR_CARD, AKTIVITE_CARD, RAPORLAR_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  ACCOUNTING: [GUNLUK_OPS_CARD, TAKVIM_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, GOREVLER_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  // 3. denetim bulgusu — GUIDANCE_COORDINATOR zaten hem mesaj gelen kutusuna
  // (app/api/messages/inbox rol kısıtsız) hem Karne'ye (report-card route
  // STAFF_ROLES'ta zaten vardı) erişebiliyordu, yalnızca nav kartı eksikti.
  GUIDANCE_COORDINATOR: [TAKVIM_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ETUT_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  TEACHER: [TAKVIM_CARD, SINIFLARIM_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, GOREVLER_CARD, ETUT_ONAYI_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  STUDENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  PARENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, BASARI_CARD, ODEME_ISLEMLERIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  SUPERADMIN: [SUBE_HARITASI_CARD, ANALYTICS_CARD, KURUMLAR_CARD, ROLLER_HQ_CARD, OLCME_CARD, ILETISIM_HQ_CARD, GUVENLIK_CARD, PROFILIM_CARD],
};

/**
 * Genel Merkez (SUPERADMIN) demo'daki HQ portalı gibi TÜM modüllere her
 * zaman erişebilir — actingTenantId'ye bağlı değil. Tek-şube ekranlarında
 * (Sınıf Atama, Personel, Muhasebe, Etüt, vb.) HqBranchSelector ekranın
 * üstünde gömülü şube seçici sunar (bkz. components/hq/HqBranchSelector),
 * demo'daki hqBranchSelectorHtml deseninin karşılığı — Kurumlar > "Bu Şube
 * Olarak Yönet"e gitmeye gerek kalmaz. ROLLER/İLETİŞİM/ÖLÇME kartları HQ
 * varyantlarını kullanır (bkz. RolesDashboard/MessagesDashboard/
 * OlcmeDegerlendirmeView'daki bare-SUPERADMIN çapraz-şube özel davranışı).
 *
 * Ayrıca TEACHER/STUDENT/PARENT'e özgü "kendi verim" self-servis ekranları
 * (Sınıflarım, Devamsızlığım, vb.) de dahildir — bunlar normalde tek bir
 * öğretmen/öğrenci/veli kimliğine bağlıdır, bu yüzden HQ için ayrıca bir
 * HqTeacherPicker/useHqStudentRoster ile "hangi öğretmen/öğrenci gibi
 * görüntülensin" seçimi eklendi (bkz. components/hq/HqTeacherPicker.tsx,
 * lib/hq-student-roster.ts). BASARI_CARD kasıtlı olarak DAHİL DEĞİLDİR:
 * href'i LEADERBOARD_CARD ile aynıdır (/basari) ve GamificationDashboard
 * SUPERADMIN'i zaten her zaman (branş bazlı) Lider Tablosu görünümüne
 * yönlendiriyor — "kendi rozetlerim" görünümü HQ için anlamsız/yinelenen olurdu.
 */
const SUPERADMIN_SELF_SERVICE_CARDS: ModuleCard[] = [
  SINIFLARIM_CARD,
  DEVAMSIZLIGIM_CARD,
  DAVRANIS_NOTLARIM_CARD,
  QUIZ_CARD,
  ETUT_ONAYI_CARD,
  ETUT_RANDEVU_CARD,
  ROADMAP_CARD,
  ODEME_ISLEMLERIM_CARD,
  SINAV_BELGESI_CARD,
  SINAV_SONUCLARIM_CARD,
];

export function modulesForActor(role: UserRole, _actingTenantId?: string | null): ModuleCard[] {
  if (role === "SUPERADMIN") {
    const seen = new Set<string>();
    const all = [
      SUBE_HARITASI_CARD,
      ANALYTICS_CARD,
      KURUMLAR_CARD,
      ROLLER_HQ_CARD,
      ILETISIM_HQ_CARD,
      ...MODULES_BY_ROLE.BRANCH_ADMIN,
      ...SUPERADMIN_SELF_SERVICE_CARDS,
      GUVENLIK_CARD,
      PROFILIM_CARD,
    ];
    return all.filter((card) => {
      if (seen.has(card.href)) return false;
      seen.add(card.href);
      return true;
    });
  }
  return MODULES_BY_ROLE[role] ?? [];
}

// Grup görüntüleme sırası — demo'daki sidebar grup sıralamasıyla aynı mantık.
export const GROUP_ORDER = ["Genel Bakış", "Kayıt İşlemleri", "Akademik", "Öğrenci Yaşamı", "Yönetim & Finans", "Ben", "Diğer"];

export function groupModules(modules: ModuleCard[]): { label: string; items: ModuleCard[] }[] {
  const byLabel = new Map<string, ModuleCard[]>();
  for (const m of modules) {
    if (!byLabel.has(m.group)) byLabel.set(m.group, []);
    byLabel.get(m.group)!.push(m);
  }
  return GROUP_ORDER.filter((g) => byLabel.has(g)).map((label) => ({ label, items: byLabel.get(label)! }));
}
