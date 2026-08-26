import type { UserRole } from "@/lib/api/auth";

export interface ModuleCard {
  href: string;
  title: string;
  description: string;
  icon: string;
  group: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Genel Merkez YÃÂ¶neticisi",
  BRANCH_ADMIN: "ÃÂube YÃÂ¶neticisi",
  GUIDANCE_COORDINATOR: "Rehber ÃÂÃÂretmen",
  ACCOUNTING: "Muhasebe GÃÂ¶revlisi",
  TEACHER: "ÃÂÃÂretmen",
  STUDENT: "ÃÂÃÂrenci",
  PARENT: "Veli",
};

const BUGUN_CARD: ModuleCard = { href: "/bugun", title: "BugÃÂ¼n", description: "DevamsÃÂ±zlÃÂ±k, ÃÂ¶deme, veli gÃÂ¶rÃÂ¼ÃÂmesi ve aktivite akÃÂ±ÃÂÃÂ±nÃÂ±n gÃÂ¼nlÃÂ¼k ÃÂ¶zeti.", icon: "chart", group: "Genel BakÃÂ±ÃÂ" };
const YONETIM_PANELI_CARD: ModuleCard = { href: "/yonetim-paneli", title: "Yönetim Paneli", description: "Doluluk, tahsilat, ciro, akademik başarı ve kadro KPI’ları tek ekranda.", icon: "chart", group: "Genel Bakış" };
const GUNLUK_OPS_CARD: ModuleCard = { href: "/gunluk-operasyon", title: "GÃÂ¼nlÃÂ¼k Operasyon", description: "Geciken/yaklaÃÂan ÃÂ¶demeler ve bugÃÂ¼nkÃÂ¼ etÃÂ¼t doluluÃÂu.", icon: "clock", group: "YÃÂ¶netim & Finans" };
const CRM_CARD: ModuleCard = { href: "/crm", title: "CRM", description: "ÃÂn KayÃÂ±t ÃÂ¶ncesi aday ÃÂ¶ÃÂrencileri statÃÂ¼ bazÃÂ±nda takip edin.", icon: "kanban", group: "KayÃÂ±t ÃÂ°ÃÂlemleri" };
const ON_KAYIT_CARD: ModuleCard = { href: "/on-kayit", title: "ÃÂÃÂrenci ÃÂn KayÃÂ±t", description: "Aday ÃÂ¶ÃÂrenci ÃÂ¶n kaydÃÂ± oluÃÂturma ve tam kayda dÃÂ¶nÃÂ¼ÃÂtÃÂ¼rme.", icon: "users", group: "KayÃÂ±t ÃÂ°ÃÂlemleri" };
const OGRENCILER_CARD: ModuleCard = { href: "/ogrenciler", title: "ÃÂÃÂrenciler", description: "TÃÂ¼m ÃÂ¶ÃÂrenci kaydÃÂ±, arama ve sÃÂ±nÃÂ±f atama.", icon: "seat", group: "KayÃÂ±t ÃÂ°ÃÂlemleri" };
const NORMAL_KAYIT_CARD: ModuleCard = { href: "/normal-kayit", title: "Normal KayÃÂ±t", description: "ÃÂn kaydÃÂ± olan bir adayÃÂ± sÃÂ¶zleÃÂme ve ÃÂ¶deme planÃÂ±yla tam kayda dÃÂ¶nÃÂ¼ÃÂtÃÂ¼rÃÂ¼n.", icon: "check", group: "KayÃÂ±t ÃÂ°ÃÂlemleri" };
const ODEME_YONTEMLERI_CARD: ModuleCard = { href: "/odeme-yontemleri", title: "ÃÂdeme YÃÂ¶ntemleri", description: "ÃÂÃÂrenci bazÃÂ±nda kayÃÂ±tlÃÂ± kart/havale/nakit ÃÂ¶deme aracÃÂ±.", icon: "cardIcon", group: "KayÃÂ±t ÃÂ°ÃÂlemleri" };
const MUHASEBE_CARD: ModuleCard = { href: "/muhasebe", title: "Muhasebe", description: "KayÃÂ±t defteri, tahsilat takibi, bordro, belgeler.", icon: "ledger", group: "YÃÂ¶netim & Finans" };
const RESMI_MUHASEBE_CARD: ModuleCard = { href: "/resmi-muhasebe", title: "Resmi Muhasebe", description: "ÃÂift taraflÃÂ± yevmiye, hesap planÃÂ±, mizan, gelir tablosu ve bilanÃÂ§o.", icon: "ledger", group: "YÃÂ¶netim & Finans" };
const PERSONEL_CARD: ModuleCard = { href: "/personel", title: "Personel", description: "ÃÂÃÂretmen dÃÂ±ÃÂÃÂ± personel (ÃÂube MÃÂ¼dÃÂ¼rÃÂ¼, ÃÂn BÃÂ¼ro, Muhasebe, Rehber ÃÂÃÂretmen).", icon: "users", group: "YÃÂ¶netim & Finans" };
const ROLLER_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "Personelin sistem rolÃÂ¼nÃÂ¼ (yetki seviyesini) deÃÂiÃÂtirin.", icon: "shield", group: "YÃÂ¶netim & Finans" };
// Bare SUPERADMIN (henÃÂ¼z bir ÃÂubeye "Bu ÃÂube Olarak YÃÂ¶net" ile geÃÂ§memiÃÂ Genel
// Merkez) iÃÂ§in AYNI /roller sayfasÃÂ± salt-okunur ÃÂ§apraz-ÃÂube moduna geÃÂ§er (task
// #100, bkz. RolesDashboard.tsx isHqCrossBranch) Ã¢ÂÂ kart metni buna gÃÂ¶re farklÃÂ±.
const ROLLER_HQ_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "TÃÂ¼m ÃÂubelerdeki personel/ÃÂ¶ÃÂrenci/veli kullanÃÂ±cÃÂ± adlarÃÂ±nÃÂ± salt-okunur gÃÂ¶rÃÂ¼ntÃÂ¼leyin.", icon: "shield", group: "YÃÂ¶netim & Finans" };
const OGRETMEN_PERF_CARD: ModuleCard = { href: "/ogretmen-performansi", title: "ÃÂÃÂretmen PerformansÃÂ±", description: "BranÃÂ bazÃÂ±nda ortalama baÃÂarÃÂ± yÃÂ¼zdesi Ã¢ÂÂ gerÃÂ§ek sÃÂ±nav verisinden.", icon: "chart", group: "YÃÂ¶netim & Finans" };
const DEVAMSIZLIK_CARD: ModuleCard = { href: "/devamsizlik", title: "DevamsÃÂ±zlÃÂ±k", description: "SÃÂ±nÃÂ±f bazlÃÂ± yoklama alma ve devamsÃÂ±zlÃÂ±k geÃÂ§miÃÂi.", icon: "calendar", group: "Akademik" };
const DERS_PROGRAMI_CARD: ModuleCard = { href: "/ders-programi", title: "Ders ProgramÃÂ±", description: "HaftalÃÂ±k ders programÃÂ±.", icon: "clock", group: "Akademik" };
const SINIFLARIM_CARD: ModuleCard = { href: "/siniflarim", title: "SÃÂ±nÃÂ±flarÃÂ±m", description: "Ders verdiÃÂiniz sÃÂ±nÃÂ±flarÃÂ±n ÃÂ¶ÃÂrenci listesi.", icon: "users", group: "Akademik" };
const KARNE_CARD: ModuleCard = { href: "/karne", title: "Karne", description: "SÃÂ±nav geÃÂ§miÃÂi, ders bazlÃÂ± baÃÂarÃÂ± ve devamsÃÂ±zlÃÂ±k ÃÂ¶zeti.", icon: "ledger", group: "Akademik" };
const DEVAMSIZLIGIM_CARD: ModuleCard = { href: "/devamsizligim", title: "DevamsÃÂ±zlÃÂ±ÃÂÃÂ±m", description: "TÃÂ¼m yoklama geÃÂ§miÃÂiniz.", icon: "calendar", group: "Akademik" };
const DAVRANIS_NOTLARIM_CARD: ModuleCard = { href: "/davranis-notlarim", title: "DavranÃÂ±ÃÂ NotlarÃÂ±m", description: "Olumlu/olumsuz davranÃÂ±ÃÂ kayÃÂ±tlarÃÂ±nÃÂ±z.", icon: "shield", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const DISIPLIN_CARD: ModuleCard = { href: "/disiplin", title: "Disiplin", description: "Olumlu/olumsuz davranÃÂ±ÃÂ kaydÃÂ± ekleme ve geÃÂ§miÃÂi.", icon: "shield", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const VELI_GORUSME_CARD: ModuleCard = { href: "/veli-gorusme", title: "Veli GÃÂ¶rÃÂ¼ÃÂmeleri", description: "Veli-ÃÂ¶ÃÂretmen gÃÂ¶rÃÂ¼ÃÂme randevusu talep etme ve onaylama.", icon: "users", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const KULUPLER_CARD: ModuleCard = { href: "/kulupler", title: "KulÃÂ¼pler", description: "KulÃÂ¼p oluÃÂturma, danÃÂ±ÃÂman atama ve ÃÂ¼yelik yÃÂ¶netimi.", icon: "flag", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const AKTIVITE_CARD: ModuleCard = { href: "/aktivite", title: "Aktivite AkÃÂ±ÃÂÃÂ±", description: "Kritik iÃÂlemlerin denetim izi.", icon: "clock", group: "YÃÂ¶netim & Finans" };
const SERVIS_CARD: ModuleCard = { href: "/servis", title: "Servis", description: "Servis gÃÂ¼zergahlarÃÂ±, ÃÂofÃÂ¶r bilgisi ve ÃÂ¶ÃÂrenci atamasÃÂ±.", icon: "bus", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const QUIZ_CARD: ModuleCard = { href: "/quiz", title: "Pratik Quiz", description: "Ders bazlÃÂ± hÃÂ±zlÃÂ± pratik denemeleri ve geÃÂ§miÃÂ sonuÃÂ§lar.", icon: "help", group: "Akademik" };
const RAPORLAR_CARD: ModuleCard = { href: "/raporlar", title: "Raporlar", description: "ÃÂÃÂrenci, personel, devamsÃÂ±zlÃÂ±k, sÃÂ±nav ve mali ÃÂ¶zet raporlarÃÂ±.", icon: "download", group: "YÃÂ¶netim & Finans" };
const KURUMLAR_CARD: ModuleCard = { href: "/kurumlar", title: "Kurum YÃÂ¶netimi", description: "TÃÂ¼m ÃÂubelerin ÃÂ¶ÃÂrenci/personel/sÃÂ±nÃÂ±f sayÃÂ±larÃÂ± ve konsolide mali ÃÂ¶zet.", icon: "briefcase", group: "Genel BakÃÂ±ÃÂ" };
const SUBE_HARITASI_CARD: ModuleCard = { href: "/sube-haritasi", title: "ÃÂube Performans HaritasÃÂ±", description: "TÃÂ¼rkiye haritasÃÂ±nda gerÃÂ§ek doluluk/tahsilat/ciro verisi.", icon: "map", group: "Genel BakÃÂ±ÃÂ" };
const ANALYTICS_CARD: ModuleCard = { href: "/analytics", title: "Global Analytics", description: "TÃÂ¼m ÃÂubelerin konsolide akademik baÃÂarÃÂ± ve gelir analizi.", icon: "chart", group: "Genel BakÃÂ±ÃÂ" };
const ILETISIM_CARD: ModuleCard = { href: "/iletisim", title: "ÃÂ°letiÃÂim", description: "ÃÂÃÂrenci/veli/ÃÂ¶ÃÂretmenlere mesaj gÃÂ¶nderme ve gelen kutusu.", icon: "bell", group: "DiÃÂer" };
// Bare SUPERADMIN iÃÂ§in AYNI /iletisim sayfasÃÂ± "TÃÂ¼m Sistem" yayÃÂ±n moduna geÃÂ§er
// (task #101, bkz. MessagesDashboard.tsx isHqBroadcast) Ã¢ÂÂ kart metni buna gÃÂ¶re.
const ILETISIM_HQ_CARD: ModuleCard = { href: "/iletisim", title: "ÃÂ°letiÃÂim", description: "TÃÂ¼m ÃÂubelere tek seferde duyuru/mesaj yayÃÂ±nlayÃÂ±n.", icon: "bell", group: "DiÃÂer" };
const MESAJLASMA_CARD: ModuleCard = { href: "/mesajlasma", title: "MesajlaÅma", description: "VeliâÃ¶Äretmen birebir yazÄ±Åma.", icon: "send", group: "ÃÄrenci YaÅamÄ±" };
const MENTOR_CARD: ModuleCard = { href: "/mentor", title: "Seviye MentÃÂ¶r", description: "Otomatik atanan mentÃÂ¶r ÃÂ¶ÃÂretmenle online randevu talebi.", icon: "road", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const ETUT_ONAYI_CARD: ModuleCard = { href: "/etut-onayi", title: "EtÃÂ¼t OnayÃÂ±", description: "Yapay zekanÃÂ±n ÃÂ¶nerdiÃÂi etÃÂ¼t seanslarÃÂ±nÃÂ± onaylama/reddetme.", icon: "heart", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const ETUT_CARD: ModuleCard = { href: "/etut", title: "EtÃÂ¼t", description: "ÃÂubedeki tÃÂ¼m etÃÂ¼t taleplerinin genel gÃÂ¶rÃÂ¼nÃÂ¼mÃÂ¼.", icon: "heart", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const ETUT_RANDEVU_CARD: ModuleCard = { href: "/etut-randevularim", title: "EtÃÂ¼t RandevularÃÂ±m", description: "ÃÂnerilen ve onaylanmÃÂ±ÃÂ etÃÂ¼t seanslarÃÂ±nÃÂ±z.", icon: "heart", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const BASARI_CARD: ModuleCard = { href: "/basari", title: "BaÃÂarÃÂ± Rozetlerim", description: "XP, seviye ve rozetler.", icon: "trophy", group: "Ben" };
const LEADERBOARD_CARD: ModuleCard = { href: "/basari", title: "Lider Tablosu", description: "ÃÂÃÂrencilerin gerÃÂ§ek katÃÂ±lÃÂ±m/baÃÂarÃÂ± verisinden hesaplanan XP sÃÂ±ralamasÃÂ±.", icon: "trophy", group: "Akademik" };
const ROADMAP_CARD: ModuleCard = { href: "/yol-haritasi", title: "Akademik Yol Haritam", description: "Net ortalama, hedef ve sÃÂ±nav/kazanÃÂ±m verisinden hesaplanan kiÃÂiye ÃÂ¶zel AI tavsiyesi.", icon: "road", group: "Akademik" };
const ODEME_ISLEMLERIM_CARD: ModuleCard = { href: "/odeme-islemlerim", title: "ÃÂdeme ÃÂ°ÃÂlemleri", description: "ÃÂocuÃÂunuzun taksit durumu ve ÃÂ¶deme iÃÂlemleri.", icon: "wallet", group: "Ben" };
const PROFILIM_CARD: ModuleCard = { href: "/profilim", title: "Profilim", description: "Hesap bilgileriniz ve ÃÂifre deÃÂiÃÂikliÃÂi.", icon: "users", group: "DiÃÂer" };
const GUVENLIK_CARD: ModuleCard = { href: "/guvenlik", title: "GÃÂ¼venlik", description: "ÃÂ°ki faktÃÂ¶rlÃÂ¼ doÃÂrulama (authenticator) kurulumu.", icon: "lock", group: "DiÃÂer" };
const SINAV_BELGESI_CARD: ModuleCard = { href: "/sinav-belgesi", title: "QR SÃÂ±nav Belgesi", description: "GirdiÃÂiniz sÃÂ±navlar iÃÂ§in kimlik/salon belgesi.", icon: "qr", group: "Akademik" };
const OLCME_CARD: ModuleCard = { href: "/olcme-degerlendirme", title: "ÃÂlÃÂ§me-DeÃÂerlendirme", description: "SÃÂ±nav uygulamasÃÂ± oluÃÂturma, sonuÃÂ§ giriÃÂi ve kazanÃÂ±m analizi.", icon: "chart", group: "Akademik" };
const SINAV_SONUCLARIM_CARD: ModuleCard = { href: "/sinav-sonuclarim", title: "SÃÂ±nav SonuÃÂ§larÃÂ±m", description: "SÃÂ±nav bazlÃÂ± doÃÂru/yanlÃÂ±ÃÂ/boÃÂ, kazanÃÂ±m kÃÂ±rÃÂ±lÃÂ±mÃÂ± ve kazanÃÂ±m geliÃÂimi.", icon: "chart", group: "Akademik" };

// --- K12NET parite modÃÂ¼lleri (12 yeni modÃÂ¼l) ---
const TAKVIM_CARD: ModuleCard = { href: "/takvim", title: "Takvim", description: "Kurum geneli etkinlik takvimi ve kiÃÂisel ajanda.", icon: "calendar", group: "Genel BakÃÂ±ÃÂ" };
const ODEVLER_CARD: ModuleCard = { href: "/odevler", title: "ÃÂdevler", description: "ÃÂdev verme, teslim takibi ve deÃÂerlendirme.", icon: "book", group: "Akademik" };
const ODEVLERIM_CARD: ModuleCard = { href: "/odevlerim", title: "ÃÂdevlerim", description: "ÃÂdevlerinizi gÃÂ¶rÃÂ¼n, dosya/metin ile teslim edin, notunuzu gÃÂ¶rÃÂ¼n.", icon: "book", group: "Akademik" };
const KURSLAR_CARD: ModuleCard = { href: "/kurslar", title: "Kurslar", description: "Kredili ders/kurs kataloÃÂu ve sÃÂ±nÃÂ±f seviyeleri.", icon: "book", group: "Akademik" };
const YEMEKHANE_CARD: ModuleCard = { href: "/yemekhane", title: "Yemekhane", description: "Yemek ÃÂ¼rÃÂ¼nleri ve seviyeye gÃÂ¶re gÃÂ¼nlÃÂ¼k menÃÂ¼ planÃÂ±.", icon: "grid", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const SAGLIK_CARD: ModuleCard = { href: "/saglik", title: "SaÃÂlÃÂ±k / Revir", description: "TÃÂ±bbi vaka takibi ve saÃÂlÃÂ±k tarama kampanyalarÃÂ±.", icon: "heart", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const ETKINLIKLER_CARD: ModuleCard = { href: "/etkinlikler", title: "Sosyal Etkinlik", description: "Gezi/tÃÂ¶ren/etkinlik ve katÃÂ±lÃÂ±m yÃÂ¶netimi.", icon: "star", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const REHBERLIK_OLAY_CARD: ModuleCard = { href: "/rehberlik-olay", title: "Rehberlik Olay Takibi", description: "Rehberlik vaka/olay kaydÃÂ± ve iÃÂ akÃÂ±ÃÂÃÂ±.", icon: "flag", group: "ÃÂÃÂrenci YaÃÂamÃÂ±" };
const ANKETLER_CARD: ModuleCard = { href: "/anketler", title: "Anketler", description: "Veli/ÃÂ¶ÃÂrenci/personel memnuniyet anketleri.", icon: "chart", group: "YÃÂ¶netim & Finans" };
const GOREVLER_CARD: ModuleCard = { href: "/gorevler", title: "GÃÂ¶revler & Onaylar", description: "Kurumsal gÃÂ¶rev ve onay iÃÂ akÃÂ±ÃÂÃÂ±.", icon: "kanban", group: "YÃÂ¶netim & Finans" };
const ZIYARETCI_CARD: ModuleCard = { href: "/ziyaretci", title: "ZiyaretÃÂ§i", description: "Okul giriÃÂinde ziyaretÃÂ§i giriÃÂ/ÃÂ§ÃÂ±kÃÂ±ÃÂ kaydÃÂ±.", icon: "users", group: "YÃÂ¶netim & Finans" };
const MEZUNLAR_CARD: ModuleCard = { href: "/mezunlar", title: "Mezun YÃÂ¶netimi", description: "Mezun profili, ÃÂ¼niversite ve iÃÂ takibi.", icon: "trophy", group: "YÃÂ¶netim & Finans" };
const DONEM_GECISLERI_CARD: ModuleCard = { href: "/donem-gecisleri", title: "DÃÂ¶nem GeÃÂ§iÃÂleri", description: "Akademik yÃÂ±l yÃÂ¶netimi ve sÃÂ±nÃÂ±f geÃÂ§iÃÂi (2050'ye kadar).", icon: "clock", group: "YÃÂ¶netim & Finans" };

export const MODULES_BY_ROLE: Record<UserRole, ModuleCard[]> = {
  BRANCH_ADMIN: [BUGUN_CARD, YONETIM_PANELI_CARD, TAKVIM_CARD, GUNLUK_OPS_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, DONEM_GECISLERI_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, ROLLER_CARD, OGRETMEN_PERF_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, KURSLAR_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, ETUT_CARD, SERVIS_CARD, YEMEKHANE_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ZIYARETCI_CARD, MEZUNLAR_CARD, AKTIVITE_CARD, RAPORLAR_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  ACCOUNTING: [GUNLUK_OPS_CARD, TAKVIM_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, GOREVLER_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  // 3. denetim bulgusu Ã¢ÂÂ GUIDANCE_COORDINATOR zaten hem mesaj gelen kutusuna
  // (app/api/messages/inbox rol kÃÂ±sÃÂ±tsÃÂ±z) hem Karne'ye (report-card route
  // STAFF_ROLES'ta zaten vardÃÂ±) eriÃÂebiliyordu, yalnÃÂ±zca nav kartÃÂ± eksikti.
  GUIDANCE_COORDINATOR: [TAKVIM_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ETUT_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  TEACHER: [TAKVIM_CARD, SINIFLARIM_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, GOREVLER_CARD, ETUT_ONAYI_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  STUDENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  PARENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, BASARI_CARD, ODEME_ISLEMLERIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  SUPERADMIN: [SUBE_HARITASI_CARD, ANALYTICS_CARD, KURUMLAR_CARD, ROLLER_HQ_CARD, OLCME_CARD, ILETISIM_HQ_CARD, GUVENLIK_CARD, PROFILIM_CARD],
};

/**
 * Genel Merkez (SUPERADMIN) demo'daki HQ portalÃÂ± gibi TÃÂM modÃÂ¼llere her
 * zaman eriÃÂebilir Ã¢ÂÂ actingTenantId'ye baÃÂlÃÂ± deÃÂil. Tek-ÃÂube ekranlarÃÂ±nda
 * (SÃÂ±nÃÂ±f Atama, Personel, Muhasebe, EtÃÂ¼t, vb.) HqBranchSelector ekranÃÂ±n
 * ÃÂ¼stÃÂ¼nde gÃÂ¶mÃÂ¼lÃÂ¼ ÃÂube seÃÂ§ici sunar (bkz. components/hq/HqBranchSelector),
 * demo'daki hqBranchSelectorHtml deseninin karÃÂÃÂ±lÃÂ±ÃÂÃÂ± Ã¢ÂÂ Kurumlar > "Bu ÃÂube
 * Olarak YÃÂ¶net"e gitmeye gerek kalmaz. ROLLER/ÃÂ°LETÃÂ°ÃÂÃÂ°M/ÃÂLÃÂME kartlarÃÂ± HQ
 * varyantlarÃÂ±nÃÂ± kullanÃÂ±r (bkz. RolesDashboard/MessagesDashboard/
 * OlcmeDegerlendirmeView'daki bare-SUPERADMIN ÃÂ§apraz-ÃÂube ÃÂ¶zel davranÃÂ±ÃÂÃÂ±).
 *
 * AyrÃÂ±ca TEACHER/STUDENT/PARENT'e ÃÂ¶zgÃÂ¼ "kendi verim" self-servis ekranlarÃÂ±
 * (SÃÂ±nÃÂ±flarÃÂ±m, DevamsÃÂ±zlÃÂ±ÃÂÃÂ±m, vb.) de dahildir Ã¢ÂÂ bunlar normalde tek bir
 * ÃÂ¶ÃÂretmen/ÃÂ¶ÃÂrenci/veli kimliÃÂine baÃÂlÃÂ±dÃÂ±r, bu yÃÂ¼zden HQ iÃÂ§in ayrÃÂ±ca bir
 * HqTeacherPicker/useHqStudentRoster ile "hangi ÃÂ¶ÃÂretmen/ÃÂ¶ÃÂrenci gibi
 * gÃÂ¶rÃÂ¼ntÃÂ¼lensin" seÃÂ§imi eklendi (bkz. components/hq/HqTeacherPicker.tsx,
 * lib/hq-student-roster.ts). BASARI_CARD kasÃÂ±tlÃÂ± olarak DAHÃÂ°L DEÃÂÃÂ°LDÃÂ°R:
 * href'i LEADERBOARD_CARD ile aynÃÂ±dÃÂ±r (/basari) ve GamificationDashboard
 * SUPERADMIN'i zaten her zaman (branÃÂ bazlÃÂ±) Lider Tablosu gÃÂ¶rÃÂ¼nÃÂ¼mÃÂ¼ne
 * yÃÂ¶nlendiriyor Ã¢ÂÂ "kendi rozetlerim" gÃÂ¶rÃÂ¼nÃÂ¼mÃÂ¼ HQ iÃÂ§in anlamsÃÂ±z/yinelenen olurdu.
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

// Grup gÃÂ¶rÃÂ¼ntÃÂ¼leme sÃÂ±rasÃÂ± Ã¢ÂÂ demo'daki sidebar grup sÃÂ±ralamasÃÂ±yla aynÃÂ± mantÃÂ±k.
export const GROUP_ORDER = ["Genel BakÃÂ±ÃÂ", "KayÃÂ±t ÃÂ°ÃÂlemleri", "Akademik", "ÃÂÃÂrenci YaÃÂamÃÂ±", "YÃÂ¶netim & Finans", "Ben", "DiÃÂer"];

export function groupModules(modules: ModuleCard[]): { label: string; items: ModuleCard[] }[] {
  const byLabel = new Map<string, ModuleCard[]>();
  for (const m of modules) {
    if (!byLabel.has(m.group)) byLabel.set(m.group, []);
    byLabel.get(m.group)!.push(m);
  }
  return GROUP_ORDER.filter((g) => byLabel.has(g)).map((label) => ({ label, items: byLabel.get(label)! }));
}
