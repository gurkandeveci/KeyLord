# KeyLord – Send Keys to Console

Chrome'da açılan sanal makine web konsoluna, "KeyLord" kutusuna yazdığınız metni tek tek
tuş vuruşu olarak ileten Chrome eklentisi. Web konsolunda yapıştırma çalışmadığı için uzun komutları ve
karmaşık parolaları elle yazma derdini ortadan kaldırır. Ayrıca rastgele şifre üretir, gönderdiği her şifreyi
ana parolayla korunan şifreli bir kasaya kaydeder. Windows ve macOS'ta Chrome ile çalışır.

https://chromewebstore.google.com/detail/keylord-%E2%80%93-send-keys-to-co/lnkkedffjgecpfahibmnlhimadopejcd

## Kurulum

Chrome Web Store : 
https://chromewebstore.google.com/detail/keylord-%E2%80%93-send-keys-to-co/lnkkedffjgecpfahibmnlhimadopejcd

Kısayol varsayılan olarak **Alt+Shift+K**'dır (macOS'ta Option+Shift+K). Çalışmıyorsa veya değiştirmek
isterseniz `chrome://extensions/shortcuts` sayfasından atayın.

## Kullanım

1. Sanal makinenin **web konsolunu** (Konsol) açın ve bağlanmasını bekleyin.
2. KeyLord simgesine tıklayın (veya kısayola basın). Sayfanın sağ üstünde **KeyLord** kutusu açılır;
   durum satırında "Konsol bulundu, gönderime hazır." yazmalıdır.
3. Konsolda imlecin doğru yerde olduğundan emin olun (ör. parola alanına tıklanmış olsun).
4. Metni kutuya yazın veya yapıştırın, **Gönder**'e basın (kısayol: Ctrl+Enter / Cmd+Enter).

Çok satırlı metinde her satır sonu Enter olarak gönderilir. **Durdur** gönderimi keser ve basılı kalan
tuşları bırakır. **Tek tuş** düğmeleri Tab, Enter, Esc ve Ctrl+Alt+Del gönderir; örneğin Windows oturum
açma ekranında: kullanıcı adı → **Tab** → parola → **Enter**.

Konsol araç çubuğu olmayan ayrı bir pencerede açıldıysa kutuyu klavye kısayoluyla açın.

## Gönderim ayarları

| Ayar | Açıklama |
| --- | --- |
| **Klavye düzeni** | *Sanal makinenin içindeki* işletim sisteminin düzeni: **Türkçe Q** veya **US**. Kendi klavyenizin düzeni fark etmez. FortiGate, Sophos gibi cihazların konsolu US düzenindedir. |
| **Ölü tuş düzeltmesi** | Yalnızca Türkçe Q'da. Bazı sistemlerde `^`, `~` ve ters tırnak karakterleri ardından boşluk basılmadan ekrana çıkmaz. **Windows**: üçünden sonra da boşluk basar. **Linux**: yalnızca `^` sonrası. **Kapalı**: hiç basmaz. Hedefte fazladan boşluk çıkıyorsa bir alt seçeneğe, karakter hiç çıkmıyorsa bir üst seçeneğe geçin. |
| **Hız** | Tuşlar arası bekleme. Karakter kaçıyorsa **Yavaş** veya **Çok yavaş** seçin (BIOS, kurulum ekranları, yüklü sistemler). |
| **Sonunda Enter gönder** | Metnin ardından Enter basar. |
| **Gönderdikten sonra kutuyu temizle** | Başarılı gönderimden sonra metni siler. |
| **Metni gizle** | Yazılanı parola alanı gibi noktalarla gösterir. |

Seçili düzende yazılamayan bir karakter varsa (ör. US düzeninde `ş`) hiçbir şey gönderilmez ve hangi
karakterin sorun çıkardığı gösterilir; böylece yarım yamalak parola gönderilmez.

## Şifre üretici

KeyLord kutusunun sol şeridinde üç sekme vardır: ⌨ **Konsol** (yukarıdaki metin gönderimi), 🔑 **Şifre
üretici** ve 🕘 **Geçmiş**. 🔑 sekmesi rastgele şifre veya PIN üretir; yeniden üretebilir, kopyalayabilir
ya da doğrudan gönderebilirsiniz.

