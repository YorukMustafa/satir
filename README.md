# Satır

Blog, film/dizi değerlendirmesi, tarih, teknoloji ve spor yazıları için Türkçe yayın uygulaması. Spring Boot 4.0.9, Java 21, Spring Security, JDBC ve Flyway kullanır. HTML/CSS/JavaScript arayüzü aynı Spring uygulamasından sunulur; ayrı frontend sunucusu gerekmez. Koyu mod tercihi cihazda saklanır; defter/post-it hareketi reduced-motion ayarına uyar.

Mevcut canlı adres: https://satir-yorukmustafa.onrender.com . Bu çalışma dalındaki e-posta doğrulama ve güvenlik güncellemesinin dağıtımı için [EPOSTA-KURULUM.md](EPOSTA-KURULUM.md) adımları tamamlanmalıdır.

## Hesaplar ve yayın

- Herkese açık kayıt yalnız READER oluşturur. İstekte role göndermek yetki vermez.
- İlk ADMIN, ADMIN_EMAIL / ADMIN_PASSWORD ortam değişkenleriyle yalnız bir kez oluşturulur. Sonraki açılışlar mevcut parolayı değiştirmez.
- Yalnız ADMIN yazar ekleyebilir veya doğrulanmış okuyucuya yazar yetkisi verebilir.
- Yeni okuyucu/yazar e-postasını doğrulamadan giriş yapamaz. Başlangıç yöneticisi hosting kurulumundan güvenilir hesap olarak erişir.
- Yazarlar yalnız kendi yazılarını oluşturur, taslak kaydeder, yayımlar, düzenler ve siler.
- Okuyucular yazıları kaydeder ve yayımlanmış yazılara yorum yapar. Taslaklar yalnız sahibine açıktır.
- Yazı metinleri HTML olarak çalıştırılmaz. Görsel yükleme, zengin metin, hesap kurtarma ve moderasyon paneli bu sürümde bulunmaz.

## Yerelde çalıştırma

Java 21 ve Maven 3.6.3+:

```sh
mvn verify
mvn spring-boot:run
```

http://localhost:8080 adresini aç. H2 dosyası `data/` içinde tutulur. Varsayılan hesap/parola yoktur. Mail ayarı olmadan anonim okuma ve tanımlanmış yönetici girişi çalışır; yeni kayıt/gönderim 503 döndürür. Gerçek kayıt için BREVO_API_KEY, MAIL_FROM ve APP_PUBLIC_URL tanımlanmalıdır. Yerelde APP_PUBLIC_URL `http://localhost:8080` olabilir; canlıda kök HTTPS adresi kullan.

```sh
java -jar target/satir-1.0.0.jar
```

H2, Flyway ile doğrulanmış 2.3.232 sürümüne sabitlenmiştir. H2 2.4'e geçişte eski şema testinde kontrol kısıtı hatası gözlendi; üretim H2 kullanmaz.

## Ücretsiz yayın

Render Free üzerinde tek Docker web servisi, Neon Free üzerinde PostgreSQL kullanılır. [RENDER-KURULUM.md](RENDER-KURULUM.md) ve [EPOSTA-KURULUM.md](EPOSTA-KURULUM.md) adımlarını izle. Render'ın verdiği PORT kullanılır. Ortam değişkenleri:

| Değişken                          | Açıklama                               |
| --------------------------------- | -------------------------------------- |
| SPRING_PROFILES_ACTIVE            | Render'da `render`                     |
| RENDER_DATABASE_URL               | Neon PostgreSQL URI'si; dosyaya yazma  |
| DATABASE_USER / DATABASE_PASSWORD | Gizli veritabanı kimlik bilgileri      |
| ADMIN_EMAIL / ADMIN_PASSWORD      | İlk yönetici; mevcut hesabı sıfırlamaz |
| COOKIE_SECURE                     | HTTPS üzerinde `true`                  |
| APP_PUBLIC_URL                    | Güvenilir kök HTTPS site adresi        |
| MAIL_FROM                         | Brevo'da doğrulanmış gönderici         |
| BREVO_API_KEY                     | Gizli API anahtarı                     |

