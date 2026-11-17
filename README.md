# KeyLord – Send Keys to Console

Chrome'da açılan vCenter sanal makine web konsoluna, "KeyLord" kutusuna yazdığınız metni tek tek
tuş vuruşu olarak ileten Chrome eklentisi. Web konsolunda yapıştırma çalışmadığı için uzun komutları ve
karmaşık parolaları elle yazma derdini ortadan kaldırır. Windows ve macOS'ta Chrome ile çalışır.

## Kurulum

1. Bu klasörü bilgisayarınıza kopyalayın (zip olarak aldıysanız bir klasöre açın).
2. Chrome'da `chrome://extensions` adresini açın.
3. Sağ üstteki **Geliştirici modu** anahtarını açın.
4. **Paketlenmemiş öğe yükle**'ye basıp bu klasörü (içinde `manifest.json` olan) seçin.
5. Araç çubuğundaki yapboz simgesinden **KeyLord**'i sabitleyin.

Kısayol varsayılan olarak **Alt+Shift+K**'dır (macOS'ta Option+Shift+K). Çalışmıyorsa veya değiştirmek
isterseniz `chrome://extensions/shortcuts` sayfasından atayın.

## Kullanım

1. vCenter'da sanal makinenin **web konsolunu** açın ve bağlanmasını bekleyin.
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

## Bilmeniz gerekenler

- **Caps Lock**: Sanal makinede Caps Lock açıksa harfler ters büyüklükte çıkar; eklenti bunu göremez.
- **Sekmeyi önde tutun**: Gönderim sürerken başka sekmeye geçerseniz Chrome zamanlayıcıları yavaşlatır,
  gönderim saniyede bir tuşa kadar düşebilir.
- **Parolayı önce görünür bir yerde deneyin**: İlk kullanımda ayarların doğru olduğunu, metni kullanıcı adı
  alanı ya da bir metin düzenleyici gibi görünen bir yere göndererek doğrulayın. Yanlış düzenle gönderilen
  parola hesabı kilitleyebilir.
- **Gizlilik**: Yazdığınız metin hiçbir yere kaydedilmez ve hiçbir yere gönderilmez; yalnızca ayarlar
  Chrome'un yerel deposunda tutulur. Eklenti yalnızca simgesine bastığınız sekmeye erişir (`activeTab`).

## Nasıl çalışır

vCenter web konsolu VMware'in WMKS bileşenini kullanır. Eklenti bu bileşeni sayfada bulur ve metni,
seçilen klavye düzenine göre ham tuş kodlarına (scancode) çevirip doğrudan sanal makineye yollar. Tuş kodu
fiziksel tuşu temsil ettiği için hangi karakterin çıkacağını sanal makinenin kendi düzeni belirler; düzen
seçimi bu yüzden önemlidir.

| Dosya | Görev |
| --- | --- |
| `manifest.json`, `background.js` | Eklenti tanımı; simgeye basılınca betikleri sekmeye ekler |
| `src/layouts.js` | Metin → tuş kodu çevirisi (Türkçe Q ve US tabloları) |
| `src/engine.js` | Konsolu bulur, tuş kodlarını zamanlayarak gönderir |
| `src/dialog.js` | KeyLord kutusu ve ayarlar |

## Geliştirme

Testler (Node.js gerekir):

```bash
node tests/run.js
```

Gerçek vCenter olmadan denemek için sahte konsol sayfası:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Ardından `http://localhost:8765/tests/mock-console.html` adresini açın. Sayfa, gelen tuş kodlarını seçtiğiniz
"sanal makine düzeni"ne göre ekrana yazar.

Arkadaşlarınıza göndermek için yalnızca çalışma dosyalarını paketleyin:

```bash
zip -r KeyLord.zip manifest.json background.js src icons README.md
```

Simgeleri yeniden üretmek için: `python3 tools/make_icons.py`
