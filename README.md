# Satır

Türkçe, Medium esintili blog ve film/dizi değerlendirme uygulaması. Spring Boot 3.5.16, Java 21, Spring Security, JDBC, Flyway; derleme gerektirmeyen responsive HTML/CSS/JavaScript arayüz. Frontend ve API aynı adresten sunulur.

## Özellikler

- Adminin oluşturduğu yazar hesapları ve herkese açık okuyucu kaydı, oturumla giriş/çıkış; BCrypt parolalar, CSRF koruması ve HttpOnly oturum çerezi.
- Yazar: taslak kaydet, yayımla, düzenle, yayından taslağa al ve sil. Sadece kendi yazılarına erişim.
- Blog/film/dizi/tarih/teknoloji/spor ayrımı, eser adı, 1–10 puan ve spoiler uyarısı.
- Başlık/özet araması, kategori filtreleri, 20 öğelik sayfalama.
- Okuyucu ve yazar için yorumlar, kalıcı okuma listesi.
- Yazı içeriği düz metindir; kullanıcı HTML'i çalıştırılmaz. Görsel yükleme, zengin metin, e-posta doğrulama ve şifre sıfırlama bu sürümde yoktur.
- Herkese açık kayıt her zaman READER oluşturur; istekle gönderilen role alanı yetki vermez. Yazar hesabını yalnız ADMIN oluşturur veya mevcut okuyucuyu yazar yapar. Yazarlar hesap yönetimine erişemez.

## Yerelde çalıştırma

Java 21+ ve Maven 3.6.3+:

```sh
mvn verify
mvn spring-boot:run
```

http://localhost:8080 adresini aç. İlk okuyucu hesabını arayüzden oluştur. İlk admin için uygulamayı başlatmadan önce ADMIN_EMAIL ve ADMIN_PASSWORD ortam değişkenlerini tanımla. Admin hesabı varsa başlangıçta değiştirilmez. Varsayılan kullanıcı veya parola yoktur. Yerel veritabanı `data/` içinde H2 dosyasıdır; yeniden başlatınca kayıtlar korunur. `target/satir-1.0.0.jar` dosyası `java -jar target/satir-1.0.0.jar` ile de çalışır.

## Canlıya alma — VPS + Docker Compose

Linux sunucuda Docker ve Compose kurulu olmalı. Alan adının A/AAAA kaydını sunucuya yönlendir; 80 ve 443 portlarını aç. Bu klasörü sunucuya kopyala, ardından:

```sh
cp .env.example .env
# .env içindeki DOMAIN ve DB_PASSWORD değerlerini gerçek değerlerle değiştir.
docker compose up -d --build
```

Caddy otomatik HTTPS sertifikası alır. Uygulama/veritabanı portları internete açılmaz; trafik Caddy üzerinden geçer. `COOKIE_SECURE=true` HTTPS için gereklidir. `.env` dosyasını paylaşma. `docker compose logs -f app` ile logları izle.

Yeni sürüm için kaynakları güncelledikten sonra `docker compose up -d --build`. Flyway şemayı sürümler; mevcut migration dosyasını değiştirme, yeni dosya ekle. Kalıcı verileri silmemek için `docker compose down -v` kullanma.

### Yedekleme ve geri yükleme

```sh
docker compose exec -T db pg_dump -U satir satir > satir-backup.sql
# Geri yüklemeden önce uygulamayı durdur; boş bir satir veritabanına yükle:
docker compose stop app
docker compose exec -T db psql -U satir satir < satir-backup.sql
docker compose start app
```

Yedekleri ayrı, güvenli bir konuma kopyala. Periyodik geri yükleme denemesi yap.

### Harici PostgreSQL / PaaS

Dockerfile ile Java uygulaması çalıştırabilen bir sağlayıcıya dağıtılabilir. Ortam değişkenleri:

| Değişken          | Değer                                            |
| ----------------- | ------------------------------------------------ |
| DATABASE_URL      | `jdbc:postgresql://HOST:5432/DB?sslmode=require` |
| DATABASE_USER     | Veritabanı kullanıcısı                           |
| DATABASE_PASSWORD | Veritabanı parolası                              |
| COOKIE_SECURE     | `true`                                           |
| PORT              | Varsayılan `8080`                                |