Render Free hareketsizlikte uyur; ilk açılışta Render'ın yüklenme ekranı görülebilir. Oturumlar bellektedir; dağıtımda kullanıcı tekrar giriş yapar. Yazılar, hesaplar, yorumlar ve okuma listeleri Neon'da kalır. Çoklu uygulama örneği için ortak oturum ve istek sınırı deposu gerekir.

VPS kurulumu için `compose.yml` ve Caddy yapılandırması bulunur. `.env.example` dosyasını `.env` olarak kopyalayıp tüm gerçek değerleri yalnız bu gizli dosyada ayarla. Compose dağıtımı bu ortamda Docker bulunmadığından çalıştırılarak doğrulanmamıştır. Kalıcı verileri silen `docker compose down -v` komutunu kullanma.

## API

`GET /api/csrf` token ve header adını döndürür. Değişiklik yapan tüm isteklerde CSRF header'ı ve oturum çerezi gerekir. Login, `username` / `password` form alanlarıyla yapılır.

| Yol                                | İşlev                                             |
| ---------------------------------- | ------------------------------------------------- |
| POST /api/register                 | name, email, password → doğrulama bekleyen READER |
| POST /api/email/verify             | E-postadaki tek kullanımlık tokenı onayla         |
| POST /api/email/resend             | email → varsa doğrulanmamış hesaba yeni bağlantı  |
| POST /api/login, /api/logout       | Giriş / çıkış; başarıda 204                       |
| GET /api/me                        | Oturumdaki kullanıcı veya boş nesne               |
| GET /api/posts?q=&category=&page=0 | Yayımlanan yazılar, 20'li sayfalama               |
| GET /api/posts/{id}                | Yazı; taslağı yalnız sahibi görür                 |
| POST /api/posts                    | Yetkili yazarın yeni yazısı                       |
| PUT, DELETE /api/posts/{id}        | Sahibinin düzenlemesi/silmesi                     |
| GET /api/mine                      | Kendi yayınları ve taslakları                     |
| GET, POST /api/posts/{id}/comments | Yorumlar                                          |
| GET /api/bookmarks                 | Okuma listesi                                     |
| PUT, DELETE /api/bookmarks/{id}    | Kaydet / kaldır                                   |
| GET, POST /api/admin/writers       | Adminin yazar listesi / yazar eklemesi            |
| POST /api/admin/writers/promote    | Doğrulanmış okuyucuyu yazar yap                   |

Kategori: BLOG, FILM, SERIES, HISTORY, TECH, SPORT. Film/dizide eser adı ve 1–10 puan zorunludur. JSON istekleri 512 KiB ile sınırlanır; arama 200 karakteri ve sayfa 10.000'i aşamaz.

## Testler

```sh
mvn verify
npm ci
npm test
```

Node yalnız test içindir. PostgreSQL 18 testleri, yalnız özel test veritabanı verildiğinde çalışır:

```sh
SATIR_TEST_POSTGRES_URL=jdbc:postgresql://127.0.0.1:15432/satir_audit mvn verify
```

Bu URL yalnız yerel ve boş/disposable bir test veritabanı olmalıdır. Test kullanıcı adı postgres, parola boş olarak tanımlıdır; üretim adresini kullanma. Ortam değişkeni yoksa yalnız iki PostgreSQL testi atlanır; diğer backend testleri H2 ile çalışır.

Güncel kapsam ve sınırlamalar [TEST-RESULTS.md](TEST-RESULTS.md) dosyasında. Tarama, bir güvenlik veya kullanılabilirlik garantisi değildir. Gerçek e-posta teslimi, gönderici kurulumu tamamlandıktan sonra ayrıca doğrulanmalıdır.
