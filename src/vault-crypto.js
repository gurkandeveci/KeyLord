// Kasa şifrelemesi (ECIES). Kayıtlar kasanın açık anahtarıyla şifrelenir (yazmak için parola gerekmez);
// okumak için gizli anahtar ana parolayla açılır. Yalnızca globalThis.crypto.subtle kullanır;
// service worker'da da çalışır (window/document yok). crypto yoksa da yüklenir, çağrıda hata verir.
(function (g) {
  'use strict';
  if (g.KeyLordVaultCrypto) return; // çift yükleme koruması

  var DEFAULT_ITERATIONS = 600000; // PBKDF2-SHA256 tur sayısı
  var SALT_BYTES = 16;
  var IV_BYTES = 12;
  var CURVE = { name: 'ECDH', namedCurve: 'P-256' };
  var HKDF_INFO = 'keylord-record-v1';

  function subtle() {
    var c = g.crypto;
    if (!c || !c.subtle) throw new Error('WebCrypto (crypto.subtle) yok');
    return c.subtle;
  }

  function randomBytes(n) {
    var c = g.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('Güvenli rastgele sayı üreteci yok');
    }
    var b = new Uint8Array(n);
    c.getRandomValues(b);
    return b;
  }

  // --- base64 yardımcıları (btoa/atob; büyük dizilerde parça parça) ---
  function toB64(bytes) {
    bytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function fromB64(b64) {
    if (typeof b64 !== 'string') throw new Error('base64 metin değil');
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  function newVaultId() {
    var c = g.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var b = randomBytes(16);
    var hex = '';
    for (var i = 0; i < b.length; i++) hex += (b[i] < 16 ? '0' : '') + b[i].toString(16);
    return hex;
  }

  // Paroladan gizli anahtarı saran AES-GCM-256 anahtarı (PBKDF2-SHA256).
  async function passwordKey(password, salt, iterations) {
    if (typeof password !== 'string' || !password) throw new TypeError('parola gerekli');
    var base = await subtle().importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // ECDH ortak sırrından HKDF-SHA256 ile kayıt anahtarı (AES-GCM-256).
  async function recordKey(privateKey, publicKey) {
    var bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256);
    var ikm = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    return subtle().deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: utf8(HKDF_INFO) },
      ikm,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  function importPkcs8(bytes) {
    // Çıkarılabilir: exportPrivateKey için gerekli.
    return subtle().importKey('pkcs8', bytes, CURVE, true, ['deriveBits']);
  }

  async function createVault(password, options) {
    var o = options || {};
    var iterations = o.iterations === undefined ? DEFAULT_ITERATIONS : o.iterations;
    if (!(iterations > 0) || Math.floor(iterations) !== iterations) throw new RangeError('iterations geçersiz');
    var pair = await subtle().generateKey(CURVE, true, ['deriveBits']);
    var publicJwk = await subtle().exportKey('jwk', pair.publicKey);
    var pkcs8 = await subtle().exportKey('pkcs8', pair.privateKey);
    var salt = randomBytes(SALT_BYTES);
    var iv = randomBytes(IV_BYTES);
    var wrapKey = await passwordKey(password, salt, iterations);
    var ct = await subtle().encrypt({ name: 'AES-GCM', iv: iv }, wrapKey, pkcs8);
    var header = {
      v: 1,
      vaultId: newVaultId(),
      kdf: { salt: toB64(salt), iterations: iterations },
      publicKey: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y },
      wrappedPrivateKey: { iv: toB64(iv), ct: toB64(ct) },
      googleEmail: o.googleEmail || '',
      createdAt: o.now === undefined ? Date.now() : o.now
    };
    // Başlıktaki anahtarla aynı tutmak için gizli anahtar pkcs8'den yeniden alınır (çıkarılabilir).
    return { header: header, privateKey: await importPkcs8(pkcs8) };
  }

  async function unlockVault(header, password) {
    var kdf = header.kdf;
    var wrapKey = await passwordKey(password, fromB64(kdf.salt), kdf.iterations);
    var pkcs8;
    try {
      pkcs8 = await subtle().decrypt(
        { name: 'AES-GCM', iv: fromB64(header.wrappedPrivateKey.iv) },
        wrapKey,
        fromB64(header.wrappedPrivateKey.ct)
      );
    } catch (e) {
      throw new Error('wrong-password');
    }
    return importPkcs8(pkcs8);
  }

  async function encryptBytes(header, bytes) {
    if (!(bytes instanceof Uint8Array)) throw new TypeError('Uint8Array gerekli');
    var vaultPub = await subtle().importKey('jwk', header.publicKey, CURVE, false, []);
    var eph = await subtle().generateKey(CURVE, true, ['deriveBits']); // her zarf için yeni
    var key = await recordKey(eph.privateKey, vaultPub);
    var iv = randomBytes(IV_BYTES);
    var ct = await subtle().encrypt({ name: 'AES-GCM', iv: iv }, key, bytes);
    var epk = await subtle().exportKey('raw', eph.publicKey); // 65 bayt, sıkıştırılmamış
    return { v: 1, epk: toB64(epk), iv: toB64(iv), ct: toB64(ct) };
  }

  async function decryptBytes(privateKey, envelope) {
    try {
      var e = envelope;
      if (!e || e.v !== 1) throw new Error('zarf sürümü');
      var iv = fromB64(e.iv);
      if (iv.length !== IV_BYTES) throw new Error('IV boyu');
      var epk = await subtle().importKey('raw', fromB64(e.epk), CURVE, false, []);
      var key = await recordKey(privateKey, epk);
      var plain = await subtle().decrypt({ name: 'AES-GCM', iv: iv }, key, fromB64(e.ct));
      return new Uint8Array(plain);
    } catch (err) {
      throw new Error('bad-envelope');
    }
  }

  function encryptJson(header, obj) {
    return encryptBytes(header, utf8(JSON.stringify(obj)));
  }

  async function decryptJson(privateKey, envelope) {
    var bytes = await decryptBytes(privateKey, envelope);
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch (err) {
      throw new Error('bad-envelope');
    }
  }

  async function exportPrivateKey(key) {
    return toB64(await subtle().exportKey('pkcs8', key));
  }

  function importPrivateKey(b64) {
    return importPkcs8(fromB64(b64));
  }

  g.KeyLordVaultCrypto = {
    DEFAULT_ITERATIONS: DEFAULT_ITERATIONS,
    createVault: createVault,
    unlockVault: unlockVault,
    encryptJson: encryptJson,
    encryptBytes: encryptBytes,
    decryptJson: decryptJson,
    decryptBytes: decryptBytes,
    exportPrivateKey: exportPrivateKey,
    importPrivateKey: importPrivateKey
  };
})(globalThis);
