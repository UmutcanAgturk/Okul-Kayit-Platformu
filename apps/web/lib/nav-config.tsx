import type { UserRole } from "@/lib/api/auth";

export interface ModuleCard {
  href: string;
  title: string;
  description: string;
  icon: string;
  group: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Genel Merkez YÃ¶neticisi",
  BRANCH_ADMIN: "Åube YÃ¶neticisi",
  GUIDANCE_COORDINATOR: "Rehber ÃÄretmen",
  ACCOUNTING: "Muhasebe GÃ¶revlisi",
  TEACHER: "ÃÄretmen",
  STUDENT: "ÃÄrenci",
  PARENT: "Veli",
};

const BUGUN_CARD: ModuleCard = { href: "/bugun", title: "BugÃ¼n", description: "DevamsÄ±zlÄ±k, Ã¶deme, veli gÃ¶rÃ¼Åmesi ve aktivite akÄ±ÅÄ±nÄ±n gÃ¼nlÃ¼k Ã¶zeti.", icon: "chart", group: "Genel BakÄ±Å" };
const GUNLUK_OPS_CARD: ModuleCard = { href: "/gunluk-operasyon", title: "GÃ¼nlÃ¼k Operasyon", description: "Geciken/yaklaÅan Ã¶demeler ve bugÃ¼nkÃ¼ etÃ¼t doluluÄu.", icon: "clock", group: "YÃ¶netim & Finans" };
const CRM_CARD: ModuleCard = { href: "/crm", title: "CRM", description: "Ãn KayÄ±t Ã¶ncesi aday Ã¶Ärencileri statÃ¼ bazÄ±nda takip edin.", icon: "kanban", group: "KayÄ±t Ä°Ålemleri" };
const ON_KAYIT_CARD: ModuleCard = { href: "/on-kayit", title: "ÃÄrenci Ãn KayÄ±t", description: "Aday Ã¶Ärenci Ã¶n kaydÄ± oluÅturma ve tam kayda dÃ¶nÃ¼ÅtÃ¼rme.", icon: "users", group: "KayÄ±t Ä°Ålemleri" };
const OGRENCILER_CARD: ModuleCard = { href: "/ogrenciler", title: "ÃÄrenciler", description: "TÃ¼m Ã¶Ärenci kaydÄ±, arama ve sÄ±nÄ±f atama.", icon: "seat", group: "KayÄ±t Ä°Ålemleri" };
const NORMAL_KAYIT_CARD: ModuleCard = { href: "/normal-kayit", title: "Normal KayÄ±t", description: "Ãn kaydÄ± olan bir adayÄ± sÃ¶zleÅme ve Ã¶deme planÄ±yla tam kayda dÃ¶nÃ¼ÅtÃ¼rÃ¼n.", icon: "check", group: "KayÄ±t Ä°Ålemleri" };
const ODEME_YONTEMLERI_CARD: ModuleCard = { href: "/odeme-yontemleri", title: "Ãdeme YÃ¶ntemleri", description: "ÃÄrenci bazÄ±nda kayÄ±tlÄ± kart/havale/nakit Ã¶deme aracÄ±.", icon: "cardIcon", group: "KayÄ±t Ä°Ålemleri" };
const MUHASEBE_CARD: ModuleCard = { href: "/muhasebe", title: "Muhasebe", description: "KayÄ±t defteri, tahsilat takibi, bordro, belgeler.", icon: "ledger", group: "YÃ¶netim & Finans" };
const RESMI_MUHASEBE_CARD: ModuleCard = { href: "/resmi-muhasebe", title: "Resmi Muhasebe", description: "Ãift taraflÄ± yevmiye, hesap planÄ±, mizan, gelir tablosu ve bilanÃ§o.", icon: "ledger", group: "YÃ¶netim & Finans" };
const PERSONEL_CARD: ModuleCard = { href: "/personel", title: "Personel", description: "ÃÄretmen dÄ±ÅÄ± personel (Åube MÃ¼dÃ¼rÃ¼, Ãn BÃ¼ro, Muhasebe, Rehber ÃÄretmen).", icon: "users", group: "YÃ¶netim & Finans" };
const ROLLER_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "Personelin sistem rolÃ¼nÃ¼ (yetki seviyesini) deÄiÅtirin.", icon: "shield", group: "YÃ¶netim & Finans" };
// Bare SUPERADMIN (henÃ¼z bir Åubeye "Bu Åube Olarak YÃ¶net" ile geÃ§memiÅ Genel
// Merkez) iÃ§in AYNI /roller sayfasÄ± salt-okunur Ã§apraz-Åube moduna geÃ§er (task
// #100, bkz. RolesDashboard.tsx isHqCrossBranch) â kart metni buna gÃ¶re farklÄ±.
const ROLLER_HQ_CARD: ModuleCard = { href: "/roller", title: "Roller", description: "TÃ¼m Åubelerdeki personel/Ã¶Ärenci/veli kullanÄ±cÄ± adlarÄ±nÄ± salt-okunur gÃ¶rÃ¼ntÃ¼leyin.", icon: "shield", group: "YÃ¶netim & Finans" };
const OGRETMEN_PERF_CARD: ModuleCard = { href: "/ogretmen-performansi", title: "ÃÄretmen PerformansÄ±", description: "BranÅ bazÄ±nda ortalama baÅarÄ± yÃ¼zdesi â gerÃ§ek sÄ±nav verisinden.", icon: "chart", group: "YÃ¶netim & Finans" };
const DEVAMSIZLIK_CARD: ModuleCard = { href: "/devamsizlik", title: "DevamsÄ±zlÄ±k", description: "SÄ±nÄ±f bazlÄ± yoklama alma ve devamsÄ±zlÄ±k geÃ§miÅi.", icon: "calendar", group: "Akademik" };
const DERS_PROGRAMI_CARD: ModuleCard = { href: "/ders-programi", title: "Ders ProgramÄ±", description: "HaftalÄ±k ders programÄ±.", icon: "clock", group: "Akademik" };
const SINIFLARIM_CARD: ModuleCard = { href: "/siniflarim", title: "SÄ±nÄ±flarÄ±m", description: "Ders verdiÄiniz sÄ±nÄ±flarÄ±n Ã¶Ärenci listesi.", icon: "users", group: "Akademik" };
const KARNE_CARD: ModuleCard = { href: "/karne", title: "Karne", description: "SÄ±nav geÃ§miÅi, ders bazlÄ± baÅarÄ± ve devamsÄ±zlÄ±k Ã¶zeti.", icon: "ledger", group: "Akademik" };
const DEVAMSIZLIGIM_CARD: ModuleCard = { href: "/devamsizligim", title: "DevamsÄ±zlÄ±ÄÄ±m", description: "TÃ¼m yoklama geÃ§miÅiniz.", icon: "calendar", group: "Akademik" };
const DAVRANIS_NOTLARIM_CARD: ModuleCard = { href: "/davranis-notlarim", title: "DavranÄ±Å NotlarÄ±m", description: "Olumlu/olumsuz davranÄ±Å kayÄ±tlarÄ±nÄ±z.", icon: "shield", group: "ÃÄrenci YaÅamÄ±" };
const DISIPLIN_CARD: ModuleCard = { href: "/disiplin", title: "Disiplin", description: "Olumlu/olumsuz davranÄ±Å kaydÄ± ekleme ve geÃ§miÅi.", icon: "shield", group: "ÃÄrenci YaÅamÄ±" };
const VELI_GORUSME_CARD: ModuleCard = { href: "/veli-gorusme", title: "Veli GÃ¶rÃ¼Åmeleri", description: "Veli-Ã¶Äretmen gÃ¶rÃ¼Åme randevusu talep etme ve onaylama.", icon: "users", group: "ÃÄrenci YaÅamÄ±" };
const KULUPLER_CARD: ModuleCard = { href: "/kulupler", title: "KulÃ¼pler", description: "KulÃ¼p oluÅturma, danÄ±Åman atama ve Ã¼yelik yÃ¶netimi.", icon: "flag", group: "ÃÄrenci YaÅamÄ±" };
const AKTIVITE_CARD: ModuleCard = { href: "/aktivite", title: "Aktivite AkÄ±ÅÄ±", description: "Kritik iÅlemlerin denetim izi.", icon: "clock", group: "YÃ¶netim & Finans" };
const SERVIS_CARD: ModuleCard = { href: "/servis", title: "Servis", description: "Servis gÃ¼zergahlarÄ±, ÅofÃ¶r bilgisi ve Ã¶Ärenci atamasÄ±.", icon: "bus", group: "ÃÄrenci YaÅamÄ±" };
const QUIZ_CARD: ModuleCard = { href: "/quiz", title: "Pratik Quiz", description: "Ders bazlÄ± hÄ±zlÄ± pratik denemeleri ve geÃ§miÅ sonuÃ§lar.", icon: "help", group: "Akademik" };
const RAPORLAR_CARD: ModuleCard = { href: "/raporlar", title: "Raporlar", description: "ÃÄrenci, personel, devamsÄ±zlÄ±k, sÄ±nav ve mali Ã¶zet raporlarÄ±.", icon: "download", group: "YÃ¶netim & Finans" };
const KURUMLAR_CARD: ModuleCard = { href: "/kurumlar", title: "Kurum YÃ¶netimi", description: "TÃ¼m Åubelerin Ã¶Ärenci/personel/sÄ±nÄ±f sayÄ±larÄ± ve konsolide mali Ã¶zet.", icon: "briefcase", group: "Genel BakÄ±Å" };
const SUBE_HARITASI_CARD: ModuleCard = { href: "/sube-haritasi", title: "Åube Performans HaritasÄ±", description: "TÃ¼rkiye haritasÄ±nda gerÃ§ek doluluk/tahsilat/ciro verisi.", icon: "map", group: "Genel BakÄ±Å" };
const ANALYTICS_CARD: ModuleCard = { href: "/analytics", title: "Global Analytics", description: "TÃ¼m Åubelerin konsolide akademik baÅarÄ± ve gelir analizi.", icon: "chart", group: "Genel BakÄ±Å" };
const ILETISIM_CARD: ModuleCard = { href: "/iletisim", title: "Ä°letiÅim", description: "ÃÄrenci/veli/Ã¶Äretmenlere mesaj gÃ¶nderme ve gelen kutusu.", icon: "bell", group: "DiÄer" };
// Bare SUPERADMIN iÃ§in AYNI /iletisim sayfasÄ± "TÃ¼m Sistem" yayÄ±n moduna geÃ§er
// (task #101, bkz. MessagesDashboard.tsx isHqBroadcast) â kart metni buna gÃ¶re.
const ILETISIM_HQ_CARD: ModuleCard = { href: "/iletisim", title: "Ä°letiÅim", description: "TÃ¼m Åubelere tek seferde duyuru/mesaj yayÄ±nlayÄ±n.", icon: "bell", group: "DiÄer" };
const MESAJLASMA_CARD: ModuleCard = { href: "/mesajlasma", title: "Mesajlaşma", description: "Veli–öğretmen birebir yazışma.", icon: "send", group: "Öğrenci Yaşamı" };
const MENTOR_CARD: ModuleCard = { href: "/mentor", title: "Seviye MentÃ¶r", description: "Otomatik atanan mentÃ¶r Ã¶Äretmenle online randevu talebi.", icon: "road", group: "ÃÄrenci YaÅamÄ±" };
const ETUT_ONAYI_CARD: ModuleCard = { href: "/etut-onayi", title: "EtÃ¼t OnayÄ±", description: "Yapay zekanÄ±n Ã¶nerdiÄi etÃ¼t seanslarÄ±nÄ± onaylama/reddetme.", icon: "heart", group: "ÃÄrenci YaÅamÄ±" };
const ETUT_CARD: ModuleCard = { href: "/etut", title: "EtÃ¼t", description: "Åubedeki tÃ¼m etÃ¼t taleplerinin genel gÃ¶rÃ¼nÃ¼mÃ¼.", icon: "heart", group: "ÃÄrenci YaÅamÄ±" };
const ETUT_RANDEVU_CARD: ModuleCard = { href: "/etut-randevularim", title: "EtÃ¼t RandevularÄ±m", description: "Ãnerilen ve onaylanmÄ±Å etÃ¼t seanslarÄ±nÄ±z.", icon: "heart", group: "ÃÄrenci YaÅamÄ±" };
const BASARI_CARD: ModuleCard = { href: "/basari", title: "BaÅarÄ± Rozetlerim", description: "XP, seviye ve rozetler.", icon: "trophy", group: "Ben" };
const LEADERBOARD_CARD: ModuleCard = { href: "/basari", title: "Lider Tablosu", description: "ÃÄrencilerin gerÃ§ek katÄ±lÄ±m/baÅarÄ± verisinden hesaplanan XP sÄ±ralamasÄ±.", icon: "trophy", group: "Akademik" };
const ROADMAP_CARD: ModuleCard = { href: "/yol-haritasi", title: "Akademik Yol Haritam", description: "Net ortalama, hedef ve sÄ±nav/kazanÄ±m verisinden hesaplanan kiÅiye Ã¶zel AI tavsiyesi.", icon: "road", group: "Akademik" };
const ODEME_ISLEMLERIM_CARD: ModuleCard = { href: "/odeme-islemlerim", title: "Ãdeme Ä°Ålemleri", description: "ÃocuÄunuzun taksit durumu ve Ã¶deme iÅlemleri.", icon: "wallet", group: "Ben" };
const PROFILIM_CARD: ModuleCard = { href: "/profilim", title: "Profilim", description: "Hesap bilgileriniz ve Åifre deÄiÅikliÄi.", icon: "users", group: "DiÄer" };
const GUVENLIK_CARD: ModuleCard = { href: "/guvenlik", title: "GÃ¼venlik", description: "Ä°ki faktÃ¶rlÃ¼ doÄrulama (authenticator) kurulumu.", icon: "lock", group: "DiÄer" };
const SINAV_BELGESI_CARD: ModuleCard = { href: "/sinav-belgesi", title: "QR SÄ±nav Belgesi", description: "GirdiÄiniz sÄ±navlar iÃ§in kimlik/salon belgesi.", icon: "qr", group: "Akademik" };
const OLCME_CARD: ModuleCard = { href: "/olcme-degerlendirme", title: "ÃlÃ§me-DeÄerlendirme", description: "SÄ±nav uygulamasÄ± oluÅturma, sonuÃ§ giriÅi ve kazanÄ±m analizi.", icon: "chart", group: "Akademik" };
const SINAV_SONUCLARIM_CARD: ModuleCard = { href: "/sinav-sonuclarim", title: "SÄ±nav SonuÃ§larÄ±m", description: "SÄ±nav bazlÄ± doÄru/yanlÄ±Å/boÅ, kazanÄ±m kÄ±rÄ±lÄ±mÄ± ve kazanÄ±m geliÅimi.", icon: "chart", group: "Akademik" };

