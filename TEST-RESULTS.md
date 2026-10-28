# Doğrulama — 28 Ekim 2026, güncellenmiş sürüm

- Spring Boot + H2 + MockMvc: 12 API testi, 0 hata/başarısızlık.
- Dağıtım ve sürüm geçişi: 2 test, 0 hata/başarısızlık.
- Toplam: 14 test geçti; `mvn verify` BUILD SUCCESS.
- Kontroller: normal kayıtla WRITER/ADMIN rolü alınamaması, yalnız adminin yazar listesine erişmesi ve yazar oluşturması, okuyucunun yazara yükseltilmesi, okuyucunun yayın yapamaması, sahiplik ve taslak gizliliği, CSRF, yorumlar, okuma listesi, yeni kategoriler.
- V1 → V2: eski yazılar korunur, serbest kayıt yazarları okuyucuya çevrilir. Admin yeniden yazar yetkisi verebilir.
- Render PostgreSQL URL'sinin JDBC/TLS biçimine çevrilmesi ve kimlik bilgilerinin JDBC URL'sinden çıkarılması test edildi.
- Render Blueprint resmi JSON Schema ile yerelde doğrulandı.
- Tarayıcıda admin girişi, adminin yazar oluşturması, rol menüleri ve Tarih kategori sayfası doğrulandı.
- Altı kategoride HTTP üzerinden örnek yayın ve yazarın admin API'sinden 403 alması doğrulandı.
- Yeniden başlatma sonrası altı örnek yayının korunduğu doğrulandı.
- Son frontend düzeltmeleri sonrası JavaScript sözdizimi kontrolü ve paketleme başarılı; backend testleri değişmedi.
- Deneme hesapları ve örnek yazılar yalnız work/ altındaki önizleme veritabanındadır; ZIP ve JAR içermez.
- Docker, gerçek PostgreSQL ve Render dağıtımı bu ortamda çalıştırılmadı. Ücretli kaynak oluşturulmadı.

## Arayüz tamamlama doğrulaması

- 21 DOM regresyon testi: logo ve arama temizliği, altı kategori, arama/URL, yorum taslağı korunması, taslakta kaydet düğmesi olmaması, film alanları, düzenleme, Enter ile taslak, erişim ekranları, yarışan istekler, yorum gönderme, çift tıklama, giriş sonrası kaydetme, hesap/çıkış, sayfalama hatası, 404 geri dönüşü, süresi dolan oturum ve ağ hatasından yeniden deneme.
- 14 Java entegrasyon testiyle birlikte toplam 35 otomatik kontrol.
- 390 px ve 1280 px genişliklerde yatay taşma yok; mobilde arama ve tüm kategoriler görünür.
- Gerçek tarayıcı ile okuyucu, yazar ve admin akışları denendi; son kontrolde JavaScript hata kaydı görülmedi. Ayrıntılar ARAYUZ-KONTROL.md içinde.
