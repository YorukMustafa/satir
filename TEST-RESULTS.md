# Satır — test ve tarama raporu

Tarih: 1 Kasım 2026. Kapsam: e-posta doğrulama, uygulama güvenliği, mevcut yayın akışları ve bağımlılıklar.

## Yayın durumu

Bu rapor yeni sürüm adayı içindir. Mevcut canlı site açılmaktadır. Yeni sürümün gerçek e-posta teslimi, Brevo hesabı/gönderici/API anahtarı kurulumu tamamlanmadığı için henüz doğrulanmadı; yeni sürüm canlıya alınmış sayılmaz. [EPOSTA-KURULUM.md](EPOSTA-KURULUM.md) kalan adımları açıklar.

## Otomatik kontroller

| Kontrol                                           | Sonuç                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| Java 21, Spring Boot 4.0.9, Maven verify          | **35 geçti, 0 hata, 0 atlama**                                            |
| Gerçek PostgreSQL 18.6 entegrasyonu               | Yukarıdaki 35 testin içinde 2 test geçti                                  |
| JavaScript / JSDOM                                | **27 geçti, 0 hata**                                                      |
| Paketlenmiş JAR içindeki Java bağımlılıkları, OSV | **59 paket tarandı; bildirilen açık yok; taranmayan paket yok**           |
| npm audit                                         | **0 bildirilen açık**; Node bağımlılıkları yalnız geliştirme/test içindir |
| JavaScript sözdizimi / git diff whitespace        | Temiz                                                                     |

PostgreSQL testleri `SATIR_TEST_POSTGRES_URL` ile yalnız yerel, ayrı bir veritabanında çalıştırıldı. Normal `mvn verify` bu değişken yoksa iki PostgreSQL testini atlar; diğer 33 testi H2 üzerinde çalıştırır. Gerçek e-posta sağlayıcısına test sırasında ileti gönderilmedi; transport testi yerel bir HTTP sunucusunda yapıldı.

## Test edilen davranışlar

- Kayıt her zaman READER oluşturur; istekle ADMIN/WRITER rolü seçilemez.
- Yazar yönetimi ADMIN'e özgüdür. Okuyucu yayımlayamaz; yazar başkasının taslağına erişemez, başkasının yazısını değiştiremez veya silemez.
- Taslak/yayın geçişi, yeni kategoriler, 1–10 puan, yorumlar, okuma listesi, yinelenen kaydetme ve yazı silinirken ilişkili kayıtlar kontrol edildi.
- CSRF olmadan değişiklik yapılamaz. Giriş/çıkış, kullanıcı verisinde parola bulunmaması ve güvenlik başlıkları denetlendi.
- Yeni hesap doğrulanmadan giriş yapamaz. Token yüksek entropilidir; veritabanında özeti saklanır. Süresi dolan, bozuk, yeniden kullanılan veya yeniden gönderimle geçersizleşen token reddedilir.
- E-posta bağlantısı sayfa açılır açılmaz tüketilmez; kullanıcı onayı gerekir. Başarıdan sonra token adres çubuğundan kaldırılır.
- Yeniden gönderimde 60 saniye bekleme ve hesap başına saatte 5 sınırı, bilinmeyen/doğrulanmış hesaplarda aynı genel yanıt, gönderim başarısızsa hesabın geri alınması test edildi.
- Aynı bağlantının eşzamanlı iki onayı yalnız bir kez sonuçlanır. Onay ile yeniden gönderim aynı anda çalıştığında aynı kilit sırası kullanılır; yarış testi geçti.
- Giriş denemeleri sınırlandırılır; 429 ve Retry-After döner. JSON istek boyutu bilinen veya akışlı olsa da 512 KiB ile sınırlanır.
- Geçersiz JSON, yanlış sayfa/kategori/arama, e-posta boşluk/büyük-küçük harf normalizasyonu ve BCrypt'ün UTF-8 bayt sınırı kontrol edildi.
- Başlık, metin, yorum ve arama içindeki HTML çalıştırılmaz. Önceki arama/istek yanıtları yeni sayfanın üstüne yazamaz.
- Koyu mod tercihi, gezinme, doğrulama/yeniden gönderim ekranları ve başarısız bağlantıda kurtarma yolu denetlendi.

