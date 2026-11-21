# KeyLord – Şifre Üretici ve Şifreli Geçmiş (Tasarım)

Tarih: 2026-11-21 · Durum: onay bekliyor

## Amaç ve neden

KeyLord kullanıcıları (sistem/ağ yöneticileri) Linux, Windows, FortiGate, Sophos gibi
hedeflerde ve web yönetim panellerinde yeni şifre belirliyor. Rastgele bir şifre üretip
gönderdikten sonra onu bir yere kaydetmeyi unuturlarsa şifre kaybolur.

Bu özellik:
1. 1Password'ün şifre üreticisi (https://1password.com/password-generator) gibi bir üretici sunar.
2. Üretilen şifreyi açık sayfaya gönderir: vCenter konsoluna tuş vuruşu olarak **veya**
   normal bir web sayfasındaki şifre alanını doldurarak.
3. Her gönderimi **güvenlik ağı** olarak kaydeder: şifre, sayfa adresi, kullanıcı adı/not,
   tarih ve mümkünse sayfanın ekran görüntüsü. Kullanıcı sonra bulup şifreyi tekrar görebilir.

## Hedefler

- KeyLord kutusuna sol menü: ⌨ Konsol (bugünkü ekran), 🔑 Şifre üretici, 🕘 Geçmiş.
  🕘 kutuda liste açmaz, eklentinin kendi **Kasa sayfasını** (`vault.html`) yeni sekmede açar.
- Üretici: tür (rastgele / PIN), uzunluk, rakam, sembol; yeniden üret, kopyala, gönder.
- Gönderim iki yolla (kullanıcı kararı: "ikisi birden"):
  - Konsol bulunduysa: mevcut motorla tuş vuruşu.
  - Konsol yoksa: sayfadaki şifre alanını doldurma.
- Kayıtlar **ana parolayla korunan** kasada (kullanıcı kararı).
- **Üretip göndermek ana parola istemez**; yalnızca kayıtları okumak ister (kullanıcı kararı).
- **Ana parola hiçbir web sayfasına yazılmaz**; yalnızca Kasa sayfasında girilir (kullanıcı kararı).
- Kasa Google hesabına **etiketlenir** (kullanıcı kararı: koruma değil, işaret).
- **Bilgisayar değişince/bozulunca kayıt kaybolmaz** (kullanıcının amacı):
  şifreli metin kayıtları `chrome.storage.sync` ile eşitlenir + ekran görüntüleri dahil
  şifreli yedek dosyası.
- **Her dağıtım yoluna dayanıklı** (kullanıcı kararı: önce zip, sonra Chrome Web Mağazası;
  "her ihtimali kapsasın"). Bkz. "Dağıtım ve kimlik".

## Hedef olmayanlar

- Tam şifre yöneticisi değil: otomatik giriş, site eşleştirmeli öneri yok.
- Google Drive entegrasyonu yok.
- Google ile kilit açma yok (Google eklentiye gizli anahtar vermez).
- Ana parola kurtarma yok (tasarım gereği imkânsız).
- İlk sürümde yok: ana parola değiştirme, kelimeli ("memorable") şifre türü,
  iç çerçevelerdeki (iframe) şifre alanları.

## Anti-hedefler (çalışsa bile başarısızlık sayılır)

