// Şifreli yedek: kasa başlığı + zaten şifreli kayıtlar ve ekran görüntüleri tek bir JSON dosyasında.
// Geri yüklemede ya yedeğin kasası olduğu gibi benimsenir ya da kayıtlar mevcut kasaya yeniden şifrelenir.
// Hiçbir store'a yazmaz (çağıran yazar). Parola ve düz metin sonuçlara/hatalara girmez.
// Yüklenirken crypto gerekmez; yalnızca restoreBackup çağrısında gerekir.
(function (g) {
  'use strict';
  if (g.KeyLordBackup) return; // çift yükleme koruması

  var FORMAT = 'keylord-backup';
  var VERSION = 1;

  function isObject(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  // Nesne anahtarı olarak tehlikeli kimlikler (prototip kirlenmesi).
  var FORBIDDEN_IDS = ['__proto__', 'constructor', 'prototype'];

  function validId(id) {
    return typeof id === 'string' && id.length > 0 && FORBIDDEN_IDS.indexOf(id) === -1;
  }

  function own(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }

  // Yedek nesnesinin biçimini doğrular; uymazsa 'not-a-backup' fırlatır.
  function check(b) {
    if (
      !isObject(b) ||
      b.format !== FORMAT ||
      b.v !== VERSION ||
      !isObject(b.vault) ||
      !Array.isArray(b.records) ||
      !isObject(b.shots)
    ) {
      throw new Error('not-a-backup');
    }
    for (var i = 0; i < b.records.length; i++) {
      var r = b.records[i];
      if (!isObject(r) || !validId(r.id) || !isObject(r.envelope)) throw new Error('not-a-backup');
    }
    var keys = Object.keys(b.shots);
    for (var j = 0; j < keys.length; j++) {
      if (!validId(keys[j]) || !isObject(b.shots[keys[j]])) throw new Error('not-a-backup');
    }
    return b;
  }

  function copyRecords(records) {
    return records.map(function (r) {
      return { id: r.id, envelope: r.envelope };
    });
  }

  // Prototipsiz harita: kimlikler nesne yöntemleriyle çakışmaz.
  function copyShots(shots) {
    var out = Object.create(null);
    for (var id in shots) {
      if (own(shots, id)) out[id] = shots[id];
    }
    return out;
  }

  function buildBackup(header, records, shots) {
    return {
      format: FORMAT,
      v: VERSION,
      vault: header,
      records: copyRecords(records || []),
      shots: copyShots(shots || {})
    };
  }

  function parseBackup(text) {
    var b;
    try {
      b = JSON.parse(text);
    } catch (e) {
      throw new Error('not-a-backup');
    }
    check(b);
    b.shots = copyShots(b.shots);
    return b;
  }

  // Zarfları fromKey ile çözüp toHeader'ın açık anahtarıyla yeniden şifreler.
  // records: [{ id, envelope }], shots: { id: zarf }. Biri çözülemezse 'bad-envelope' (hepsi ya da hiçbiri).
  async function reencrypt(fromKey, toHeader, records, shots) {
    var C = g.KeyLordVaultCrypto;
    var list = records || [];
    var outRecords = [];
    for (var i = 0; i < list.length; i++) {
      var obj = await C.decryptJson(fromKey, list[i].envelope); // bozuksa 'bad-envelope'
      outRecords.push({ id: list[i].id, envelope: await C.encryptJson(toHeader, obj) });
    }
    var outShots = Object.create(null);
    var src = shots || {};
    for (var id in src) {
      if (!own(src, id)) continue;
      var bytes = await C.decryptBytes(fromKey, src[id]);
      outShots[id] = await C.encryptBytes(toHeader, bytes);
    }
    return { records: outRecords, shots: outShots };
  }

  // currentHeader yoksa: yedeğin parolası doğrulanır, yedek olduğu gibi döner.
  // Varsa: her kayıt/görüntü yedeğin anahtarıyla çözülüp currentHeader'ın açık anahtarıyla yeniden şifrelenir.
  // currentPrivateKey açık anahtarla yazma için gerekmez; imzada uyumluluk için durur.
  // unlockOptions: unlockVault seçenekleri (yalnızca testler tur alt sınırını düşürür).
  // Başlık bozuk/değiştirilmişse 'bad-header', parola yanlışsa 'wrong-password'.
  async function restoreBackup(opts) {
    var o = opts || {};
    var backup = check(o.backup);
    var C = g.KeyLordVaultCrypto;
    var backupKey = await C.unlockVault(backup.vault, o.backupPassword, o.unlockOptions);

    if (!o.currentHeader) {
      return { header: backup.vault, records: copyRecords(backup.records), shots: copyShots(backup.shots) };
    }

    var target = C.validateHeader(o.currentHeader, o.unlockOptions);
    var res = await reencrypt(backupKey, target, backup.records, backup.shots);
    return { header: target, records: res.records, shots: res.shots };
  }

  g.KeyLordBackup = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    buildBackup: buildBackup,
    parseBackup: parseBackup,
    restoreBackup: restoreBackup,
    reencrypt: reencrypt
  };
})(globalThis);
