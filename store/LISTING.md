# Chrome Web Mağazası – yükleme rehberi ve metinler

Bu dosya, KeyLord'u Chrome Web Mağazası'nda **liste dışı (Unlisted)** yayınlamak için gereken her şeyi içerir.
Dashboard'daki alanlara metinleri olduğu gibi kopyalayabilirsiniz.

## 0. Hazırlık (bir kez)

1. https://chrome.google.com/webstore/devconsole adresinde geliştirici hesabı açın (bir kerelik 5 USD kayıt
   ücreti). Yayıncı adı olarak görünmesini istediğiniz adı girin.
2. Hesap e-postasını doğrulayın. İsterseniz "Trader / Non-trader" beyanında **Non-trader** seçin (ücretsiz,
   ticari olmayan yayın).

## 1. Paketi hazırla

```bash
tools/build_store_zip.sh --with-key
```

Bu komut `KeyLord-store.zip` oluşturur:

- `manifest.json`'daki `key` alanını **çıkarır** (mağaza ilk yüklemede bu alanı kabul etmiyor).
- `--with-key` ile `key.pem` dosyasını paketin köküne koyar. Bu, mevcut eklenti kimliğini
  (`lnkkedffjgecpfahibmnlhimadopejcd`) mağazada korumayı **denemek** içindir. Bu yöntem eskiden
  belgelenmişti; bugün hâlâ çalıştığı **doğrulanmadı**. Bu durumda gizli anahtarı Google'a yüklemiş olursunuz
  (mağaza eklentiyi zaten bu anahtarla imzalar).
- `tests/`, `docs/`, `tools/`, `store/` pakete girmez.

## 2. Yeni öğe olarak yükle

1. Dashboard → **Yeni öğe ekle** → `KeyLord-store.zip`'i seçin.
2. Yükleme bitince **Paket** sekmesinde **Öğe kimliği**'ne bakın:
   - `lnkkedffjgecpfahibmnlhimadopejcd` ise: kimlik korundu. Herkesin kasası ve eşitlenmiş kayıtları aynen
     kalır.
   - Farklıysa: bkz. **Bölüm 7 – Kimlik değiştiyse**.

## 3. Mağaza girişi (Store listing)

**Dil:** Türkçe