## Gerçek veritabanı geçişi

Ayrı PostgreSQL 18.6 veritabanında V1 → V2 → V3 geçişi ayrıca çalıştırıldı. Mevcut yazı içeriği korundu, anahtarların NOT NULL kısıtı bozulmadı, e-posta doğrulama tablosu oluştu. Yönetici erişimi korundu; diğer mevcut hesaplar doğrulama bekler. Hiçbir canlı veritabanı bu taramada değiştirilmedi.

## Yerel tarayıcı / canlı gözlem

Yerel gerçek sunucuda yönetici girişi, yazı yayımlama, okuma listesi ve yorum akışları kullanıldı. Güncel altyapıda doğrulama ekranı ve yönetici girişi yeniden denendi. 390 piksel mobil doğrulama ekranında yatay taşma görülmedi. Önceki koyu mod çalışmasında 320 piksel de doğrulanmıştı. E-posta doğrulama akışının otomatik arayüz testleri gerçek gönderim yerine kontrollü yanıtlar kullanır.

Canlı ana sayfa anonim olarak açıldı. Render Free soğuk başlangıç ekranı gözlendi; bu ücretli/uyumayan bir sunucuya eşdeğer erişilebilirlik sağlamaz.

## Düzeltilen bulgular

1. Doğrulanmamış e-postayla doğrudan giriş: doğrulama durumu ve süreli/tek kullanımlık bağlantı eklendi.
2. Sınırsız giriş ve e-posta denemeleri: istek ve gönderim sınırları eklendi.
3. Hatalı/sınırsız istekler: kontrollü hata yanıtları, alan sınırları, JSON boyutu ve istemci yanıt süresi sınırı eklendi.
4. İlk bağımlılık taramasında 6 Java paket grubunda güvenlik bildirimleri vardı. Bildirimlerin tümü bu uygulamanın kullandığı özelliklerde erişilebilir olmak zorunda değildir; yine de desteklenen Spring Boot 4.0.9 / Spring 7 ve yönetilen yamalı paketlere geçildi. Son JAR taramasında bildirim kalmadı.
5. Boot 4'ün varsayılan H2 2.4 sürümünde eski şema testinde kısıt hatası görüldü. Yerel H2, Flyway'in doğruladığı ve taramada açık bildirilmeyen 2.3.232 sürümüne sabitlendi. Üretim PostgreSQL kullanır.
6. Dokümanlardaki eski “henüz canlıya alınmadı” ve “e-posta doğrulaması yok” ifadeleri güncellendi.

## Sınırlar

- Bu bir kusursuzluk, sızma testi veya güvenlik garantisi değildir. OSV ve npm sonuçları tarama anındaki bilinen kayıtları gösterir; test/build araçları, işletim sistemi ve Docker imajı bu runtime paket taramasına dahil değildir.
- Docker motoru olmadığı için Compose ve final Docker imajı bu makinede çalıştırılmadı. JAR derlendi ve test edildi.
- Gerçek Brevo teslimi, kota/aktivasyon durumu ve canlı e-posta doğrulama akışı kurulum bekliyor.
- Bellekteki istek sınırları yeniden başlatmada sıfırlanır; hesap başına gönderim sayacı PostgreSQL'de kalır.
- Şifre kurtarma, moderasyon ve çoklu sunucu ortak oturum desteği eklenmedi.
- V3 sonrası eski backend'e doğrudan geri dönüş şema uyumluluğu nedeniyle desteklenmez; ayrıntı EPOSTA-KURULUM.md içinde.

Kaynaklar: [OSV API](https://google.github.io/osv.dev/post-v1-querybatch/), [Spring Boot 4 geçiş kılavuzu](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide), [Render Free](https://render.com/docs/free), [Brevo API](https://developers.brevo.com/docs/send-a-transactional-email).
