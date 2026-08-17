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
const GUNLUK_OPS_CARD: ModuleCard = { href: "/gunluk-operasyon", title: "Günlük Operasyon", description: "Geciken/yaklaşan ödemeler ve bugünkü etüt doluluğu.", icon: "clock", group: "Yönetim & Finans" };
const CRM_CARD: ModuleCard = { href: "/crm", title: "CRM", description: "Ön Kayıt öncesi aday öğrencileri statü bazında takip edin.", icon: "kanban", group: "Kayıt İşlemleri" };
const ON_KAYIT_CARD: ModuleCard = { href: "/on-kayit", title: "Öğrenci Ön Kayıt", description: "Aday öğrenci ön kaydı oluşturma ve tam kayda dönüştürme.", icon: "users", group: "Kayıt İşlemleri" };
const OGRENCILER_CARD: ModuleCard = { href: "/ogrenciler", title: "Öğrenciler", description: "Tüm öğrenci kaydı, arama ve sınıf atama.", icon: "seat", group: "Kayıt İşlemleri" };
const NORMAL_KAYIT_CARD: ModuleCard = { href: "/normal-kayit", title: "Normal Kayıt", description: "Ön kaydı olan bir adayı sözleşme ve ödeme planıyla tam kayda dönüştürün.", icon: "check", group: "Kayıt İşlemleri" };
const ODEME_YONTEMLERI_CARD: ModuleCard = { href: "/odeme-yontemleri", title: "Ödeme Yöntemleri", description: "Öğrenci bazında kayıtlı kart/havale/nakit ödeme aracı.", icon: "cardIcon", group: "Kayıt İşlemleri" };
const MUHASEBE_CARD: ModuleCard = { href: "/muhasebe", title: "Muhasebe", description: "Kayıt defteri, tahsilat takibi, bordro, belgeler.", icon: "ledger", group: "Yönetim & Finans" };
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
const ILETISIM_CARD: ModuleCard = { href: "/iletisim", title: "İletişim", description: "Öğrenci/veli/öğretmenlere mesaj gönderme ve gelen kutusu.", icon: "bell", group: "Diğer" };
// Bare SUPERADMIN için AYNI /iletisim sayfası "Tüm Sistem" yayın moduna geçer
// (task #101, bkz. MessagesDashboard.tsx isHqBroadcast) — kart metni buna göre.
const ILETISIM_HQ_CARD: ModuleCard = { href: "/iletisim", title: "İletişim", description: "Tüm şubelere tek seferde duyuru/mesaj yayınlayın.", icon: "bell", group: "Diğer" };
const MENTOR_CARD: ModuleCard = { href: "/mentor", title: "Seviye Mentör", description: "Otomatik atanan mentör öğretmenle online randevu talebi.", icon: "road", group: "Öğrenci Yaşamı" };
const ETUT_ONAYI_CARD: ModuleCard = { href: "/etut-onayi", title: "Etüt Onayı", description: "Yapay zekanın önerdiği etüt seanslarını onaylama/reddetme.", icon: "heart", group: "Öğrenci Yaşamı" };
const ETUT_CARD: ModuleCard = { href: "/etut", title: "Etüt", description: "Şubedeki tüm etüt taleplerinin genel görünümü.", icon: "heart", group: "Öğrenci Yaşamı" };
const ETUT_RANDEVU_CARD: ModuleCard = { href: "/etut-randevularim", title: "Etüt Randevularım", description: "Önerilen ve onaylanmış etüt seanslarınız.", icon: "heart", group: "Öğrenci Yaşamı" };
const BASARI_CARD: ModuleCard = { href: "/basari", title: "Başarı Rozetlerim", description: "XP, seviye ve rozetler.", icon: "trophy", group: "Ben" };
const LEADERBOARD_CARD: ModuleCard = { href: "/basari", title: "Lider Tablosu", description: "Öğrencilerin gerçek katılım/başarı verisinden hesaplanan XP sıralaması.", icon: "trophy", group: "Akademik" };
const ROADMAP_CARD: ModuleCard = { href: "/yol-haritasi", title: "Akademik Yol Haritam", description: "Net ortalama, hedef ve sınav/kazanım verisinden hesaplanan kişiye özel AI tavsiyesi.", icon: "road", group: "Akademik" };
const ODEME_ISLEMLERIM_CARD: ModuleCard = { href: "/odeme-islemlerim", title: "Ödeme İşlemleri", description: "Çocuğunuzun taksit durumu ve ödeme işlemleri.", icon: "wallet", group: "Ben" };
const PROFILIM_CARD: ModuleCard = { href: "/profilim", title: "Profilim", description: "Hesap bilgileriniz ve şifre değişikliği.", icon: "users", group: "Diğer" };
const SINAV_BELGESI_CARD: ModuleCard = { href: "/sinav-belgesi", title: "QR Sınav Belgesi", description: "Girdiğiniz sınavlar için kimlik/salon belgesi.", icon: "qr", group: "Akademik" };
const OLCME_CARD: ModuleCard = { href: "/olcme-degerlendirme", title: "Ölçme-Değerlendirme", description: "Sınav uygulaması oluşturma, sonuç girişi ve kazanım analizi.", icon: "chart", group: "Akademik" };
const SINAV_SONUCLARIM_CARD: ModuleCard = { href: "/sinav-sonuclarim", title: "Sınav Sonuçlarım", description: "Sınav bazlı doğru/yanlış/boş, kazanım kırılımı ve kazanım gelişimi.", icon: "chart", group: "Akademik" };