| Ayar | Açıklama |
| --- | --- |
| **Tür** | *Rastgele* (uzunluk 8–64, varsayılan 20; büyük ve küçük harf her zaman, rakam ve sembol seçmeli, seçili her gruptan en az bir karakter) veya *PIN* (4–12 rakam, varsayılan 6). |
| **Semboller** | **CLI-güvenli** (varsayılan): `! @ % _ - + = . , :`. **Tüm semboller**: ölü tuş isteyenler (`^ ~` ve ters tırnak) hariç tüm ASCII semboller. |
| **Kullanıcı adı / not** | Kayda eklenir; sonradan hangi şifrenin nereye ait olduğunu bulmanızı sağlar. |

Benzer karakterler (`0 O o 1 l I`) şifrelerden hariç tutulur. Rastgelelik `crypto.getRandomValues` ile sağlanır.

**CLI-güvenli semboller neden var?** Şifreyi yeni bir cihazın komut satırında belirlerken karakterlerin
yorumlanması şifrenin kaydettiğinizden farklı olmasına yol açabilir: FortiOS'ta `?` yardım açar; tırnak,
`\`, `#`, `;`, `$`, `&`, `|`, `<`, `>` ve boşluk kabuk veya CLI tarafından yorumlanabilir; `^`, `~` ve
ters tırnak ise ölü tuş ister. Varsayılan küme bunlardan kaçınır. Yine de hedef cihazda ilk kez
kullanıyorsanız şifreyi önce deneyin.

### Gönderim

**Gönder**'e basıldığında şifre iki yoldan birine gider:

- **Konsol bulunduysa** (durum satırında "Konsol bulundu" yazar): konsol sekmesindeki düzen, ölü tuş, hız
  ve "sonunda Enter" ayarlarıyla tuş vuruşu olarak gönderilir.
- **Konsol yoksa**: sayfadaki şifre alanı doldurulur. Kutu açılmadan önce odaklı olan boş şifre alanı (ve
  ondan sonraki "tekrar" alanı) doldurulur; odakta uygun alan yoksa sayfadaki tüm boş şifre alanları
  doldurulur. Dolu alanlara ve şifre olmayan alanlara asla yazılmaz. Boş şifre alanı bulunamazsa uyarı
  verilir. Yalnızca kutunun açıldığı çerçevedeki alanlar aranır; iç çerçevelerdeki (iframe) alanlar
  desteklenmez.

**Kayıt her zaman önce yazılır.** Şifre gönderilmeden önce şifreli olarak kaydedilir; kayıt yazılamazsa
gönderim yapılmaz, böylece gönderilip de kaydı olmayan şifre oluşmaz. Gönderim sonucu kayda işlenir:

- **Gönderildi**: tamamı gitti.
- **Yarım**: gönderim durduruldu veya ortasında hata oldu; hedefte şifrenin bir kısmı kalmış olabilir.
- **Başarısız**: hiç tuş gitmedi veya doldurulacak alan bulunamadı. Kayıt silinmez, listede soluk görünür.

Başarılı ve yarım gönderimden sonra sayfanın **ekran görüntüsü** alınır (şifre görüntüye girmesin diye kutu
bir an gizlenir). Alınamazsa (ör. bu arada başka sekmeye geçildiyse; başka sayfanın görüntüsü alınmaz) kayıt görüntüsüz kalır ve durum satırı bunu söyler. **Kopyala** da kayıt
oluşturur; aynı şifre için sonraki kopyala/gönder işlemleri aynı kaydın olay listesine eklenir. Şifre alanında
Ctrl+C / Cmd+C (veya kes) de **Kopyala** gibi çalışır ve kayda işlenir; alan sürüklenemez.

Kasa kurulmadan şifre gönderilemez; 🔑 sekmesi "Önce kasayı kurun" der ve Kasa sayfasını açan düğme gösterir.

## Kasa

🕘 **Geçmiş**'e basmak kutuda liste açmaz; eklentinin kendi **Kasa sayfasını** yeni sekmede açar.

- **Kurulum**: ilk açılışta ana parola belirlersiniz (en az 12 karakter, iki kez).
- **Ana parola yalnızca Kasa sayfasında girilir**, hiçbir web sayfasına yazılmaz. Şifre üretmek ve göndermek
  ana parola istemez; yalnızca kayıtları okumak ister. Kayıtlar açık anahtarla şifrelenir, çözmek için gereken
  gizli anahtar ana parolayla korunur.
- **Otomatik kilit**: 15 dakika işlem yapılmazsa kasa kilitlenir; tarayıcı kapanınca ve eklenti yeniden
  yüklenince de kilitlenir. **Şimdi kilitle** düğmesi vardır.
