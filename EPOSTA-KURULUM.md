# E-posta doğrulama kurulumu

Bu değişiklik, uygulamanın kayıt ve doğrulama akışını içerir. Gerçek e-posta gönderimi için Brevo hesabı, doğrulanmış gönderici ve API anahtarı gerekir. Bunlar tamamlanmadan bu sürümü mevcut canlı servise dağıtma: yeni kayıtlar 503 döner ve mevcut okuyucu/yazar hesaplarının doğrulama adımı tamamlanamaz.

## Ücretsiz gönderici

1. https://onboarding.brevo.com/account/register üzerinden Free hesabını oluştur. Yeni parola ve sözleşme adımlarını hesap sahibi tamamlar. Giriş ekranındaki hata tek başına hesabın oluşturulduğunu göstermez.
2. Brevo'da gönderici ekle. Kullanacağın adresin posta kutusuna gelen doğrulamayı tamamla. Brevo işlem e-postası hizmetinin etkinleştirilmesini isteyebilir; etkinlik ve gönderici durumu doğrulanmalıdır.
3. Brevo API anahtarını oluştur. API anahtarı SMTP parolasıyla aynı değildir. Anahtarı sohbet, GitHub, ekran görüntüsü veya kaynak dosyasına yazma.
4. Render → `satir-yorukmustafa` → Environment içinde şu değerleri tanımla:

| Değişken         | İçerik                                    |
| ---------------- | ----------------------------------------- |
| `BREVO_API_KEY`  | Gizli Brevo API anahtarı                  |
| `MAIL_FROM`      | Brevo'da doğrulanmış gönderici adresi     |
| `APP_PUBLIC_URL` | `https://satir-yorukmustafa.onrender.com` |

Render Free, SMTP portlarını engellediğinden uygulama HTTPS üzerinden Brevo API'sini kullanır. Gmail gibi ücretsiz bir göndericiyle Brevo uyumlu bir gönderici adresine dönüşüm uygulayabilir. Özel alan adı zorunlu bir uygulama ayarı değildir; hizmetin gönderici ve hesap onayı gereklidir.

5. Hazır sürümü dağıt. Yeni bir okuyucu kaydını **kendi e-posta adresinle** dene. Gelen e-postadaki bağlantıya bas, sayfadaki onay düğmesini kullan ve ardından giriş yap. Gelen kutusu/spam kontrolü gerçek teslim testinin parçasıdır.
6. Aynı bağlantının ikinci kez kabul edilmediğini ve yeni bağlantı isteğinin çalıştığını kontrol et. Gerçek teslim tamamlanmadan “canlı e-posta doğrulaması çalışıyor” sonucuna varma.

## Davranış

- Yeni okuyucu ve yönetici tarafından eklenen yazar, e-postasını doğrulamadan giriş yapamaz.
- İlk yönetici, hosting ayarlarından oluşturulan güvenilir hesap olarak erişilebilir kalır. V3, mevcut yönetici dışındaki hesaplardan da doğrulama ister; yazıları silmez.
- Bağlantı 30 dakika geçerlidir; tek kullanımlıktır. Veritabanında açık token değil SHA-256 özeti tutulur.
- Yeni bağlantı için en az 60 saniye beklenir; hesap başına saatte 5 gönderim sınırı veritabanında saklanır. Uygulama yeniden başlasa da bu sayaç korunur.
- Giriş, kayıt ve doğrulama isteklerine ayrıca bellek içinde sınırlama uygulanır. Bu ek sayaç uygulama yeniden başlatıldığında sıfırlanır; çoklu sunucuya geçilirse ortak bir sayaç deposu gerekir.
- Mail servisi hazır değilse veya gönderimi reddederse yeni hesap oluşturma işlemi geri alınır.
- E-postayı açmak tek başına hesabı doğrulamaz; onay düğmesi ve CSRF korumalı POST gerekir.
- Şifre kurtarma bu çalışmaya dahil değildir.

## Dağıtım / geri dönüş

V1 ve V2 değiştirilmemiştir; V3 yalnızca şema ekler. Veri geçişi PostgreSQL 18.6 üzerinde doğrulandı. V3 sonrasında eski backend'e doğrudan geri dönüş desteklenmez: eski kodun `members` tablosuna sütun adı vermeden yaptığı eklemeler yeni şemayla uyumsuzdur. Geri dönüşte bu sürümün backend'ini koru veya önceden hazırlanmış bir geri yükleme planı kullan. Arayüzü ayrı geri almak backend şemasını etkilemez.

Resmi kaynaklar:

- https://render.com/docs/free
- https://developers.brevo.com/docs/send-a-transactional-email
- https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email
- https://help.brevo.com/hc/en-us/articles/208580669-FAQs-What-are-the-limits-of-the-Free-plan
