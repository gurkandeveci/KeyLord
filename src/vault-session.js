// Kasa oturumu: açılmış gizli anahtar, etkinlik süresince (15 dk) chrome.storage.session'da tutulur.
// `area` Promise döndüren { get(key), set(obj), remove(key) } nesnesidir (gerçekte chrome.storage.session).
// Ayrıca Google hesabı uyarılarını hesaplar. Yüklenirken crypto gerekmez; yalnızca çağrıda gerekir.
(function (g) {
  'use strict';
  if (g.KeyLordVaultSession) return; // çift yükleme koruması

  var TIMEOUT_MS = 15 * 60 * 1000; // otomatik kilit süresi
  var STORAGE_KEY = 'vaultKey';

  // Gizli anahtarı dışa aktarıp oturum alanına yazar.
  async function saveKey(area, privateKey, now) {
    var key = await g.KeyLordVaultCrypto.exportPrivateKey(privateKey);
    var obj = {};
    obj[STORAGE_KEY] = { key: key, lastActivity: now };
    await area.set(obj);
  }

  // Süre dolmadıysa anahtarı döndürür ve etkinlik zamanını ileri alır; aksi halde kaydı silip null verir.
  async function loadKey(area, now) {
    var res = await area.get(STORAGE_KEY);
    var entry = res && res[STORAGE_KEY];
    if (entry === undefined) return null;
    var valid =
      entry &&
      typeof entry.key === 'string' &&
      typeof entry.lastActivity === 'number' &&
      isFinite(entry.lastActivity);
    if (!valid || now - entry.lastActivity > TIMEOUT_MS) {
      await area.remove(STORAGE_KEY);
      return null;
    }
    var privateKey;
    try {
      privateKey = await g.KeyLordVaultCrypto.importPrivateKey(entry.key);
    } catch (e) {
      await area.remove(STORAGE_KEY);
      return null;
    }
    var obj = {};
    obj[STORAGE_KEY] = { key: entry.key, lastActivity: now };
    await area.set(obj);
    return privateKey;
  }

  // Kasayı kilitler: oturumdaki anahtarı siler.
  async function lock(area) {
    await area.remove(STORAGE_KEY);
  }

  // Kasa e-postası ile mevcut Chrome hesabını karşılaştırır.
  function warnings(header, currentEmail) {
    var out = [];
    var saved = (header && header.googleEmail) || '';
    var current = currentEmail || '';
    if (!current) out.push('no-google-account');
    else if (saved && saved !== current) out.push('other-account');
    return out;
  }

  g.KeyLordVaultSession = {
    TIMEOUT_MS: TIMEOUT_MS,
    saveKey: saveKey,
    loadKey: loadKey,
    lock: lock,
    warnings: warnings
  };
})(globalThis);