- Şifrenin düz metin kalması: depolama, eşitleme, yedek, ekran görüntüsü, log, durum satırı.
- Ana parolanın veya çözülmüş kayıtların bir web sayfasının içine inmesi.
- Eklentinin tüm sitelere erişim (host permission / `<all_urls>`) istemesi.
- **Şifrenin hedefe gönderilip geçmişte olmaması** (yarım gönderim dahil).
- **Kaydedilen şifre ile hedefte oluşan şifrenin farklı olması** (CLI'nin karakteri yorumlaması).
- Mevcut konsol gönderiminin bozulması.

## Kısıtlar

- Manifest V3. İzinler şu an `activeTab`, `scripting`, `storage`.
  Eklenecek: `identity`, `identity.email` (Google e-postası etiketi), `unlimitedStorage`
  (yerel ekran görüntüleri). Host izni ve `alarms` **eklenmez**.
- `chrome.storage.sync`: toplam ~100 KB, öğe başı 8 KB, en çok 512 öğe,
  dakikada 120 / saatte 1.800 yazma. Şifreli kayıt ~0,5 KB → pratikte ~150–200 kayıt.
- `storage.sync` yalnızca Chrome eşitlemesi açık ve "Uzantılar" eşitleniyorsa gerçekten
  eşitlenir; aksi hâlde sessizce yerel kalır. Profil Google'a bağlı değilse
  `getProfileUserInfo` boş e-posta döner.
- `storage.sync` eklenti kimliğine bağlıdır (bkz. "Dağıtım ve kimlik").
- Service worker ~30 sn boşta kalınca kapanır: bellekte durum ve zamanlayıcı tutulamaz.
- `storage.session` yalnızca JSON saklar (CryptoKey değil) ve eklenti yeniden
  yüklenince/güncellenince silinir.
- Ekran görüntüsü: `chrome.tabs.captureVisibleTab`, kullanıcının KeyLord'u açarken verdiği
  `activeTab` yetkisiyle; sayfa başka adrese giderse yetki düşer.
- Bugünkü sertleştirme korunur: kapalı shadow root, kutuda sayfa adresi,
  konsol hazır değilse konsol gönderimi kapalı.
- Kod stili: bağımlılıksız düz JS, Türkçe arayüz, saf mantık Node testli.

## Yaklaşımlar

**Arayüz yeri**
1. **Mevcut kutuya sol menü (seçilen).** Kutu hedef sayfada açıldığı için gönderme, alan
   doldurma ve ekran görüntüsü mevcut izinlerle yapılır.
2. Ayrı ana sayfa. Başka sekmeye göndermek için tüm sitelere erişim izni ister. Reddedildi.

**Ana parola ve geçmiş nerede**
1. **Kasa sayfasında, açık anahtarlı şifreleme (seçilen).** Kayıtlar açık anahtarla
   şifrelenir: yazmak parola istemez, okumak ister. Ana parola ve çözülmüş kayıtlar yalnızca
   eklentinin kendi sayfasında; web sayfası ikisine de erişemez.
2. Kutuda simetrik kasa (ilk taslak). Kapalı shadow root klavye olaylarını gizlemez; sayfa
   ana parolayı dinleyebilir, geçmiş hedef sayfanın içinde çözülür. Reddedildi.

## Tasarım

### Bileşenler

| Parça | Nerede çalışır | Görevi |
|---|---|---|
| Kutu (`dialog.js`) | hedef sayfa, yalıtılmış dünya | Konsol / Üretici sekmeleri, 🕘 → Kasa sayfası |
| Motor (`engine.js`) | hedef sayfa, MAIN dünya | konsola tuş vuruşu (değişmez) |
| Alan doldurucu | hedef sayfa, yalıtılmış dünya | şifre alanını bulur ve doldurur |
| Arka plan (`background.js`) | service worker | kayıt şifreleme, ekran görüntüsü, depolama |
| Kasa sayfası (`vault.html`) | eklenti sayfası | ana parola, geçmiş, ayrıntı, yedek, kurulum |

Kutu ile arka plan `chrome.runtime.sendMessage` ile konuşur (sayfa bu kanalı dinleyemez).
Kutu arka plana yalnızca **yeni kayıt** gönderir; arka plan kutuya hiçbir zaman çözülmüş
kayıt göndermez.

### Kutu düzeni

```
┌──┬────────────────────────────┐
│⌨ │ KeyLord        site.com  × │
│🔑│ ( Rastgele | PIN )          │
│🕘│ [ Xk9!mP2...        ] [↻]   │
│  │ Uzunluk  ────●──── 20       │
│  │ [x] Rakam [x] Sembol        │
│  │ Semboller: (CLI-güvenli|Tüm)│
│  │ Kullanıcı adı / not: [   ]  │
│  │ [Gönder] [Kopyala]          │
│  │ durum satırı                │
│  │ Developed by Gürkan Deveci  │
└──┴────────────────────────────┘
```

- Sol şerit dikey ikon düğmeleri (`aria-label`'lı). Seçili sekme ayarlarda hatırlanır.
- Kasa henüz kurulmadıysa 🔑 sekmesi "Önce kasayı kurun" der ve Kasa sayfasını açan
  düğme gösterir; kurulmadan şifre gönderilemez (kayıtsız gönderim olmasın).

### Şifre üretici (saf modül, testli)

- `crypto.getRandomValues` + reddetme örneklemesi (modulo yanlılığı yok).
- Rastgele: uzunluk 8–64 (varsayılan 20); büyük/küçük harf her zaman, rakam ve sembol
  seçmeli; seçili her gruptan en az bir karakter. Benzer karakterler (`0 O o 1 l I`)
  varsayılan hariç.
- PIN: 4–12 rakam (varsayılan 6).
- Semboller iki küme:
  - **CLI-güvenli (varsayılan):** `! @ % _ - + = . , :` – FortiOS'ta `?` yardım açar;
    tırnak, `\`, `#`, `;`, `$`, `&`, `|`, `<`, `>`, boşluk, `` ` ``, `^`, `~`
    yorumlanabilir veya ölü tuş ister. Builder, listeyi FortiOS/Sophos/bash/cmd
    kaçış kurallarına karşı doğrulayıp gerekirse daraltır.
  - **Tüm semboller:** ölü tuş gerektirenler (`^ ~ \``) hariç tüm ASCII semboller.

### Gönderim akışı

1. Kullanıcı Gönder'e basar.
2. Kutu arka plana kaydı yollar: `{ url, host, username, method, password, status: "pending" }`.
   Arka plan şifreleyip kaydeder ve `id` döner. **Kayıt başarısızsa gönderim yapılmaz.**
3. Gönderim:
   - Konsol hazırsa: mevcut `planKeys` + `runStrokes` (konsol sekmesindeki düzen, ölü tuş,
     hız, "sonunda Enter" ayarlarıyla).
   - Değilse: alan doldurma (aşağıda).
4. Sonuç arka plana bildirilir: `status` → `sent` / `partial` (iptal ya da yarıda hata) /
   `failed` (hiç tuş gitmedi ya da alan bulunamadı).
   `failed` kayıtlar geçmişte soluk gösterilir ama silinmez.
5. `sent` ve `partial` için ekran görüntüsü alınır (aşağıda).

Kopyala: kayıt `method: "copy"`, `status: "copied"` ile oluşturulur, görüntü alınmaz.
Aynı şifre için sonraki kopyala/gönder işlemleri **aynı kayda** eklenir (olay listesi);
yeni kayıt açılmaz → sync kotası korunur.

### Alan doldurma (saf seçim mantığı testli)

- Kutu açılmadan önceki odak `document.activeElement` ile **kutu odak almadan önce** okunur.
- Kural:
  1. Bu odaklı alan boş, görünür, düzenlenebilir bir `type=password` ise → yalnızca o, ve
     DOM sırasında ondan sonraki ilk boş görünür `type=password` (tekrar alanı) doldurulur.
  2. Değilse (alan yok, kullanıcı adı alanı, dolu alan) → sayfadaki **boş** görünür
     `type=password` alanlarının tümü (genelde "yeni" + "tekrar").
  3. Hiçbiri yoksa → hata: "Doldurulacak boş şifre alanı bulunamadı. Alana tıklayıp tekrar deneyin."
- `type=password` olmayan alana ve dolu alana **asla** yazılmaz.
- Değer native setter ile yazılır; `input` ve `change` olayları tetiklenir (React/Vue uyumu).
- Yalnızca kutunun açıldığı çerçeve aranır (iframe ilk sürümde yok; hata mesajı bunu söylemez,
  builder gerekirse not ekler).

### Ekran görüntüsü

- Kutu 1 kare boyunca gizlenir (açık şifre görüntüye girmesin), arka plan
  `captureVisibleTab` (JPEG ~70) çağırır, kutu geri açılır.
- Görüntü açık anahtarla şifrelenip yerelde (`storage.local`) saklanır; sync'e gitmez.
- Alınamazsa kayıt görüntüsüz kalır, durum satırı bunu söyler.

### Kasa ve şifreleme

- **Kurulum** (Kasa sayfasında): ana parola (en az 12 karakter, iki kez) + "unutursan
  kayıtlar geri gelmez, yedek al" uyarısı.
- Anahtarlar:
  - Kasa anahtar çifti: ECDH P-256 (WebCrypto).
  - Açık anahtar: sync'teki kasa başlığında, düz.
  - Gizli anahtar: PBKDF2-SHA256 (≥ 600.000 tur, 16 bayt tuz) ile türetilen AES-GCM-256
    anahtarla sarılıp başlıkta.
- Kayıt şifreleme (ECIES): her kayıt için geçici ECDH anahtarı → ortak sır → HKDF-SHA256 →
  AES-GCM-256 (12 bayt IV). Şifreli kayda geçici açık anahtar ve IV eklenir.
  Kayıt yazmak için ana parola gerekmez.
- Kasa başlığı: `{ v, vaultId, kdf: {salt, iterations}, publicKey, wrappedPrivateKey,
  googleEmail, createdAt }`. `v` sürüm alanı ileride göçü mümkün kılar.
- **Kilit açma** yalnızca Kasa sayfasında. Açılınca gizli anahtar (çıkarılabilir PKCS8 bayt
  olarak) `storage.session`'a `{ key, lastActivity }` diye yazılır; erişim düzeyi varsayılan
  (yalnızca eklenti sayfaları). Böylece sekme kapanıp açılınca tekrar sorulmaz.
- **Otomatik kilit:** her okumada `lastActivity` kontrol edilir; 15 dk geçmişse anahtar
  silinir ve parola sorulur. Ayrıca tarayıcı kapanınca ve eklenti yeniden yüklenince kilitlenir
  (`storage.session` doğası). `alarms` izni gerekmez.
- "Şimdi kilitle" düğmesi.

### Google etiketi ve eşitleme uyarıları

- Kurulumda `chrome.identity.getProfileUserInfo({accountStatus: "ANY"})` e-postası başlığa
  yazılır. Kasa sayfası açılınca farklıysa: "Bu kasa x@… hesabına ait" uyarısı (engellemez).
- E-posta boşsa (profil Google'a bağlı değil): kalıcı uyarı "Chrome'da Google hesabıyla
  oturum açın ve Uzantılar eşitlemesini açın; yoksa kayıtlar yalnızca bu bilgisayarda kalır.
  Yedek alın."
- Eşitlemenin gerçekten açık olduğu API'den anlaşılamaz; uyarı metni "Uzantılar
  eşitlemesinin açık olduğundan emin olun" der.

### Kayıt modeli ve depolama

```
sync:  vault        → kasa başlığı
       rec:<id>     → şifreli { createdAt, url, host, username, password, method,
                                status, events: [{at, method, status}], hasScreenshot }
local: shot:<id>    → şifreli JPEG
       pending:<id> → sync'e yazılamayan kayıtlar (kota/hız sınırı)
```
- Sync yazımı başarısızsa kayıt `pending:` olarak yerelde tutulur, sonra yeniden denenir;
  Kasa sayfası "N kayıt eşitlenmedi" gösterir. **Hiçbir kayıt sessizce silinmez.**
- Kota %80'e gelince Kasa sayfası uyarır ve "Eski kayıtları yedekle ve sil" önerir.

### Kasa sayfası (`vault.html`)

- Kilit ekranı / kurulum ekranı.
- Liste: tarih, host, kullanıcı adı, durum; arama (host, kullanıcı adı).
- Kayıt ayrıntısı: şifre (gizli başlar, göster/kopyala), tam adres, olaylar, ekran görüntüsü.
- Sil (onaylı), Şimdi kilitle, Yedek al, Yedekten yükle.

### Yedek

- Dosya: `{ format: "keylord-backup", v, vault: <başlık>, records: [...], shots: {...} }`.
  Kayıtlar zaten şifreli olduğu için olduğu gibi yazılır; dosya kendi başlığını taşır.
- Yükleme:
  - Bu cihazda kasa yoksa: yedeğin başlığı kasa olur, yedeğin ana parolası sorulur.
  - Kasa varsa: önce mevcut kasa açılır, sonra yedeğin parolası sorulur; yedek kayıtları
    çözülüp mevcut kasanın açık anahtarıyla yeniden şifrelenir, `id` ile birleştirilir.

### Dağıtım ve kimlik ("her ihtimali kapsasın")

- Şimdi bir RSA anahtar çifti üretilir; açık kısmı manifest `key` alanına yazılır →
  zip ile her bilgisayarda aynı eklenti kimliği, sync ortak.
- **Gizli anahtar (`key.pem`) repoya girmez** (`.gitignore`), kullanıcıya güvenli
  saklaması söylenir. Mağazaya ilk yüklemede bu kimliği korumak için kullanılabilir
  (Chrome Web Mağazası'nın ilk yüklemede `key.pem` kabulü yayın anında doğrulanmalı).
- Kimlik yine de değişirse (mağaza kabul etmezse, anahtar kaybolursa): eski kimliğin sync
  verisine yeni kimlik erişemez. Kurtarma yolu: eski sürümde **Yedek al** → yeni sürümde
  **Yedekten yükle**. Kasa sayfası, kasa yokken ilk açılışta "Yedekten yükle" seçeneğini
  öne çıkarır.
- Mağaza sürümüne geçiş adımları README'ye yazılır.
- Not: manifest kimliği bir kez değişeceği için mevcut kurulumların ayarları sıfırlanır
  (yalnızca konsol ayarları; kabul edilebilir).

## Builder'a kalanlar

- Dosya bölünmesi, mesaj şeması ayrıntıları.
- İkonlar (satır içi SVG), Kasa sayfası görsel düzeni.
- CLI-güvenli sembol listesinin son doğrulaması.
- Test stratejisi: üretici, ECIES sarmalayıcısı, kayıt birleştirme, alan seçme kuralı,
  yedek birleştirme saf fonksiyonlar olarak Node testli (Node'da WebCrypto var);
  arayüz sahte konsol ve sahte şifre formu sayfasında.