- **Kayıtlar**: tarih, adres, kullanıcı adı, durum; arama, şifreyi göster/kopyala, olaylar, ekran görüntüsü, silme.
- **Ana parola unutulursa kurtarma yoktur.** Bu tasarım gereğidir; kayıtlar geri getirilemez. Ana parolayı
  güvenli bir yerde tutun ve düzenli **Yedek al** yapın.
- Kasa, kurulumda Chrome'daki Google hesabının e-postasıyla etiketlenir; başka hesapla açılırsa uyarı gösterilir
  (engellemez).
- Kasa başlığı her açılışta doğrulanır (sürüm, tuz, tur sayısı ve gizli anahtarın başlıktaki açık anahtarla
  eşleşmesi). Bozuk veya değiştirilmiş başlıkta "Kasa başlığı bozuk veya değiştirilmiş." uyarısı çıkar ve kasa açılmaz.
- Kayıt durumu, kaydın olaylarındaki en iyi sonuçtur: bir kez gönderilmiş şifre sonraki başarısız denemeyle
  "Başarısız" görünmez (olaylar ayrıntıda tek tek listelenir).

### Eşitleme

Şifreli kayıtlar `chrome.storage.sync` ile bilgisayarlar arasında eşitlenir. Bunun için Chrome'da **Google
hesabıyla oturum açık** olmalı ve **Eşitleme ayarlarında "Uzantılar" açık** olmalıdır; aksi hâlde kayıtlar
sessizce yalnızca bu bilgisayarda kalır (Kasa sayfası, hesap yoksa uyarı gösterir). Eşitleme kapasitesi
sınırlıdır: yaklaşık **150–200 kayıt**; %80'e gelince Kasa sayfası uyarır. Eşitlenemeyen kayıtlar yerelde
saklanır ve sonra yeniden denenir, "N kayıt eşitlenmedi" diye gösterilir; hiçbir kayıt sessizce silinmez.
**Ekran görüntüleri eşitlenmez**, yalnızca bu bilgisayarda kalır.

**Her kişinin kasası kendinedir.** Kayıtlar, Chrome'da oturum açılmış **kendi Google hesabınıza** eşitlenir;
eklentiyi kullanan başka biriyle (aynı zip'i kurmuş olsa bile) hiçbir zaman paylaşılmaz. Her kasa ayrıca ayrı
bir ana parolayla şifrelidir. Eşitleme yalnızca **aynı kişinin kendi bilgisayarları** arasında olur (örneğin iş
ve ev bilgisayarınız, ikisinde de aynı Google hesabıyla oturum açıksa).

**Birden çok bilgisayar: ikinci kasa kurmayın.** Kasayı yalnızca bir kez, ilk bilgisayarda kurun. Başka bir
bilgisayarda Kasa sayfası "Kasayı kur" ekranını gösteriyorsa yeni kasa kurmayın: kasanın eşitlenmesini bekleyin
(birkaç dakika; sayfa her 5 saniyede bir kontrol eder ve kasa gelince kendiliğinden kilit ekranına geçer) ya da
**Yedekten yükle** ile kurun. Aynı Google hesabıyla oturum açıksa kurulum ekranı bu konuda uyarır.

Yanlışlıkla ikinci bir kasa kurulduysa, diğer kasanın anahtarıyla yazılmış kayıtlar kaybolmaz: Kasa sayfası
"Eski kasadan N kayıt var" der. O kasanın ana parolasını girip **Eski kasayı aç**'a basın; kayıtlar (ve bu
bilgisayardaki ekran görüntüleri) çözülüp mevcut kasaya yeniden şifrelenir. Her kasanın başlığı eşitlenen
depoda ve bu bilgisayarda saklandığı için eski kasa bilinir. Kasa kimliği taşımayan çok eski kayıtlar
"çözülemedi" olarak gösterilmeye devam eder; onlar için yedekten yükleyin.

### Yedek al / Yedekten yükle

**Yedek al** kayıtları, ekran görüntüleriyle birlikte, şifreli tek bir dosyaya yazar (dosya kendi kasa
başlığını taşır). **Yedekten yükle**:

- Bu bilgisayarda kasa yoksa yedeğin kasası devralınır; yedeğin ana parolası sorulur.
- Kasa varsa önce mevcut kasa açılır, sonra yedeğin ana parolası sorulur; yedekteki kayıtlar mevcut kasaya
  eklenir (aynı `id` birleştirilir).

Bilgisayar değiştirirken, eşitleme kapalıysa veya eklenti kimliği değiştiyse tek güvenilir yol yedektir.

## Bilmeniz gerekenler