// --- K12NET parite modÃ¼lleri (12 yeni modÃ¼l) ---
const TAKVIM_CARD: ModuleCard = { href: "/takvim", title: "Takvim", description: "Kurum geneli etkinlik takvimi ve kiÅisel ajanda.", icon: "calendar", group: "Genel BakÄ±Å" };
const ODEVLER_CARD: ModuleCard = { href: "/odevler", title: "Ãdevler", description: "Ãdev verme, teslim takibi ve deÄerlendirme.", icon: "book", group: "Akademik" };
const ODEVLERIM_CARD: ModuleCard = { href: "/odevlerim", title: "Ãdevlerim", description: "Ãdevlerinizi gÃ¶rÃ¼n, dosya/metin ile teslim edin, notunuzu gÃ¶rÃ¼n.", icon: "book", group: "Akademik" };
const KURSLAR_CARD: ModuleCard = { href: "/kurslar", title: "Kurslar", description: "Kredili ders/kurs kataloÄu ve sÄ±nÄ±f seviyeleri.", icon: "book", group: "Akademik" };
const YEMEKHANE_CARD: ModuleCard = { href: "/yemekhane", title: "Yemekhane", description: "Yemek Ã¼rÃ¼nleri ve seviyeye gÃ¶re gÃ¼nlÃ¼k menÃ¼ planÄ±.", icon: "grid", group: "ÃÄrenci YaÅamÄ±" };
const SAGLIK_CARD: ModuleCard = { href: "/saglik", title: "SaÄlÄ±k / Revir", description: "TÄ±bbi vaka takibi ve saÄlÄ±k tarama kampanyalarÄ±.", icon: "heart", group: "ÃÄrenci YaÅamÄ±" };
const ETKINLIKLER_CARD: ModuleCard = { href: "/etkinlikler", title: "Sosyal Etkinlik", description: "Gezi/tÃ¶ren/etkinlik ve katÄ±lÄ±m yÃ¶netimi.", icon: "star", group: "ÃÄrenci YaÅamÄ±" };
const REHBERLIK_OLAY_CARD: ModuleCard = { href: "/rehberlik-olay", title: "Rehberlik Olay Takibi", description: "Rehberlik vaka/olay kaydÄ± ve iÅ akÄ±ÅÄ±.", icon: "flag", group: "ÃÄrenci YaÅamÄ±" };
const ANKETLER_CARD: ModuleCard = { href: "/anketler", title: "Anketler", description: "Veli/Ã¶Ärenci/personel memnuniyet anketleri.", icon: "chart", group: "YÃ¶netim & Finans" };
const GOREVLER_CARD: ModuleCard = { href: "/gorevler", title: "GÃ¶revler & Onaylar", description: "Kurumsal gÃ¶rev ve onay iÅ akÄ±ÅÄ±.", icon: "kanban", group: "YÃ¶netim & Finans" };
const ZIYARETCI_CARD: ModuleCard = { href: "/ziyaretci", title: "ZiyaretÃ§i", description: "Okul giriÅinde ziyaretÃ§i giriÅ/Ã§Ä±kÄ±Å kaydÄ±.", icon: "users", group: "YÃ¶netim & Finans" };
const MEZUNLAR_CARD: ModuleCard = { href: "/mezunlar", title: "Mezun YÃ¶netimi", description: "Mezun profili, Ã¼niversite ve iÅ takibi.", icon: "trophy", group: "YÃ¶netim & Finans" };
const DONEM_GECISLERI_CARD: ModuleCard = { href: "/donem-gecisleri", title: "DÃ¶nem GeÃ§iÅleri", description: "Akademik yÄ±l yÃ¶netimi ve sÄ±nÄ±f geÃ§iÅi (2050'ye kadar).", icon: "clock", group: "YÃ¶netim & Finans" };

