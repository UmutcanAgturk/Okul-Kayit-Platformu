"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authKeys, fetchMe, logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

interface ModuleCard {
  href: string;
  title: string;
  description: string;
}

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: "Genel Merkez Yöneticisi",
  BRANCH_ADMIN: "Şube Yöneticisi",
  GUIDANCE_COORDINATOR: "Rehber Öğretmen",
  ACCOUNTING: "Muhasebe Görevlisi",
  TEACHER: "Öğretmen",
  STUDENT: "Öğrenci",
  PARENT: "Veli",
};

const MUHASEBE_CARD: ModuleCard = { href: "/muhasebe", title: "Muhasebe", description: "Kayıt defteri, tahsilat takibi, bordro, belgeler." };
const PERSONEL_CARD: ModuleCard = { href: "/personel", title: "Personel", description: "Öğretmen dışı personel (Şube Müdürü, Ön Büro, Muhasebe, Rehber Öğretmen)." };
const DEVAMSIZLIK_CARD: ModuleCard = { href: "/devamsizlik", title: "Devamsızlık", description: "Sınıf bazlı yoklama alma ve devamsızlık geçmişi." };
const KARNE_CARD: ModuleCard = { href: "/karne", title: "Karne", description: "Sınav geçmişi, ders bazlı başarı ve devamsızlık özeti." };
const DISIPLIN_CARD: ModuleCard = { href: "/disiplin", title: "Disiplin", description: "Olumlu/olumsuz davranış kaydı ekleme ve geçmişi." };
const VELI_GORUSME_CARD: ModuleCard = { href: "/veli-gorusme", title: "Veli Görüşmeleri", description: "Veli-öğretmen görüşme randevusu talep etme ve onaylama." };
const KULUPLER_CARD: ModuleCard = { href: "/kulupler", title: "Kulüpler", description: "Kulüp oluşturma, danışman atama ve üyelik yönetimi." };
const AKTIVITE_CARD: ModuleCard = { href: "/aktivite", title: "Aktivite Akışı", description: "Kayıt, ödeme, disiplin ve atama gibi kritik işlemlerin denetim izi." };
const BUGUN_CARD: ModuleCard = { href: "/bugun", title: "Bugün", description: "Devamsızlık, ödeme, veli görüşmesi ve aktivite akışının günlük özeti." };
const SERVIS_CARD: ModuleCard = { href: "/servis", title: "Servis", description: "Servis güzergahları, şoför bilgisi ve öğrenci ataması." };
const QUIZ_CARD: ModuleCard = { href: "/quiz", title: "Pratik Quiz", description: "Ders bazlı hızlı pratik denemeleri ve geçmiş sonuçlar." };
const RAPORLAR_CARD: ModuleCard = { href: "/raporlar", title: "Raporlar", description: "Öğrenci, personel, devamsızlık, sınav ve mali özet raporları." };
const KURUMLAR_CARD: ModuleCard = { href: "/kurumlar", title: "Kurum Yönetimi", description: "Tüm şubelerin öğrenci/personel/sınıf sayıları ve konsolide mali özet." };
const ILETISIM_CARD: ModuleCard = { href: "/iletisim", title: "İletişim", description: "Öğrenci/veli/öğretmenlere mesaj gönderme ve gelen kutusu." };
const MENTOR_CARD: ModuleCard = { href: "/mentor", title: "Seviye Mentör", description: "Otomatik atanan mentör öğretmenle online randevu talebi." };
const BASARI_CARD: ModuleCard = { href: "/basari", title: "Başarı Rozetlerim", description: "Sınav/devamsızlık/etüt/kulüp/quiz verisinden hesaplanan XP, seviye ve rozetler." };
const LEADERBOARD_CARD: ModuleCard = { href: "/basari", title: "Lider Tablosu", description: "Öğrencilerin gerçek katılım/başarı verisinden hesaplanan XP sıralaması." };
const ON_KAYIT_CARD: ModuleCard = { href: "/on-kayit", title: "Öğrenci Ön Kayıt", description: "Aday öğrenci ön kaydı oluşturma, düzenleme ve sözleşme/ödeme planıyla tam kayda dönüştürme." };
const ROADMAP_CARD: ModuleCard = { href: "/yol-haritasi", title: "Akademik Yol Haritam", description: "Net ortalama, hedef ve sınav/kazanım verisinden hesaplanan kişiye özel AI tavsiyesi." };
const GUNLUK_OPS_CARD: ModuleCard = { href: "/gunluk-operasyon", title: "Günlük Operasyon", description: "Geciken/yaklaşan ödemeler ve bugünkü etüt doluluğu — doğrudan aksiyon alınabilen operasyon konsolu." };
const CRM_CARD: ModuleCard = { href: "/crm", title: "CRM", description: "Ön Kayıt öncesi aday öğrencileri statü bazında (Arandı → Kayıt Oldu) takip edin." };

