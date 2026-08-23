import Link from "next/link";

export const metadata = {
  title: "KVKK Aydınlatma Metni — Seviye 360",
};

/**
 * KVKK Aydınlatma Metni (6698 sayılı Kanun md. 10). Bu bir hukuki ŞABLONDUR —
 * yayına almadan önce kurumun (veri sorumlusu) gerçek ticari unvanı, adresi,
 * KEP/e-posta ve VERBİS kaydı bir hukuk danışmanınca doldurulup onaylanmalıdır.
 * Doldurulması gereken alanlar [KÖŞELİ PARANTEZ] ile işaretlenmiştir.
 */
export default function KvkkPage() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px", lineHeight: 1.7 }}>
      <Link href="/login" style={{ fontSize: 14, color: "var(--brand, #208AEF)" }}>
        ← Girişe dön
      </Link>

      <h1 style={{ marginTop: 20 }}>Kişisel Verilerin Korunması Aydınlatma Metni</h1>
      <p style={{ color: "#6b7280", fontSize: 14 }}>Son güncelleme: [GÜNCELLEME TARİHİ]</p>

      <h2>1. Veri Sorumlusu</h2>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) uyarınca, kişisel
        verileriniz veri sorumlusu sıfatıyla [KURUMUN TİCARİ UNVANI] (&quot;Kurum&quot;)
        tarafından aşağıda açıklanan kapsamda işlenmektedir. Adres: [KURUM ADRESİ].
        İletişim: [KEP / E-POSTA / TELEFON]. VERBİS kaydı: [VARSA VERBİS NO].
      </p>

      <h2>2. İşlenen Kişisel Veriler</h2>
      <p>Seviye 360 platformu üzerinden aşağıdaki veri kategorileri işlenebilir:</p>
      <ul>
        <li><strong>Kimlik:</strong> ad-soyad, T.C. Kimlik Numarası, doğum tarihi.</li>
        <li><strong>İletişim:</strong> telefon, e-posta, adres.</li>
        <li><strong>Öğrenci/veli:</strong> okul/sınıf bilgisi, akademik sonuçlar, devamsızlık, disiplin ve rehberlik kayıtları.</li>
        <li><strong>Finans:</strong> ödeme planı, taksit ve tahsilat kayıtları, fatura bilgileri.</li>
        <li><strong>İşlem güvenliği:</strong> oturum kayıtları, IP adresi, giriş/işlem logları.</li>
      </ul>

      <h2>3. İşleme Amaçları</h2>
      <ul>
        <li>Eğitim-öğretim ve kayıt süreçlerinin yürütülmesi,</li>
        <li>Akademik takip, ölçme-değerlendirme ve raporlama,</li>
        <li>Mali/muhasebe süreçleri ve tahsilat işlemleri,</li>
        <li>Veli-kurum iletişimi ve bilgilendirme (SMS/e-posta dâhil),</li>
        <li>Bilgi güvenliğinin ve hesap güvenliğinin sağlanması,</li>
        <li>Yasal yükümlülüklerin (MEB, GİB vb.) yerine getirilmesi.</li>
      </ul>

      <h2>4. Hukuki Sebepler</h2>
      <p>
        Kişisel verileriniz KVKK md. 5 ve 6 kapsamında; bir sözleşmenin kurulması/ifası,
        hukuki yükümlülüğün yerine getirilmesi, hakkın tesisi/korunması ve meşru menfaat
        hukuki sebeplerine dayanılarak; gerekli hâllerde açık rızanıza istinaden işlenir.
      </p>

      <h2>5. Aktarım</h2>
      <p>
        Verileriniz, yalnızca yukarıdaki amaçlarla sınırlı olarak ve mevzuatın izin verdiği
        ölçüde; yetkili kamu kurumlarına, çalıştığımız barındırma/altyapı hizmet
        sağlayıcılarına ve SMS/e-posta gönderim hizmeti sağlayıcılarına aktarılabilir.
        Yurt dışına aktarım yapılıyorsa KVKK md. 9 şartlarına uyulur.
      </p>

      <h2>6. Saklama Süresi</h2>
      <p>
        Kişisel verileriniz, ilgili mevzuatta öngörülen veya işleme amacının gerektirdiği
        süre boyunca saklanır; sürenin sonunda silinir, yok edilir veya anonim hâle getirilir.
      </p>

      <h2>7. İlgili Kişinin Hakları (KVKK md. 11)</h2>
      <p>
        Kanun&apos;un 11. maddesi uyarınca; verilerinizin işlenip işlenmediğini öğrenme,
        bilgi talep etme, işleme amacını öğrenme, düzeltilmesini/silinmesini isteme,
        aktarıldığı üçüncü kişileri öğrenme ve zararın giderilmesini talep etme haklarına
        sahipsiniz. Başvurularınızı [BAŞVURU KANALI — KEP/e-posta/adres] üzerinden
        iletebilirsiniz.
      </p>

      <p style={{ marginTop: 32, fontSize: 13, color: "#6b7280" }}>
        Not: Bu metin bir taslaktır; yürürlüğe girmeden önce kurumun hukuk danışmanınca
        [KÖŞELİ PARANTEZ] içindeki alanlar doldurulup gözden geçirilmelidir.
      </p>
    </main>
  );
}
