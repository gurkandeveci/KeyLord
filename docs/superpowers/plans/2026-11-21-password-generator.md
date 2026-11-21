# Şifre Üretici ve Şifreli Geçmiş – Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KeyLord kutusuna şifre üretici ekle; üretilen şifreyi konsola veya şifre alanına gönder, her gönderimi açık anahtarla şifreli, eşitlenen ve yedeklenebilen bir kasaya kaydet; geçmişi yalnızca eklentinin Kasa sayfasında ana parolayla göster.

**Architecture:** Saf modüller (`generator`, `vault-crypto`, `vault-session`, `records`, `store`, `backup`, `fieldfill`) Node testli. Kutu (hedef sayfada) kaydı `chrome.runtime.sendMessage` ile service worker'a yollar; service worker açık anahtarla (ECIES: ECDH P-256 + HKDF + AES-GCM) şifreleyip `storage.sync`/`storage.local`'a yazar ve ekran görüntüsü alır. Kilit açma ve okuma yalnızca `vault.html`'de.

**Tech Stack:** Manifest V3, düz JavaScript (bağımlılık yok), WebCrypto, `chrome.storage.{sync,local,session}`, `chrome.identity`, mevcut `tests/harness.js` (Node 26).

**Spec:** `docs/superpowers/specs/2026-11-21-password-generator-design.md`

## Global Constraints