const MODULES_BY_ROLE: Record<string, ModuleCard[]> = {
  BRANCH_ADMIN: [BUGUN_CARD, GUNLUK_OPS_CARD, CRM_CARD, ON_KAYIT_CARD, MUHASEBE_CARD, PERSONEL_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, SERVIS_CARD, AKTIVITE_CARD, RAPORLAR_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD],
  ACCOUNTING: [GUNLUK_OPS_CARD, MUHASEBE_CARD, PERSONEL_CARD],
  GUIDANCE_COORDINATOR: [CRM_CARD, ON_KAYIT_CARD, DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD],
  TEACHER: [DEVAMSIZLIK_CARD, DISIPLIN_CARD, VELI_GORUSME_CARD, KULUPLER_CARD, ILETISIM_CARD, MENTOR_CARD, LEADERBOARD_CARD],
  STUDENT: [KARNE_CARD, ROADMAP_CARD, KULUPLER_CARD, SERVIS_CARD, QUIZ_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD],
  PARENT: [KARNE_CARD, ROADMAP_CARD, VELI_GORUSME_CARD, SERVIS_CARD, QUIZ_CARD, ILETISIM_CARD, MENTOR_CARD, BASARI_CARD],
  SUPERADMIN: [KURUMLAR_CARD],
};

/**
 * Bu depodaki tüm gerçek (Postgres'e bağlı) modüllerin tek bir yerden
 * erişilebildiği giriş noktası. Öncesinde /login başarılı girişten sonra
 * doğrudan sabit bir modüle (/muhasebe) yönlendiriyordu ve Personel'e yalnızca
 * Muhasebe ekranındaki küçük bir bağlantıdan ulaşılabiliyordu — bu ekran o
 * boşluğu kapatır. Rolün henüz gerçek bir modülü yoksa (TEACHER/STUDENT/
 * PARENT/SUPERADMIN/GUIDANCE_COORDINATOR) bunu dürüstçe belirtir; bu roller
 * için demo/seviye360-app.html hâlâ tek kaynaktır (bkz. kök README.md).
 */
export function DashboardHub() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: me, isLoading, isError, error } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    retry: false,
  });

  useEffect(() => {
    if (isError && error instanceof ApiError && error.status === 401) {
      router.replace("/login");
    }
  }, [isError, error, router]);

  async function handleLogout() {
    await logout();
    queryClient.clear();
    router.replace("/login");
  }

  if (isLoading) {
    return <div className="animate-pulse text-sm text-slate-500 dark:text-slate-400">Yükleniyor…</div>;
  }

  if (!me || (isError && error instanceof ApiError && error.status === 401)) {
    return null; // yönlendirme useEffect'te yapılıyor
  }

  const modules = MODULES_BY_ROLE[me.role] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Seviye 360</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {me.firstName} {me.lastName} · {ROLE_LABEL[me.role] ?? me.role}
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Çıkış Yap
        </button>
      </div>

      {modules.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {modules.map((m) => (
            <a
              key={m.href}
              href={m.href}
              className="rounded-xl border border-slate-200 p-5 transition hover:border-[#0071ce] hover:shadow-sm dark:border-slate-800 dark:hover:border-[#0071ce]"
            >
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{m.title}</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{m.description}</p>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <p className="font-medium">Bu rol için henüz gerçek (veritabanı bağlantılı) bir modül yok.</p>
          <p className="mt-1 text-xs">
            Şu anda yalnızca Şube Yöneticisi/Muhasebe rollerinin gerçek bir arayüzü var (Muhasebe, Personel). Diğer
            tüm modüller, bu depodaki <code>demo/seviye360/seviye360-app.html</code> dosyasında (localStorage
            tabanlı, tarayıcıya özel) hâlâ mevcuttur — gerçek backend inşası devam ediyor.
          </p>
        </div>
      )}
    </div>
  );
}
