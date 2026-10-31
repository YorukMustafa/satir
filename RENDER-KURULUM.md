# Ücretsiz yayın: Render + Neon

Frontend ve Spring backend **aynı ücretsiz Render Web Service** üzerinden sunulur. Yazılar, hesaplar, yorumlar ve okuma listeleri **Neon Free PostgreSQL** içinde tutulur. Ayrı bir frontend servisi veya alan adı gerekmez. Render'ın verdiği HTTPS adresini kullanabilirsin.

## Hesap bağlantıları

Otomatik kurulum için Render ve Neon bağlantılarını bu sohbette tamamla. İki hizmette de **Free** planı kullanılmalıdır; ödeme bilgisi veya ücretli plan eklenmez. Kurulum araçları erişim verene kadar kaynak oluşturulduğu veya yayının tamamlandığı varsayılmaz.

## Kurulum sırası

1. Neon hesabında Free plan altında `satir` PostgreSQL projesi oluştur. Uygulama için veritabanı, kullanıcı ve bağlantı bilgilerini al. Bölgeyi mümkünse Frankfurt seç.
2. Render'da GitHub'daki `YorukMustafa/satir` deposundan `render.yaml` Blueprint'ini kur. Dosya yalnızca `plan: free` web servisi tanımlar; ücretli veritabanı kaynağı içermez.
3. Aşağıdaki değerleri Render'ın **Environment** bölümüne gizli ortam değişkeni olarak ekle. Gerçek şifreleri GitHub'a, dosyalara veya bu kılavuza yazma.

| Değişken | İçerik |
|---|---|
| RENDER_DATABASE_URL | Neon'un verdiği `postgresql://...` bağlantı adresi |
| DATABASE_USER | Neon veritabanı kullanıcısı |
| DATABASE_PASSWORD | Neon veritabanı şifresi |
| ADMIN_EMAIL | Siteye ilk admin olarak gireceğin e-posta |
| ADMIN_PASSWORD | En az 10 karakter, UTF-8 olarak en fazla 72 bayt ilk admin şifresi |

`SPRING_PROFILES_ACTIVE=render`, `COOKIE_SECURE=true` ve Java bellek ayarları Blueprint içinde hazırdır. `render` profili PostgreSQL bağlantısını JDBC biçimine dönüştürür ve TLS kullanır. Bu sırada veritabanı şeması Flyway ile otomatik kurulur.

4. Render deploy'unun tamamlanmasını bekle ve verilen HTTPS adresini aç.
5. Sağ üstteki **Giriş yap** üzerinden admin bilgilerinle giriş yap. **Yazarlar** bölümünden yazar oluştur veya okuyucuya yazar yetkisi ver.

## İlk admin ve yazar girişi

Siteye üye olmak okuyucu hesabı açar. Yazarları yalnızca admin ekler. İlk admin, hiç admin yokken ADMIN_EMAIL ve ADMIN_PASSWORD ile oluşturulur. Sonraki deploy'larda bu değerler mevcut hesabı veya parolayı değiştirmez. İlk oluşturma sonrası admin ortam değişkenlerini kaldırabilirsin; hesap Neon'da korunur. Şifre sıfırlama akışı bu sürümde bulunmaz.

## Ücretsiz planların sınırları

Render Free web servisi 15 dakika hareketsizlikte uyur; ilk açılış gecikebilir. Render'ın yerel dosyaları kalıcı değildir. Bu nedenle H2 dosyası yerine Neon PostgreSQL kullanılır. Neon Free planı süre sınırı olmadan sunulur; depolama ve aylık işlem/aktarım kotaları vardır. Kotalar dolarsa ücretli plana otomatik geçilmez; hizmeti durdurmak veya kullanımı azaltmak gerekir. Planlarını Free olarak koru.

Render'ın kendi Free PostgreSQL hizmeti 30 gün sonra sona erdiği için bu yapılandırmada kullanılmıyor. Ücretsiz servisler erişilebilirlik garantisi sağlamaz.

## Kontroller

Yayın sonrasında ana sayfa ve kategoriler oturumsuz açılmalı; admin girişi, yazar ekleme, yazı yayımlama, yorum ve okuma listesi denenmeli. Bir deploy/yeniden başlatma sonrası yazıların ve hesapların korunması kontrol edilmeli. Uygulama oturumları yeniden başlatmada bitebilir; kullanıcı tekrar giriş yapar.

Bu kılavuzun güncellendiği aşamada Render ve Neon hesap bağlantıları bekleniyor; canlı URL henüz oluşturulmadı.

Resmi kaynaklar (31 Ekim 2026):
- https://render.com/docs/free
- https://render.com/docs/blueprint-spec
- https://neon.com/pricing