- **Caps Lock**: Sanal makinede Caps Lock açıksa harfler ters büyüklükte çıkar; eklenti bunu göremez.
- **Sekmeyi önde tutun**: Gönderim sürerken başka sekmeye geçerseniz Chrome zamanlayıcıları yavaşlatır,
  gönderim saniyede bir tuşa kadar düşebilir.
- **Parolayı önce görünür bir yerde deneyin**: İlk kullanımda ayarların doğru olduğunu, metni kullanıcı adı
  alanı ya da bir metin düzenleyici gibi görünen bir yere göndererek doğrulayın. Yanlış düzenle gönderilen
  parola hesabı kilitleyebilir.
- **Gizlilik**: Konsol sekmesinde yazdığınız metin kaydedilmez; yalnızca ayarlar Chrome'un yerel deposunda
  tutulur. Şifre üreticiden gönderilen şifreler ise yalnızca şifreli olarak kasaya yazılır; düz metin olarak
  depolanmaz, eşitlenmez, yedeğe girmez. Eklenti yalnızca simgesine bastığınız sekmeye erişir (`activeTab`);
  tüm sitelere erişim izni istemez.
- **Sürüm bilgisi ve GitHub**: Kutunun altında kurulu sürüm ve commit numarası gösterilir (örn.
  `v1.1.1 · 46d3c11`). GitHub'da daha yeni bir sürüm varsa yanına `Yeni sürüm: v1.2.0` yazar (tıklayınca sürüm
  sayfası açılır); yoksa başka bir şey yazmaz. GitHub'a ulaşılamazsa yalnızca kurulu sürüm görünür. Bunun için
  eklenti, en çok saatte bir, `api.github.com`'a herkese açık sürüm bilgisini sorar. Bu istekte sizin
  verilerinizden hiçbir şey gönderilmez; GitHub yalnızca isteğin geldiği IP adresini görür. Bunun dışında
  hiçbir şey eklentinin dışındaki bir sunucuya gönderilmez.

## Nasıl çalışır

Konsol sayfası, WMKS adlı bir konsol bileşeni kullanır. Eklenti bu bileşeni sayfada bulur ve metni,
seçilen klavye düzenine göre ham tuş kodlarına (scancode) çevirip doğrudan sanal makineye yollar. Tuş kodu
fiziksel tuşu temsil ettiği için hangi karakterin çıkacağını sanal makinenin kendi düzeni belirler; düzen
seçimi bu yüzden önemlidir.

Şifre üretici gönderimde kaydı arka planda (service worker) şifreleyip yazar; kutu arka plana yalnızca yeni
kaydı yollar, çözülmüş kaydı hiç almaz. Ana parola ve çözülmüş kayıtlar yalnızca eklentinin kendi sayfasında
bulunur, web sayfaları bunlara erişemez.

| Dosya | Görev |
| --- | --- |
| `manifest.json`, `background.js` | Eklenti tanımı; simgeye basılınca betikleri sekmeye ekler |
| `src/layouts.js` | Metin → tuş kodu çevirisi (Türkçe Q ve US tabloları) |
| `src/engine.js` | Konsolu bulur, tuş kodlarını zamanlayarak gönderir |
| `src/dialog.js` | KeyLord kutusu: Konsol / Şifre üretici sekmeleri ve ayarlar |
| `src/generator.js` | Şifre üretici (rastgele ve PIN, sembol kümeleri) |
| `src/fieldfill.js` | Sayfadaki şifre alanını seçer ve doldurur |
| `src/records.js` | Kayıt modeli ve birleştirme |
| `src/vault-crypto.js`, `src/vault-session.js` | Kasa şifrelemesi (ECDH P-256 + AES-GCM, PBKDF2) ve 15 dakikalık oturum |
| `src/store.js`, `src/backup.js` | Depolama (`storage.sync` / `storage.local`) ve yedek dosyası |
| `src/release.js` | Kurulu sürümün commit numarası ve GitHub'daki yeni sürüm kontrolü (1 saat önbellekli) |
| `vault.html`, `src/vault-page.js`, `src/vault-page.css` | Kasa sayfası |

## İzinler

| İzin | Neden |
| --- | --- |
| `activeTab` | Yalnızca simgesine bastığınız sekmeye erişmek ve o sekmenin ekran görüntüsünü almak |
| `scripting` | Kutuyu ve motoru o sekmeye eklemek |
| `storage` | Ayarları, şifreli kayıtları (`sync`) ve oturumu (`session`) saklamak |
| `unlimitedStorage` | Şifreli ekran görüntülerini yerelde saklamak |
| `identity`, `identity.email` | Kasayı Chrome'daki Google hesabının e-postasıyla etiketlemek |