**Ad:** (manifest'ten gelir) KeyLord – Send Keys to Console

**Kısa açıklama** (manifest'ten gelir, en çok 132 karakter):

> Konsol ekranındaki sanal makineye, yazdığınız metni tuş vuruşu olarak gönderir. Türkçe Q ve US klavye düzenlerini destekler.

**Ayrıntılı açıklama:**

```
KeyLord, Chrome'da açtığınız sanal makine web konsollarına (Konsol) yazdığınız
metni tek tek tuş vuruşu olarak gönderir. Kopyala-yapıştır çalışmayan konsollarda uzun komutları ve
parolaları elle yazmak zorunda kalmazsınız.

Ne yapar
• Konsol: Kutuya yazdığınız metni Linux, Windows oturum açma ekranı, FortiGate, Sophos gibi hedeflere
  gönderir. Klavye düzeni (Türkçe Q / US), ölü tuş düzeltmesi ve hız ayarlanabilir. Tab, Enter, Esc ve
  Ctrl+Alt+Del tek tuşla gönderilebilir.
• Şifre üretici: Rastgele şifre veya PIN üretir; komut satırında sorun çıkarmayan semboller varsayılandır.
  Şifre konsola tuş vuruşuyla ya da sayfadaki boş şifre alanlarına gönderilir.
• Şifreli geçmiş (Kasa): Gönderdiğiniz her üretilmiş şifre, gönderimden önce kaydedilir: sayfa adresi,
  kullanıcı adı/not, tarih ve isteğe bağlı ekran görüntüsüyle. Kayıtlar yalnızca sizin ana parolanızla
  açılabilecek şekilde şifrelenir; ana parola yalnızca eklentinin kendi sayfasında girilir. Şifreli yedek
  alıp geri yükleyebilirsiniz.

Gizlilik
• Eklenti yalnızca simgesine bastığınız sekmeye erişir; tüm sitelere erişim izni istemez.
• Kayıtlar Chrome eşitlemesiyle yalnızca kendi Google hesabınıza şifreli olarak eşitlenir.
• Güncelleme bilgisi için GitHub'dan yalnızca herkese açık sürüm bilgisi istenir.

Kullanım: Konsol sekmesinde araç çubuğundaki KeyLord simgesine (veya Alt+Shift+K) basın, metni yazın,
Gönder'e basın.

Kaynak kod ve belgeler: https://github.com/gurkandeveci/KeyLord
```

**Kategori:** Araçlar (Tools) – yoksa Geliştirici Araçları (Developer Tools)

**Görseller** (`store/assets/`; yeniden üretmek için `tools/make_store_assets.sh`):

| Alan | Dosya | Boyut |
| --- | --- | --- |
| Mağaza simgesi | `icons/icon128.png` | 128×128 |
| Ekran görüntüleri | `store/assets/screenshot-1-console.png`, `screenshot-2-password.png`, `screenshot-3-vault.png` | 1280×800 |
| Küçük tanıtım kutucuğu | `store/assets/promo-small-440x280.png` | 440×280 |

**Ana sayfa URL'si:** https://github.com/gurkandeveci/KeyLord
**Destek URL'si:** https://github.com/gurkandeveci/KeyLord/issues

## 4. Gizlilik uygulamaları (Privacy practices)

**Tek amaç (Single purpose):**

```
Sanal makine web konsollarına (Konsol) metni ve parolaları tuş vuruşu olarak göndermek; bu amaçla
üretilen parolaları, unutulmasınlar diye, kullanıcının ana parolasıyla şifrelenmiş bir geçmişte saklamak.
```

**İzin gerekçeleri:**

| İzin | Gerekçe |
| --- | --- |
| `activeTab` | Kullanıcı simgeye bastığında yalnızca o sekmeye KeyLord kutusunu eklemek ve gönderim sonrası o sekmenin ekran görüntüsünü (kullanıcının şifreli geçmişi için) almak. |
| `scripting` | KeyLord kutusunu ve konsola tuş gönderen betiği, kullanıcının seçtiği sekmeye eklemek. |
| `storage` | Kullanıcı ayarlarını, şifreli parola geçmişini (sync) ve kasanın kilit oturumunu (session) saklamak. |
| `unlimitedStorage` | Kullanıcının isteğe bağlı, şifreli ekran görüntülerini cihazda saklamak (varsayılan kota yetmez). |
| `identity` / `identity.email` | Kasayı oluşturulduğu Chrome hesabının e-postasıyla etiketlemek ve farklı bir hesapta açıldığında kullanıcıyı uyarmak. E-posta hiçbir yere gönderilmez. |

**Uzaktan kod (Remote code):** Hayır, uzaktan kod kullanılmıyor. (Yalnızca GitHub API'sinden JSON biçiminde
sürüm bilgisi okunuyor; bu kod değildir.)

**Veri kullanımı – toplanan veri türleri** (işaretleyin):

- [x] Kişisel tanımlayıcı bilgiler (Personally identifiable information) – Google hesabı e-postası (yalnızca kasada etiket)
- [x] Kimlik doğrulama bilgileri (Authentication information) – üretilen parolalar (şifreli, yalnızca kullanıcının hesabında)
- [x] Web sitesi içeriği (Website content) – isteğe bağlı ekran görüntüsü ve sayfa adresi (şifreli, yalnızca cihazda/kullanıcının hesabında)
- [ ] Diğerleri işaretlenmez.

**Sertifikalar** (üçünü de işaretleyin):

- [x] Kullanıcı verilerini onaylanan kullanım durumları dışında üçüncü taraflara satmıyorum/aktarmıyorum.
- [x] Kullanıcı verilerini öğenin tek amacıyla ilgisiz amaçlarla kullanmıyorum/aktarmıyorum.
- [x] Kullanıcı verilerini kredi değerliliğini belirlemek veya borç verme amacıyla kullanmıyorum/aktarmıyorum.

**Gizlilik politikası URL'si:** https://github.com/gurkandeveci/KeyLord/blob/main/PRIVACY.md

## 5. Dağıtım (Distribution)

- **Görünürlük:** **Liste dışı (Unlisted)** – mağazada aranınca çıkmaz, yalnızca bağlantıyı bilenler kurar.
- **Bölgeler:** Tüm bölgeler (veya yalnızca Türkiye).
- **Ödeme:** Ücretsiz.

Gönder → incelemeye girer (genelde birkaç gün). Onaylanınca öğenin bağlantısını arkadaşlarınıza verin.

## 6. Sonraki sürümler

1. `manifest.json`'da `version`'ı artırın, `tools/build_store_zip.sh` ile (key.pem **olmadan**) paketleyin.
2. Dashboard → öğe → **Paket** → **Yeni paket yükle** → **İncelemeye gönder**.
3. Onaylanınca Chrome kullanıcıların eklentisini **kendiliğinden günceller**.

## 7. Kimlik değiştiyse

Mağaza farklı bir öğe kimliği verdiyse:

1. Dashboard → **Paket** → **Genel anahtarı görüntüle** → BEGIN/END satırları arasını tek satır olarak
   kopyalayın ve `manifest.json`'daki `key` alanına yazın. Böylece zip ile kuranlar da mağaza kimliğini
   kullanır.
2. Eski kimlikle kurulmuş kullanıcılar **bir kez** şunu yapmalı: eski KeyLord'da Kasa → **Yedek al**,
   mağazadan yeni KeyLord'u kurun, Kasa → **Yedekten yükle**, sonra eski KeyLord'u kaldırın.
3. README'deki kimlik satırını yeni kimlikle güncelleyin.
