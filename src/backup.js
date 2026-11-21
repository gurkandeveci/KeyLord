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
    return b;
  }

  function copyRecords(records) {
    return records.map(function (r) {
      return { id: r.id, envelope: r.envelope };
    });
  }

  function copyShots(shots) {
    var out = {};
    for (var id in shots) {
      if (Object.prototype.hasOwnProperty.call(shots, id)) out[id] = shots[id];
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
    return check(b);
  }

  // currentHeader yoksa: yedeğin parolası doğrulanır, yedek olduğu gibi döner.
  // Varsa: her kayıt/görüntü yedeğin anahtarıyla çözülüp currentHeader'ın açık anahtarıyla yeniden şifrelenir.
  // currentPrivateKey açık anahtarla yazma için gerekmez; imzada uyumluluk için durur.
  async function restoreBackup(opts) {
    var o = opts || {};
    var backup = check(o.backup);
    var C = g.KeyLordVaultCrypto;
    var backupKey = await C.unlockVault(backup.vault, o.backupPassword); // yanlışsa 'wrong-password'

    if (!o.currentHeader) {
      return { header: backup.vault, records: copyRecords(backup.records), shots: copyShots(backup.shots) };
    }

    var target = o.currentHeader;
    var records = [];
    for (var i = 0; i < backup.records.length; i++) {
      var r = backup.records[i];
      var obj = await C.decryptJson(backupKey, r.envelope); // bozuksa 'bad-envelope'
      records.push({ id: r.id, envelope: await C.encryptJson(target, obj) });
    }
    var shots = {};
    for (var id in backup.shots) {
      if (!Object.prototype.hasOwnProperty.call(backup.shots, id)) continue;
      var bytes = await C.decryptBytes(backupKey, backup.shots[id]);
      shots[id] = await C.encryptBytes(target, bytes);
    }
    return { header: target, records: records, shots: shots };
  }

  g.KeyLordBackup = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    buildBackup: buildBackup,
    parseBackup: parseBackup,
    restoreBackup: restoreBackup
  };
})(globalThis);