Tüm sitelere erişim (host izni) istenmez.

## Eklenti kimliği ve `key.pem`

`manifest.json` içindeki `key` alanı eklentiye sabit bir kimlik verir: **`lnkkedffjgecpfahibmnlhimadopejcd`**.
Chrome kimliği bu açık anahtardan hesaplar; bu yüzden dosyaları GitHub'dan ya da zip'ten olduğu gibi indirip
"Paketlenmemiş öğe yükle" ile kuran **herkeste kimlik otomatik olarak aynıdır**.

Kimlik, **aynı kişinin kendi bilgisayarları** arasındaki eşitleme için önemlidir: eşitleme Google hesabına ve
eklenti kimliğine bağlıdır. Bir kişinin iki bilgisayarındaki KeyLord'un kimliği aynıysa kayıtları iki bilgisayar
arasında eşitlenir; farklıysa Chrome bunları iki ayrı eklenti sayar ve kayıtlar eşitlenmez. Farklı kişilerin
kayıtları ise kimlik ne olursa olsun birbirine karışmaz (bkz. [Eşitleme](#eşitleme)).

- **Eklentiyi kullananların `key.pem`'e ihtiyacı yoktur** ve bu dosya otomatik oluşmaz; gerekmez de. Normal
  kullanım için `manifest.json`'daki açık anahtar yeterlidir.
- **`key.pem`** bu kimliğin gizli anahtarıdır ve **yalnızca projenin sahibinde** durur. **Gizlidir, repoya
  girmez** (`.gitignore`'dadır). Yalnızca Chrome Web Mağazası'na yüklerken veya `.crx` paketlerken kimliği
  korumak için gerekir. **Güvenli bir yere yedekleyin** (parola yöneticisi, şifreli disk); kaybedilirse aynı
  kimlik yeniden üretilemez.
- **`tools/make_key.sh` yalnızca proje sahibi içindir; kullanıcılar çalıştırmamalıdır.** Yeni ve farklı bir
  anahtar çifti üretir; bu anahtar `manifest.json`'a yazılırsa o kurulumun kimliği değişir ve kişinin kendi
  bilgisayarları arasındaki eşitleme bozulur. `key.pem` zaten varsa **üzerine yazmaz**, hata verip durur.
- Kimlik değişirse eski kimliğin eşitlenmiş verisine yenisi erişemez; kurtarma yolu yedektir (aşağıda).

## Chrome Web Mağazası'na geçiş

Şu an dağıtım zip iledir. Mağazaya geçerken kimlik değişebilir; sırayla:

1. İlk yüklemede `key.pem`'i kullanarak kimliği korumayı deneyin (mağazanın ilk yüklemede bu anahtarı
   hâlâ kabul edip etmediğini yayın anında **doğrulayın**; bu README bunu doğrulanmış saymaz).
2. Kimlik korunduysa kullanıcıların kasası ve eşitlenmiş kayıtları olduğu gibi çalışır.
3. Kabul edilmezse ya da `key.pem` kaybolduysa: **eski sürümde Yedek al** → mağazadan yeni sürümü kurun →
   **yeni sürümde Yedekten yükle**. Kasa yokken Kasa sayfası "Yedekten yükle"yi öne çıkarır.
4. Kimlik bir kez değiştiğinde konsol ayarları sıfırlanır (kabul edilebilir).

## Geliştirme

Testler (Node.js gerekir):

```bash
node tests/run.js
```

Gerçek bir Konsol olmadan denemek için sahte konsol sayfası:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Ardından `http://localhost:8765/tests/mock-console.html` adresini açın. Sayfa, gelen tuş kodlarını seçtiğiniz
"sanal makine düzeni"ne göre ekrana yazar. Diğer deneme sayfaları:

- `tests/mock-form.html`: sahte şifre formları; alan doldurma kuralını denemek için.
- `tests/vault-harness.html`: Kasa sayfasını eklenti dışında denemek için.

Arkadaşlarınıza göndermek için yalnızca çalışma dosyalarını paketleyin (`tests/`, `docs/`, `tools/` ve
`key.pem` pakete girmez):

```bash
zip -r KeyLord.zip manifest.json background.js vault.html src icons README.md LICENSE -x '*.DS_Store'
```

Simgeleri yeniden üretmek için: `python3 tools/make_icons.py`

## Gizlilik politikası

Ayrıntılı gizlilik politikası: [PRIVACY.md](PRIVACY.md).

## Lisans

[MIT](LICENSE) © 2026 Gürkan Deveci
