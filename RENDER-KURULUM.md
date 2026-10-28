# Render üzerinden canlıya alma

Uygulama Render'da **bir Docker Web Service ve bir PostgreSQL** ile çalışır. Frontend Spring tarafından sunulduğu için ayrıca Static Site açılmaz. VPS veya kendi alan adın şart değil; Render'ın verdiği HTTPS `onrender.com` adresiyle başlayabilirsin.

## Blueprint ile kurulum

1. Kaynak ZIP'indeki `satir/` klasörünün **içeriğini** GitHub deposunun köküne yükle. `pom.xml`, `Dockerfile`, `render.yaml` aynı kökte olmalı. `.env`, `data/`, `target/` veya çalışma klasöründeki veritabanını Git'e ekleme.
2. Render'da **New → Blueprint** seçip depoyu bağla. `render.yaml` dosyası uygulama ve veritabanını aynı bölgede tanımlar.
3. İlk kurulumun istediği `ADMIN_EMAIL` ve `ADMIN_PASSWORD` değerlerini yalnız Render'ın ortam değişkenleri ekranına gir. Kullanılmamış bir e-posta ve en az 10 karakter, UTF-8 olarak en fazla 72 bayt şifre seç. Burada veya GitHub kaynak dosyalarında gerçek şifre paylaşma.
4. Şablon **ücretli** web servisi ve PostgreSQL seçer. Kaynakları oluşturmadan önce Render'ın gösterdiği toplam maliyeti kontrol et. Bu dosyayı hazırlamak herhangi bir kaynak veya abonelik oluşturmaz.
5. Deploy tamamlanınca Render'ın verdiği HTTPS adresini aç. **Giriş yap** üzerinden admin hesabınla gir. **Yazarlar** menüsünden yeni yazar oluşturabilir veya mevcut okuyucuyu yazar yapabilirsin.

Render'ın `PORT` değeri otomatik kullanılır. Veritabanı bağlantı bilgileri Blueprint tarafından eklenir; `render` profili Render'ın PostgreSQL URL'sini JDBC biçimine çevirir. Bağlantı TLS kullanır. Admin parolası BCrypt özetiyle veritabanına yazılır. Yeni yazar oluşturulması e-posta göndermez; giriş bilgilerini yazara sen iletirsin.

## Admin hesabının yaşam döngüsü

İlk admin, henüz hiçbir admin yokken ve iki `ADMIN_*` değişkeni tanımlıyken oluşturulur. Sonraki deploy'larda mevcut adminin şifresi veya hesabı değiştirilmez. Ortam değişkenini değiştirmek şifre sıfırlama işlemi değildir. İlk oluşturma sonrası iki değişkeni Render'dan kaldırabilirsin; veritabanındaki admin korunur. Otomatik şifre sıfırlama bu sürümde yoktur.

## Ücretsiz deneme

Ücretsiz deneme için `render.yaml` içindeki **her iki** `plan` değerini `free` yapabilirsin. Ücretsiz web servisi 15 dakika hareketsizlikte uyur, ilk açılış gecikebilir. Ücretsiz PostgreSQL 30 gün sonra sona erer ve yedekleme sağlamaz. Kalıcı yayın için süre sınırı olmayan uygun veritabanı planını seç. Yerel H2 dosyasını Render'da kalıcı veri deposu olarak kullanma: servisin dosya sistemi yeniden dağıtımda silinir.

## Güncelleme ve kontrol

GitHub'a güncelleme gönderildiğinde Render servisi yeniden derler. Docker build aşaması testleri çalıştırır. İlk erişimde ana sayfanın oturumsuz açıldığını, normal kayıtla içerik yayımlanamadığını, yazarın Yazarlar bölümüne erişemediğini ve adminin yazar ekleyebildiğini kontrol et. Yeniden başlatmada uygulama oturumları biter; yazılar ve hesaplar PostgreSQL'de korunur.

Bu çalışma sırasında Render hesabına bağlanılmadı; ücretli servis oluşturulmadı ve dış dağıtım yapılmadı. Blueprint yerel şema kontrolünden geçirildi; Render üzerinde çalıştırılarak doğrulanmadı.

Resmi kaynaklar (28 Ekim 2026):

- [Blueprint yapılandırması](https://render.com/docs/blueprint-spec)
- [PostgreSQL bağlantısı](https://render.com/docs/postgresql-creating-connecting)
- [Ücretsiz plan sınırları](https://render.com/docs/free)
- [Plan kimlikleri](https://render.com/docs/compute-plans)