Sağlayıcının verdiği `postgres://` URL doğrudan JDBC URL değildir; yukarıdaki biçime çevir. TLS'i sağlayıcı/proxy sonlandırmalı. Oturumlar bellekte tutulur; yeniden başlatınca kullanıcılar tekrar giriş yapar. Bu sürüm tek uygulama örneği için hazırlanmıştır; çoklu örnekte ortak oturum deposu gerekir.

## API

`GET /api/csrf` bir token ve header adı döndürür. Tüm POST/PUT/DELETE isteklerinde bu header ve oturum çerezi gönderilir. `POST /api/login`, `username` ve `password` form alanlarını alır. Başarılı giriş/çıkış 204 döndürür; tokenı sonrasında yeniden al.

| Yol                                | İşlev                                                            |
| ---------------------------------- | ---------------------------------------------------------------- |
| POST /api/register                 | name, email, password, her zaman READER (role alanı kullanılmaz) |
| GET /api/me                        | Oturumdaki kullanıcı veya boş nesne                              |
| POST /api/logout                   | Çıkış                                                            |
| GET /api/posts?q=&category=&page=0 | Yayımlanan yazılar; kategori BLOG/FILM/SERIES/HISTORY/TECH/SPORT |
| GET /api/posts/{id}                | Yazı; taslağı yalnız sahibi görür                                |
| POST /api/posts                    | Yazar için oluşturma                                             |
| PUT, DELETE /api/posts/{id}        | Sahibinin düzenlemesi/silmesi                                    |
| GET /api/mine                      | Kullanıcının taslak ve yayınları                                 |
| GET, POST /api/posts/{id}/comments | Yorum listele/ekle                                               |
| GET /api/bookmarks                 | Okuma listesi                                                    |
| PUT, DELETE /api/bookmarks/{id}    | Kaydet/kaldır                                                    |

Yazı gövdesi: title, summary, body, category, workTitle, rating (null veya 1–10), spoiler, published. Film/dizide eser adı ve puan zorunludur.

## Doğrulama ve sınırlar

`mvn verify`: gerçek Spring context, H2 ve MockMvc ile kayıt, giriş/çıkış, CSRF, sahiplik, taslak gizliliği, okuyucu kısıtlaması, puan doğrulaması, yorum, kaydetme ve silme testleri.

PostgreSQL/Docker dağıtımı için dosyalar hazırlanmıştır; bu ortamda Docker olmadığı için Compose dağıtımı çalıştırılarak doğrulanmamıştır. Canlı sunucu/alan adı bağlanmamıştır. Kamuya açık büyük bir yayından önce e-posta doğrulama, hesap kurtarma, moderasyon ve giriş denemesi sınırlaması eklenmelidir.

Spring sürüm gereksinimleri: https://docs.spring.io/spring-boot/3.5/system-requirements.html
CSRF dokümanı: https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html

## Yeni yetkiler ve kategori sayfaları

- `/#category/BLOG`, `/#category/FILM`, `/#category/SERIES`, `/#category/HISTORY`, `/#category/TECH`, `/#category/SPORT` herkesin okuyabildiği kategori sayfalarıdır.
- `/#writers` yalnız adminin Yazarlar bölümüdür. API de rol denetimi yapar.
- `GET /api/admin/writers`: yazar listesi; parola özeti döndürmez.
- `POST /api/admin/writers`: name, email, password ile yeni WRITER hesabı oluşturur.
- `POST /api/admin/writers/promote`: email ile mevcut READER hesabını WRITER yapar.
- Admin de kendi yazılarını yayımlayabilir. Yazarlar yalnız kendi içeriklerini düzenleyip silebilir.

V2 migration eski serbest kayıt WRITER hesaplarını READER yapar; hesaplar ve yazılar silinmez. Admin gerekli hesaplara Yazarlar bölümünden yeniden yetki verir. V1 dosyası değiştirilmemiştir.

## Render

Adım adım kurulum için [RENDER-KURULUM.md](RENDER-KURULUM.md). Hazır `render.yaml` ücretli web servisi ve PostgreSQL tanımlar; kaynak oluştururken Render'ın gösterdiği ücreti kontrol et. Henüz canlı dağıtım yapılmadı.
