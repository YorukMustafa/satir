# Arayüz kontrolü — 28 Ekim 2026

## Düzeltilen sorunlar

- Üst/alt Satır logosu ve Ana sayfa bağlantıları her sayfadan ana sayfaya döner; aramayı da temizler. Aynı adrese tekrar basılması da çalışır.
- Kategori ve arama adresleri URL'de korunur; geri/ileri ve doğrudan açma desteklenir. Yavaş eski istekler yeni sayfanın üzerine yazamaz.
- Mobil arama görünür. 390 px mobil ve 1280 px masaüstünde yatay taşma kontrolü geçti. Altı kategori mobilde kaydırma gerektirmeden görünür.
- Kaydet/kaldır yorum taslağını silmez. Girişsiz kaydetme, girişten sonra istenen yazı için devam eder. Çift tıklama tek istek üretir.
- Taslak kartlarında geçersiz kaydet düğmesi yoktur. Boş liste, boş kategori ve sonuçsuz arama durumları farklı açıklamalar ve çalışan yönlendirmeler içerir.
- Film/dizi alanları yalnız ilgili türde görünür ve zorunludur. Enter ile gönderim güvenle taslak kaydeder. Düzenlenen içerik güncel haliyle açılır.
- Yorum gönderildikten sonra yalnız yorum alanı yenilenir; sayfanın geri kalanı yeniden çizilmez.
- Hesap adı Hesabım sayfasını açar; Çıkış yap ayrı, açık bir düğmedir. Satır hakkında ve alt menü bağlantıları tamamlandı.
- Korunan veya bulunamayan adresler eski/boş sayfa yerine açıklama ve geri dönüş düğmeleri gösterir. Ağ hatasında Yeniden dene bulunur. Oturumu biten kullanıcıya giriş menüsü geri gelir.

## Gerçek tarayıcı ve backend ile kontrol edilenler

| Akış                                                                 | Sonuç |
| -------------------------------------------------------------------- | ----- |
| Üst/alt logo, ana sayfa, kategori düğmeleri                          | Geçti |
| Altı kategori ve kategori başlıkları                                 | Geçti |
| Arama, filtreyi temizleme, bekleyen arama sırasında ana sayfa        | Geçti |
| Tarayıcı geri/ileri, keşfet, hakkında, hesap sayfası                 | Geçti |
| Modal aç/kapat, okuyucu kaydı, hatalı/başarılı giriş, çıkış          | Geçti |
| Kaydet/kaldır, yorum taslağını koruma, yorum gönderme                | Geçti |
| Boş okuma listesi ve keşfe dönüş                                     | Geçti |
| Adminin yazar oluşturması ve okuyucuyu yazar yapması                 | Geçti |
| Yazarın taslak oluşturması, film puanı/spoiler, düzenleme, yayımlama | Geçti |
| Yazı masası, silme onayını açma ve vazgeçme                          | Geçti |
| Mobil/masaüstü taşma ve mobil arama                                  | Geçti |

Silme işlemi backend entegrasyon testinde doğrulanır; tarayıcıda onay penceresi ve vazgeçme kontrol edildi. Yalnız bu kontrol için oluşturulan yerel örnek yayın, test sonunda API ile temizlendi. Deneme hesapları ve içerikleri dağıtım paketinin parçası değildir.

## Tekrarlanabilir kontroller

```sh
npm ci
npm test
mvn verify
```

Node yalnız arayüz regresyon testleri içindir. Uygulama çalışırken Node gerekmez. Arayüz testleri DOM ortamında 21 regresyon senaryosunu; Java testleri gerçek Spring context içinde 14 senaryoyu doğrular. Tarayıcıda ayrıca yukarıdaki kullanıcı akışları denenmiştir. Gerçek Render dağıtımı bu kontrolün kapsamında yapılmadı.