export const MODULES_BY_ROLE: Record<UserRole, ModuleCard[]> = {
  BRANCH_ADMIN: [BUGUN_CARD, GUNLUK_OPS_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, PERSONEL_CARD, ROLLER_CARD, OGRETMEN_PERF_CARD, OLCME_CARD, KARNE_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETUT_CARD, SERVIS_CARD, AKTIVITE_CARD, RAPORLAR_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD, PROFILIM_CARD],
  ACCOUNTING: [GUNLUK_OPS_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, PERSONEL_CARD, ILETISIM_CARD, PROFILIM_CARD],
  // 3. denetim bulgusu — GUIDANCE_COORDINATOR zaten hem mesaj gelen kutusuna
  // (app/api/messages/inbox rol kısıtsız) hem Karne'ye (report-card route
  // STAFF_ROLES'ta zaten vardı) erişebiliyordu, yalnızca nav kartı eksikti.
  GUIDANCE_COORDINATOR: [CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, OLCME_CARD, KARNE_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, ETUT_CARD, ILETISIM_CARD, PROFILIM_CARD],
  TEACHER: [SINIFLARIM_CARD, OLCME_CARD, KARNE_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETUT_ONAYI_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD, PROFILIM_CARD],
  STUDENT: [KARNE_CARD, SINAV_SONUCLARIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, KULUPLER_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD, PROFILIM_CARD],
  PARENT: [KARNE_CARD, SINAV_SONUCLARIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD, ODEME_ISLEMLERIM_CARD, PROFILIM_CARD],
  SUPERADMIN: [SUBE_HARITASI_CARD, KURUMLAR_CARD, ROLLER_HQ_CARD, OLCME_CARD, ILETISIM_HQ_CARD, PROFILIM_CARD],
};

/**
 * SUPERADMIN "Kurumlar" sayfasından "Bu Şube Olarak Yönet" ile bir şube
 * seçtiğinde (bkz. app/api/hq/acting-tenant, lib/db-context.ts
 * withBranchTenantContext) demo'daki HQ portalının "branch:" ekranlarına
 * düşen fallback'inin karşılığı: BRANCH_ADMIN'in TÜM modülleri + geri
 * dönmek için Kurumlar kartı.
 */
export function modulesForActor(role: UserRole, actingTenantId?: string | null): ModuleCard[] {
  if (role === "SUPERADMIN" && actingTenantId) {
    return [KURUMLAR_CARD, ...MODULES_BY_ROLE.BRANCH_ADMIN];
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