export const MODULES_BY_ROLE: Record<UserRole, ModuleCard[]> = {
  BRANCH_ADMIN: [BUGUN_CARD, TAKVIM_CARD, GUNLUK_OPS_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, DONEM_GECISLERI_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, ROLLER_CARD, OGRETMEN_PERF_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, KURSLAR_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, ETUT_CARD, SERVIS_CARD, YEMEKHANE_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ZIYARETCI_CARD, MEZUNLAR_CARD, AKTIVITE_CARD, RAPORLAR_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  ACCOUNTING: [GUNLUK_OPS_CARD, TAKVIM_CARD, ODEME_YONTEMLERI_CARD, MUHASEBE_CARD, RESMI_MUHASEBE_CARD, PERSONEL_CARD, GOREVLER_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  // 3. denetim bulgusu â GUIDANCE_COORDINATOR zaten hem mesaj gelen kutusuna
  // (app/api/messages/inbox rol kÄ±sÄ±tsÄ±z) hem Karne'ye (report-card route
  // STAFF_ROLES'ta zaten vardÄ±) eriÅebiliyordu, yalnÄ±zca nav kartÄ± eksikti.
  GUIDANCE_COORDINATOR: [TAKVIM_CARD, CRM_CARD, ON_KAYIT_CARD, NORMAL_KAYIT_CARD, OGRENCILER_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, REHBERLIK_OLAY_CARD, SAGLIK_CARD, ANKETLER_CARD, GOREVLER_CARD, ETUT_CARD, ILETISIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  TEACHER: [TAKVIM_CARD, SINIFLARIM_CARD, OLCME_CARD, KARNE_CARD, ODEVLER_CARD, DEVAMSIZLIK_CARD, DERS_PROGRAMI_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, GOREVLER_CARD, ETUT_ONAYI_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, LEADERBOARD_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  STUDENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  PARENT: [TAKVIM_CARD, KARNE_CARD, SINAV_SONUCLARIM_CARD, ODEVLERIM_CARD, DEVAMSIZLIGIM_CARD, DERS_PROGRAMI_CARD, ROADMAP_CARD, SINAV_BELGESI_CARD, DAVRANIS_NOTLARIM_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ETKINLIKLER_CARD, YEMEKHANE_CARD, SERVIS_CARD, QUIZ_CARD, ETUT_RANDEVU_CARD, ILETISIM_CARD, MESAJLASMA_CARD, MENTOR_CARD, BASARI_CARD, ODEME_ISLEMLERIM_CARD, GUVENLIK_CARD, PROFILIM_CARD],
  SUPERADMIN: [SUBE_HARITASI_CARD, ANALYTICS_CARD, KURUMLAR_CARD, ROLLER_HQ_CARD, OLCME_CARD, ILETISIM_HQ_CARD, GUVENLIK_CARD, PROFILIM_CARD],
};

/**
 * Genel Merkez (SUPERADMIN) demo'daki HQ portalÄ± gibi TÃM modÃ¼llere her
 * zaman eriÅebilir â actingTenantId'ye baÄlÄ± deÄil. Tek-Åube ekranlarÄ±nda
 * (SÄ±nÄ±f Atama, Personel, Muhasebe, EtÃ¼t, vb.) HqBranchSelector ekranÄ±n
 * Ã¼stÃ¼nde gÃ¶mÃ¼lÃ¼ Åube seÃ§ici sunar (bkz. components/hq/HqBranchSelector),
 * demo'daki hqBranchSelectorHtml deseninin karÅÄ±lÄ±ÄÄ± â Kurumlar > "Bu Åube
 * Olarak YÃ¶net"e gitmeye gerek kalmaz. ROLLER/Ä°LETÄ°ÅÄ°M/ÃLÃME kartlarÄ± HQ
 * varyantlarÄ±nÄ± kullanÄ±r (bkz. RolesDashboard/MessagesDashboard/
 * OlcmeDegerlendirmeView'daki bare-SUPERADMIN Ã§apraz-Åube Ã¶zel davranÄ±ÅÄ±).
 *
 * AyrÄ±ca TEACHER/STUDENT/PARENT'e Ã¶zgÃ¼ "kendi verim" self-servis ekranlarÄ±
 * (SÄ±nÄ±flarÄ±m, DevamsÄ±zlÄ±ÄÄ±m, vb.) de dahildir â bunlar normalde tek bir
 * Ã¶Äretmen/Ã¶Ärenci/veli kimliÄine baÄlÄ±dÄ±r, bu yÃ¼zden HQ iÃ§in ayrÄ±ca bir
 * HqTeacherPicker/useHqStudentRoster ile "hangi Ã¶Äretmen/Ã¶Ärenci gibi
 * gÃ¶rÃ¼ntÃ¼lensin" seÃ§imi eklendi (bkz. components/hq/HqTeacherPicker.tsx,
 * lib/hq-student-roster.ts). BASARI_CARD kasÄ±tlÄ± olarak DAHÄ°L DEÄÄ°LDÄ°R:
 * href'i LEADERBOARD_CARD ile aynÄ±dÄ±r (/basari) ve GamificationDashboard
 * SUPERADMIN'i zaten her zaman (branÅ bazlÄ±) Lider Tablosu gÃ¶rÃ¼nÃ¼mÃ¼ne
 * yÃ¶nlendiriyor â "kendi rozetlerim" gÃ¶rÃ¼nÃ¼mÃ¼ HQ iÃ§in anlamsÄ±z/yinelenen olurdu.
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

// Grup gÃ¶rÃ¼ntÃ¼leme sÄ±rasÄ± â demo'daki sidebar grup sÄ±ralamasÄ±yla aynÄ± mantÄ±k.
export const GROUP_ORDER = ["Genel BakÄ±Å", "KayÄ±t Ä°Ålemleri", "Akademik", "ÃÄrenci YaÅamÄ±", "YÃ¶netim & Finans", "Ben", "DiÄer"];

export function groupModules(modules: ModuleCard[]): { label: string; items: ModuleCard[] }[] {
  const byLabel = new Map<string, ModuleCard[]>();
  for (const m of modules) {
    if (!byLabel.has(m.group)) byLabel.set(m.group, []);
    byLabel.get(m.group)!.push(m);
  }
  return GROUP_ORDER.filter((g) => byLabel.has(g)).map((label) => ({ label, items: byLabel.get(label)! }));
}
