# KeyLord Gizlilik Politikası / Privacy Policy

Son güncelleme / Last updated: 2026-11-21

## Türkçe

KeyLord, Chrome'da açılan sanal makine web konsollarına (ör. vCenter) metni tuş vuruşu olarak gönderen ve
isteğe bağlı olarak rastgele şifre üretip bunların şifreli bir geçmişini tutan bir Chrome eklentisidir.

**Toplanan ve işlenen veriler**

- **Konsola gönderdiğiniz metin**: Yalnızca o an seçtiğiniz sekmeye tuş vuruşu olarak gönderilir; hiçbir yere
  kaydedilmez.
- **Üretilen şifreler ve geçmişi**: Şifre, gönderildiği sayfanın adresi, girdiğiniz kullanıcı adı/not, tarih ve
  isteğe bağlı olarak o sayfanın ekran görüntüsü. Bunlar **yalnızca sizin belirlediğiniz ana parolayla
  çözülebilecek şekilde, cihazınızda şifrelenerek** saklanır. Ana parola hiçbir yerde saklanmaz.
- **Google hesabı e-posta adresi**: Kasayı hangi Chrome hesabında oluşturduğunuzu göstermek için kasaya etiket
  olarak yazılır.
- **Ayarlar**: Klavye düzeni, hız gibi tercihler.

**Veriler nereye gider**

- Şifreli kayıtlar Chrome'un `storage.sync` alanı üzerinden, Chrome eşitlemesi açıksa **yalnızca sizin Google
  hesabınıza** eşitlenir; Google bu kayıtları çözemez. Ekran görüntüleri yalnızca cihazınızda kalır.
- Eklenti, güncelleme olup olmadığını göstermek için en çok saatte bir `api.github.com` adresinden
  **herkese açık sürüm bilgisini** ister. Bu istekte sizin verilerinizden hiçbir şey gönderilmez; GitHub
  isteğin geldiği IP adresini görür.
- Bunların dışında hiçbir veri geliştiriciye veya üçüncü bir tarafa gönderilmez, satılmaz, paylaşılmaz, reklam
  veya kredi değerlendirmesi amacıyla kullanılmaz.

**Erişim**: Eklenti yalnızca araç çubuğu simgesine (veya kısayola) bastığınız sekmeye erişir; tüm sitelere
erişim izni yoktur.

**Silme**: Kasa sayfasından kayıtları tek tek silebilirsiniz. Eklentiyi kaldırmak, cihazdaki tüm verilerini siler;
eşitlenmiş veriler Chrome eşitleme verilerinizle birlikte Google hesabınızdan silinebilir.

**İletişim**: https://github.com/gurkandeveci/KeyLord/issues

## English

KeyLord is a Chrome extension that types text into virtual machine web consoles (e.g. vCenter) as keystrokes
and can optionally generate random passwords and keep an encrypted history of them.

**Data handled**

- **Text you send to a console** is typed into the tab you chose and is never stored.
- **Generated passwords and their history** (password, page address, the username/note you enter, date and,
  optionally, a screenshot of that page) are stored **encrypted on your device so that only your master
  password can decrypt them**. The master password is never stored.
- **Your Google account email** is stored as a label on the vault.
- **Settings** such as keyboard layout and speed.

**Where data goes**

- Encrypted records are synced through Chrome `storage.sync` **only to your own Google account** when Chrome
  sync is on; Google cannot decrypt them. Screenshots stay on your device.
- At most once an hour the extension requests **public release information** from `api.github.com` to show
  whether an update is available. None of your data is sent; GitHub sees the request's IP address.
- No other data is sent to the developer or any third party. Data is not sold, shared, or used for advertising
  or creditworthiness.

**Access**: The extension only accesses the tab where you click its toolbar icon (or press its shortcut).

**Deletion**: Delete records individually on the Vault page. Removing the extension deletes its local data;
synced data can be removed with your Chrome sync data in your Google account.

**Contact**: https://github.com/gurkandeveci/KeyLord/issues