- Arayüz metinleri ve kod yorumları Türkçe; kod stili mevcut dosyalardaki gibi (`'use strict'`, IIFE, `globalThis.KeyLordX = {...}`, çift yükleme koruması).
- Bağımlılık yok; `innerHTML`/`eval` yok; DOM `createElement` ile; kutu `attachShadow({ mode: 'closed' })`.
- İzinler tam olarak: `activeTab`, `scripting`, `storage`, `identity`, `identity.email`, `unlimitedStorage`. Host izni ve `alarms` yok.
- Şifre/ana parola hiçbir yerde düz metin saklanmaz, log'lanmaz, `postMessage`/`CustomEvent` ile sayfaya gitmez (konsol tuş kodları hariç – mevcut davranış).
- PBKDF2-SHA256 ≥ 600.000 tur (testlerde `iterations` parametresiyle düşürülür), tuz 16 bayt, AES-GCM-256, IV 12 bayt.
- Otomatik kilit 15 dk (`15 * 60 * 1000` ms).
- Üretici: rastgele 8–64 (varsayılan 20), PIN 4–12 (varsayılan 6); CLI-güvenli semboller tam olarak `!@%_-+=.,:`; tüm semboller ``!"#$%&'()*+,-./:;<=>?@[\]_{|}`` (`^ ~ `` ` `` yok); benzer karakterler `0Oo1lI` varsayılan hariç.
- Kasa kurulmadan şifre gönderilemez; kayıt yazılamazsa gönderim yapılmaz.
- `key.pem` repoya girmez.
- Testler: `node tests/run.js` hepsi geçmeli. WebCrypto gerektiren testler yalnızca `globalThis.crypto && crypto.subtle` varsa yüklenir (jsc'de atlanır).
- Commit'ler `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter; commit/push kullanıcı isteyince.

## Review Focus

1. Çok uzun URL/kullanıcı adı → şifreli kayıt 8 KB sync öğe sınırını aşar → kayıt `pending:` olarak yerelde kalmalı, kaybolmamalı (Task 5 testi).
2. Yanlış ana parola veya bozulmuş zarf → anlaşılır `wrong-password` / `bad-envelope` hatası, çökme yok (Task 2 testi).
3. Google hesabı olmayan Chrome profili (boş e-posta) → kasa yine kurulur, `no-google-account` uyarısı (Task 3 testi).
4. Sayfada yalnızca kullanıcı adı + dolu "mevcut şifre" alanı → hiçbir alana yazılmaz, hata (Task 7 testi).
5. Aynı yedeği iki kez yükleme → kayıt sayısı artmaz (Task 6 testi).

---

### Task 1: Şifre üretici

**Files:**
- Create: `src/generator.js`
- Test: `tests/generator.test.js`
- Modify: `tests/run.js` (generator ve testini yükle)

**Interfaces:**
- Produces: `KeyLordGenerator.generate(options, randomInt?) -> string`; `KeyLordGenerator.randomInt(max:number) -> number` (0 ≤ n < max, `crypto.getRandomValues` + reddetme örneklemesi); `KeyLordGenerator.DEFAULTS = { kind:'random', length:20, pinLength:6, digits:true, symbols:true, symbolSet:'cli', avoidAmbiguous:true }`; `KeyLordGenerator.SYMBOL_SETS = { cli, all }`.
- `options` alanları DEFAULTS ile birleştirilir; `kind:'pin'` yalnızca rakam, uzunluk `pinLength`.

- [ ] **Step 1: Failing testleri yaz** (`randomInt` olarak deterministik sayaç `i => (k++ * 7) % i` verilir)

```js
test('üretici: varsayılan 20 karakter', () => assertEqual(G.generate({}, seq()).length, 20));
test('üretici: uzunluk 8-64 arasına kıstırılır', () => {
  assertEqual(G.generate({ length: 3 }, seq()).length, 8);
  assertEqual(G.generate({ length: 500 }, seq()).length, 64);
});
test('üretici: PIN yalnızca rakam, 4-12', () => {
  assertTrue(/^\d{6}$/.test(G.generate({ kind: 'pin' }, seq())));
  assertEqual(G.generate({ kind: 'pin', pinLength: 1 }, seq()).length, 4);
});
test('üretici: seçili her gruptan en az bir karakter', () => { /* 200 kez: /[a-z]/,/[A-Z]/,/\d/, cli sembolü */ });
test('üretici: rakam/sembol kapalıysa hiç yok', () => { /* /^[A-Za-z]+$/ */ });
test('üretici: CLI kümesi tam olarak !@%_-+=.,:', () => assertEqual(G.SYMBOL_SETS.cli, '!@%_-+=.,:'));
test('üretici: tüm semboller ^ ~ ` içermez', () => assertTrue(!/[\^~`]/.test(G.SYMBOL_SETS.all)));
test('üretici: benzer karakterler varsayılan hariç', () => { /* 200 kez !/[0Oo1lI]/ */ });
test('üretici: her çıktı TR-Q ve US ile ölü tuşsuz yazılabilir', () => {
  // symbolSet 'all', 200 kez; planKeys(.., {layout, deadKeyFix:'off'}).unsupported boş
});
```
- [ ] **Step 2:** `node tests/run.js` → yeni testler FAIL (`KeyLordGenerator` tanımsız).
- [ ] **Step 3:** `src/generator.js` yaz. Her etkin gruptan bir karakter + kalanı birleşik kümeden, sonra Fisher–Yates karıştırma (karıştırma da `randomInt` ile).
- [ ] **Step 4:** `node tests/run.js` → hepsi PASS.
- [ ] **Step 5: Commit** – `feat: add password generator`

---

### Task 2: Kasa şifrelemesi (ECIES)

**Files:**
- Create: `src/vault-crypto.js`
- Test: `tests/vault-crypto.test.js` (yalnızca `crypto.subtle` varsa yüklenir)
- Modify: `tests/run.js`

**Interfaces:**
- Produces (`KeyLordVaultCrypto`, hepsi Promise):
  - `createVault(password, { iterations=600000, googleEmail='', now=Date.now() }) -> { header, privateKey }`
  - `header = { v:1, vaultId, kdf:{ salt, iterations }, publicKey:<JWK>, wrappedPrivateKey:{ iv, ct }, googleEmail, createdAt }` (ikili alanlar base64)
  - `unlockVault(header, password) -> CryptoKey` (ECDH gizli, çıkarılabilir); yanlışsa `Error('wrong-password')`
  - `encryptJson(header, obj) -> envelope`, `encryptBytes(header, Uint8Array) -> envelope`; `envelope = { v:1, epk, iv, ct }`
  - `decryptJson(privateKey, envelope) -> obj`, `decryptBytes(privateKey, envelope) -> Uint8Array`; bozuksa `Error('bad-envelope')`
  - `exportPrivateKey(key) -> base64 pkcs8`, `importPrivateKey(b64) -> CryptoKey`
- HKDF: SHA-256, salt 32 sıfır bayt, info `"keylord-record-v1"`. Gizli anahtar sarma: PBKDF2-SHA256 → AES-GCM-256, pkcs8 şifrelenir.

- [ ] **Step 1: Failing testler** (`iterations: 1000`)
  - `createVault` sonra `unlockVault` doğru parolayla anahtar döner; `encryptJson` → `decryptJson` aynı nesne.
  - Yanlış parola → reddedilir, mesaj `wrong-password`.
  - `encryptBytes`/`decryptBytes` 1 KB rastgele baytı korur.
  - Zarfın `ct`'sinde bir bayt değişirse → `bad-envelope`.
  - Aynı nesne iki kez şifrelenince `epk` ve `iv` farklı.
  - `header` JSON'unda parola metni geçmez; `kdf.iterations` varsayılanı 600000 (`createVault` çağrılmadan sabitten doğrula: `KeyLordVaultCrypto.DEFAULT_ITERATIONS === 600000`).
  - `exportPrivateKey` → `importPrivateKey` ile çözme çalışır.
- [ ] **Step 2:** testler FAIL.
- [ ] **Step 3:** `src/vault-crypto.js` (yalnızca `globalThis.crypto.subtle`; base64 yardımcıları dosya içinde; service worker'da da çalışmalı → `window`/`document` kullanma).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** – `feat: add public-key vault crypto`

---

### Task 3: Kasa oturumu ve uyarılar

**Files:**
- Create: `src/vault-session.js`
- Test: `tests/vault-session.test.js` (crypto gerekli)

**Interfaces:**
- Consumes: `KeyLordVaultCrypto.exportPrivateKey/importPrivateKey`.
- Produces (`KeyLordVaultSession`):
  - `TIMEOUT_MS = 900000`
  - `saveKey(area, privateKey, now) -> Promise` → `area.set({ vaultKey: { key, lastActivity: now } })`
  - `loadKey(area, now) -> Promise<CryptoKey|null>`; süre dolduysa kaydı siler, `null`; değilse `lastActivity = now` yazar
  - `lock(area) -> Promise`
  - `warnings(header, currentEmail) -> string[]`: `'no-google-account'` (e-posta boş), `'other-account'` (ikisi dolu ve farklı)
- `area`: `{ get(key), set(obj), remove(key) }` Promise döndüren nesne (testte sahte, gerçekte `chrome.storage.session`).

- [ ] **Step 1: Failing testler:** kaydet → 14 dk sonra yükle döner; 16 dk sonra `null` ve kayıt silinmiş; yükleme `lastActivity`'yi ileri alır; `lock` sonrası `null`; `warnings(h,'')` → `['no-google-account']`; `warnings({googleEmail:'a@x'}, 'b@x')` → `['other-account']`; aynıysa `[]`.
- [ ] **Step 2:** FAIL. **Step 3:** yaz. **Step 4:** PASS.
- [ ] **Step 5: Commit** – `feat: add vault session and account warnings`

---

### Task 4: Kayıt modeli

**Files:**
- Create: `src/records.js`
- Test: `tests/records.test.js`

**Interfaces:**
- Produces (`KeyLordRecords`, saf, değiştirmeden yeni nesne döner):
  - `newRecord({ url, host, username, password, method }, now, id) -> record`; `record = { id, createdAt, url, host, username, password, method, status:'pending', events:[{ at, method, status:'pending' }], hasScreenshot:false }`
  - `withEvent(record, { at, method, status }) -> record` (olay eklenir, `status` ve `method` güncellenir)
  - `runStatus({ sent, total, cancelled }) -> 'sent'|'partial'|'failed'` (`sent===total && !cancelled` → sent; `sent===0` → failed; diğer → partial)
  - `fillStatus(filledCount) -> 'sent'|'failed'`
  - `STATUS_LABELS = { pending:'Bekliyor', sent:'Gönderildi', partial:'Yarım', failed:'Başarısız', copied:'Kopyalandı' }`

- [ ] **Step 1: Failing testler:** `newRecord` alanları; `withEvent` orijinali değiştirmez, 2 olay; `runStatus` üç durum + `{sent:3,total:3,cancelled:true}` → partial; `fillStatus(0)` failed, `fillStatus(2)` sent.
- [ ] **Step 2–4:** FAIL → yaz → PASS. **Step 5: Commit** – `feat: add record model`

---

### Task 5: Depolama (sync + yerel bekleme)

**Files:**
- Create: `src/store.js`
- Test: `tests/store.test.js` (sahte alanlarla; crypto gerekmez)

**Interfaces:**
- Produces: `KeyLordStore.createStore({ sync, local }) ->`
  - `getHeader()/putHeader(header)` → sync `vault`
  - `putRecord(id, envelope) -> { synced:boolean }`: sync `rec:<id>` yazmayı dener; hata atarsa local `pending:<id>`; başarılıysa local `pending:<id>` silinir
  - `retryPending() -> number` (hâlâ bekleyen sayısı)
  - `listRecords() -> [{ id, envelope, synced }]` (aynı id'de `pending` önceliklidir)
  - `deleteRecord(id)` → `rec:`, `pending:`, `shot:` siler
  - `putShot(id, envelope)`, `getShot(id) -> envelope|null` → local `shot:<id>`
  - `syncUsage() -> { bytes, quota, ratio }` (`sync.getBytesInUse(null)`, `sync.QUOTA_BYTES || 102400`)
- Sahte alan: `get(null|key)`, `set`, `remove`, `getBytesInUse`; `set` öğe > 8192 bayt (JSON) ise reddeden sahte sync.

- [ ] **Step 1: Failing testler:** normal kayıt `synced:true`; 9 KB zarf → `synced:false`, `listRecords` onu `synced:false` döner (**Review Focus 1**); sync düzelince `retryPending()` → 0 ve kayıt sync'te; `deleteRecord` üç anahtarı da siler; `syncUsage().ratio` hesaplanır.
- [ ] **Step 2–4.** **Step 5: Commit** – `feat: add record store with pending fallback`

---

### Task 6: Yedek

**Files:**
- Create: `src/backup.js`
- Test: `tests/backup.test.js` (crypto gerekli)

**Interfaces:**
- Consumes: Task 2 fonksiyonları.
- Produces (`KeyLordBackup`):
  - `buildBackup(header, records:[{id, envelope}], shots:{[id]:envelope}) -> { format:'keylord-backup', v:1, vault, records, shots }`
  - `parseBackup(text) -> backup`; değilse `Error('not-a-backup')`
  - `restoreBackup({ backup, backupPassword, currentHeader, currentPrivateKey }) -> Promise<{ header, records, shots }>`:
    `currentHeader` yoksa yedeğin parolası doğrulanır ve yedek olduğu gibi döner; varsa her kayıt/görüntü çözülüp `currentHeader` ile yeniden şifrelenir, `header = currentHeader`. Yanlış yedek parolası → `wrong-password`.

- [ ] **Step 1: Failing testler:** boş cihaza yükleme yedeğin başlığını döner; farklı kasaya yükleme sonrası kayıtlar mevcut anahtarla çözülür, yedeğin anahtarıyla çözülmez; `parseBackup('{}')` → `not-a-backup`; aynı yedeği iki kez sahte store'a yazınca `listRecords().length` değişmez (**Review Focus 5**).
- [ ] **Step 2–4.** **Step 5: Commit** – `feat: add encrypted backup and restore`

---

### Task 7: Şifre alanı doldurma

**Files:**
- Create: `src/fieldfill.js`
- Create: `tests/mock-form.html` (kayıt formu, değiştirme formu: kullanıcı adı + dolu mevcut şifre + yeni + tekrar, React benzeri `input` dinleyicisi)
- Test: `tests/fieldfill.test.js`

**Interfaces:**
- Produces (`KeyLordFieldFill`):
  - `pickTargets(fields, focusedIndex) -> number[]`; `fields[i] = { isPassword, empty, visible, editable }`. Kural: odaklı alan uygun (şifre+boş+görünür+düzenlenebilir) ise `[o, ondan sonraki ilk uygun]` (varsa); değilse tüm uygunlar; yoksa `[]`.
  - `fillPassword(doc, focusedEl, password) -> number` (doldurulan sayısı; `HTMLInputElement.prototype` value setter'ı + `input` ve `change` olayları, `bubbles:true`).

- [ ] **Step 1: Failing testler (`pickTargets`):** odak yeni şifrede → [yeni, tekrar]; odak kullanıcı adında → tüm boş şifre alanları; yalnızca kullanıcı adı + dolu şifre → `[]` (**Review Focus 4**); gizli alan atlanır; `readonly` atlanır.
- [ ] **Step 2–4.**
- [ ] **Step 5:** `tests/mock-form.html`'i preview'da aç, konsoldan `KeyLordFieldFill.fillPassword(document, <yeni alan>, 'Ab1!xyzW')` → yeni ve tekrar dolu, mevcut şifre değişmemiş, `input` dinleyicisi tetiklenmiş.
- [ ] **Step 6: Commit** – `feat: add password field filler`

---

### Task 8: Manifest, kimlik anahtarı ve arka plan mesajları

**Files:**
- Create: `tools/make_key.sh` (openssl: `key.pem` üretir, DER açık anahtarı base64 basar)
- Modify: `manifest.json` (`key`, izinler, `version: 1.1.0`)
- Modify: `background.js` (`importScripts('src/vault-crypto.js','src/store.js')`, mesaj dinleyici)
- Modify: `.gitignore` (`key.pem`, `*.pem`)

**Interfaces:**
- Consumes: Task 2, Task 5.
- Produces (`chrome.runtime.sendMessage` → yanıt):
  - `{ type:'vault:exists' } -> { exists:boolean }`
  - `{ type:'record:put', id, record } -> { ok:true, synced } | { ok:false, error }` (başlık yoksa `error:'no-vault'`)
  - `{ type:'shot:capture', id } -> { ok:true } | { ok:false, error }` (`captureVisibleTab(sender.tab.windowId, { format:'jpeg', quality:70 })` → bayt → `encryptBytes` → `putShot`)
  - `{ type:'vault:open' }` → `chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') })`
- Dinleyici async yanıt için `return true`. Her `record:put`'tan sonra `retryPending()` çağrılır.

- [ ] **Step 1:** `tools/make_key.sh` çalıştır, `key.pem` oluşur; `git status`'ta görünmediğini doğrula.
- [ ] **Step 2:** manifest'e `key` ve izinler; `chrome://extensions`'ta yeniden yükleme sonrası kimliğin sabit olduğunu kullanıcıyla doğrula (iki farklı klasörden yükleyip aynı ID).
- [ ] **Step 3:** `background.js` mesajları; `node --check background.js`.
- [ ] **Step 4:** Uzantı yüklüyken servis çalışanı konsolunda `vault:exists` → `{exists:false}`.
- [ ] **Step 5: Commit** – `feat: fixed extension id, vault messaging in background`

---

### Task 9: Kasa sayfası

**Files:**
- Create: `vault.html`, `src/vault-page.js`, `src/vault-page.css`
- Modify: `tests/run.js` gerekmez (DOM)

**Interfaces:**
- Consumes: Task 2, 3, 4 (`STATUS_LABELS`), 5, 6; `chrome.identity.getProfileUserInfo({ accountStatus:'ANY' })`.
- Ekranlar (tek sayfa, durum makinesi `setup | unlock | main`):
  - **setup:** ana parola ×2 (≥ 12, eşleşmeli), "unutursan geri gelmez, yedek al" uyarısı, "Yedekten yükle" düğmesi öne çıkar; `createVault` → `putHeader` → `saveKey`.
  - **unlock:** parola → `unlockVault` → `saveKey`; yanlışsa "Ana parola yanlış".
  - **main:** uyarılar (`warnings`, sync oranı ≥ 0,8, bekleyen kayıt sayısı); arama (host, kullanıcı adı); liste (tarih, host, kullanıcı adı, durum; `failed` soluk); ayrıntı (şifre gizli + göster/kopyala, tam URL, olaylar, görüntü `URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}))`); Sil (confirm); Şimdi kilitle; Yedek al (`buildBackup` → `keylord-yedek-YYYY-MM-DD.json` indir); Yedekten yükle (dosya + yedek parolası → `restoreBackup` → store'a yaz).
- Her işlemden önce `loadKey`; `null` ise unlock ekranı.

- [ ] **Step 1:** sayfayı yaz; uzantı yüklüyken aç.
- [ ] **Step 2:** Doğrula: kurulum → kilit → yanlış parola mesajı → doğru parola → boş liste; servis çalışanı konsolundan sahte `record:put` → listede görünür, göster/kopyala çalışır; 15 dk kilit (`TIMEOUT_MS` geçici küçültülerek); yedek al → sil → yedekten yükle → kayıt geri.
- [ ] **Step 3: Commit** – `feat: add vault page`

---

### Task 10: Kutuda sol menü ve şifre üretici sekmesi

**Files:**
- Modify: `src/dialog.js`
- Modify: `background.js` (kutu dosyalarına `src/generator.js`, `src/records.js`, `src/fieldfill.js` ekle)
- Modify: `tests/mock-console.html` (yeni dosyaları yükle; `chrome.runtime.sendMessage` taklidi: bellek içi kayıt listesi)

**Interfaces:**
- Consumes: Task 1, 4, 7, 8 mesajları; mevcut `L.planKeys`, `command`/`start` akışı.
- Davranış:
  - Sol şerit: ⌨ Konsol (mevcut içerik), 🔑 Şifre, 🕘 Geçmiş (`vault:open` gönderir, sekme değiştirmez). Seçili sekme `settings.tab`; üretici ayarları `settings.gen` (DEFAULTS'tan).
  - Şifre sekmesi denetimleri (spec'teki taslak): tür (Rastgele | PIN), salt okunur şifre alanı (eş aralıklı yazı) + ↻, uzunluk kaydırıcı (değer etiketi), Rakam, Sembol, Semboller (CLI-güvenli | Tüm), Benzer karakterleri hariç tut, Kullanıcı adı / not, Gönder, Kopyala. Ayar değişince yeni şifre üretilir.
  - Kutu açılırken (`toggle`, focus almadan önce) `focusBeforeOpen = document.activeElement`.
  - Şifre sekmesi açılınca `vault:exists`; yoksa "Önce kasayı kurun" + "Kasayı kur" (`vault:open`), Gönder/Kopyala kapalı.
  - Gönder: `current.record` yoksa `newRecord` (uuid `crypto.randomUUID()`); `withEvent(pending)` → `record:put`; `ok:false` ise dur ("Kayıt yazılamadı; gönderilmedi"). Konsol hazırsa `start(planKeys(...).strokes)` ve `done/error` olayında `runStatus`; değilse `fillPassword(document, focusBeforeOpen, pw)` → `fillStatus`. Sonuç `withEvent` → `record:put`. `sent`/`partial` ise: host `display:none`, iki `requestAnimationFrame`, `shot:capture`, host geri; başarılıysa `hasScreenshot:true` → `record:put`.
  - Kopyala: `navigator.clipboard.writeText`, olay `copied`.
  - Yeniden üret: `current = null`.
  - Durum satırında şifre asla gösterilmez.

- [ ] **Step 1:** Uygula.
- [ ] **Step 2:** `tests/mock-console.html`'de doğrula: kasa yokken Gönder kapalı; taklitte kasa varken konsola gönder → ekranda şifre, taklit listede `sent` kayıt + görüntü isteği; Durdur ile yarıda → `partial`; konsol bağlı değilken alan yok → `failed`, hiçbir şey yazılmadı; aynı şifreyi kopyala + gönder → tek kayıt, 3 olay.
- [ ] **Step 3:** `tests/mock-form.html`'e kutu dosyaları yüklenerek alan doldurma akışı → yeni+tekrar dolu, kayıt `sent`.
- [ ] **Step 4:** `node tests/run.js` hepsi PASS.
- [ ] **Step 5: Commit** – `feat: password tab in KeyLord box`

---

### Task 11: Belgeler ve son doğrulama

**Files:**
- Modify: `README.md` (Şifre üretici, Kasa, eşitleme şartı, yedek, `key.pem`'i güvenli sakla, mağazaya geçiş adımları: `key.pem` ile ilk yükleme → olmazsa eski sürümde yedek al, yeni sürümde yükle; zip komutuna `vault.html`)

- [ ] **Step 1:** README'yi güncelle.
- [ ] **Step 2:** `node tests/run.js` PASS; zip'i yeniden üret; zip içinde `key.pem` olmadığını `unzip -l` ile doğrula.
- [ ] **Step 3:** Gerçek Chrome'da uçtan uca (kullanıcıyla): uzantıyı yükle → kasa kur → bir web formunda şifre üret/gönder → Kasa sayfasında kayıt + ekran görüntüsü.
- [ ] **Step 4: Commit** – `docs: password generator and vault`
