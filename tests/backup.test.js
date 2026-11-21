// Yedek testleri. Yalnızca WebCrypto (crypto.subtle) varsa yüklenir.
(function () {
  var B = globalThis.KeyLordBackup;
  var C = globalThis.KeyLordVaultCrypto;
  var S = globalThis.KeyLordStore;
  var UNLOCK = { minIterations: 1000 }; // düşük turlu test başlıkları için

  // Sahte chrome.storage alanı (Promise API), en az haliyle.
  function fakeArea() {
    var data = {};
    return {
      data: data,
      get: function (key) {
        var out = {};
        if (key === null || key === undefined) {
          for (var k in data) out[k] = data[k];
        } else if (Object.prototype.hasOwnProperty.call(data, key)) {
          out[key] = data[key];
        }
        return Promise.resolve(out);
      },
      set: function (obj) {
        for (var j in obj) data[j] = JSON.parse(JSON.stringify(obj[j]));
        return Promise.resolve();
      },
      remove: function (keys) {
        [].concat(keys).forEach(function (k) {
          delete data[k];
        });
        return Promise.resolve();
      },
      getBytesInUse: function () {
        var n = 0;
        for (var k in data) n += JSON.stringify(k).length + JSON.stringify(data[k]).length;
        return Promise.resolve(n);
      }
    };
  }

  async function expectReject(promise, message) {
    try {
      await promise;
    } catch (e) {
      assertEqual(e.message, message);
      return;
    }
    throw new Error('hata bekleniyordu: ' + message);
  }

  function expectThrow(fn, message) {
    try {
      fn();
    } catch (e) {
      assertEqual(e.message, message);
      return;
    }
    throw new Error('hata bekleniyordu: ' + message);
  }

  // Yedek kasası: iki kayıt, bir ekran görüntüsü. Metne çevirip geri okur (dosya gibi).
  async function makeBackup() {
    var v = await C.createVault('yedek-parola', { iterations: 1000 });
    var records = [
      { id: 'r1', envelope: await C.encryptJson(v.header, { site: 'a.com', n: 1 }) },
      { id: 'r2', envelope: await C.encryptJson(v.header, { site: 'b.com', n: 2 }) }
    ];
    var shots = { r1: await C.encryptBytes(v.header, new Uint8Array([1, 2, 3, 250])) };
    var text = JSON.stringify(B.buildBackup(v.header, records, shots));
    return { vault: v, backup: B.parseBackup(text) };
  }

  test('yedek: buildBackup biçimi', async function () {
    var v = await C.createVault('p', { iterations: 1000 });
    var b = B.buildBackup(v.header, [], {});
    assertEqual(b.format, 'keylord-backup');
    assertEqual(b.v, 1);
    assertEqual(b.vault.vaultId, v.header.vaultId);
    assertEqual(b.records, []);
    assertEqual(b.shots, {});
  });

  test('yedek: boş cihaza yükleme yedeğin başlığını ve kayıtlarını döner', async function () {
    var t = await makeBackup();
    var res = await B.restoreBackup({ backup: t.backup, backupPassword: 'yedek-parola', unlockOptions: UNLOCK });
    assertEqual(res.header.vaultId, t.vault.header.vaultId);
    assertEqual(res.records.length, 2);
    var key = await C.unlockVault(res.header, 'yedek-parola', UNLOCK);
    var rec = await C.decryptJson(key, res.records[1].envelope);
    assertEqual(rec, { site: 'b.com', n: 2 });
    assertEqual(Array.from(await C.decryptBytes(key, res.shots.r1)), [1, 2, 3, 250]);
    assertTrue(JSON.stringify(res).indexOf('yedek-parola') === -1, 'parola sonuçta olmamalı');
  });

  test('yedek: yanlış yedek parolası wrong-password', async function () {
    var t = await makeBackup();
    await expectReject(B.restoreBackup({ backup: t.backup, backupPassword: 'yanlis', unlockOptions: UNLOCK }), 'wrong-password');
    var cur = await C.createVault('mevcut', { iterations: 1000 });
    await expectReject(
      B.restoreBackup({ backup: t.backup, backupPassword: 'yanlis', currentHeader: cur.header, unlockOptions: UNLOCK }),
      'wrong-password'
    );
  });

  test('yedek: farklı kasaya yükleme mevcut anahtarla çözülür, yedeğinkiyle çözülmez', async function () {
    var t = await makeBackup();
    var cur = await C.createVault('mevcut', { iterations: 1000 });
    var res = await B.restoreBackup({
      backup: t.backup,
      backupPassword: 'yedek-parola',
      unlockOptions: UNLOCK,
      currentHeader: cur.header,
      currentPrivateKey: cur.privateKey
    });
    assertEqual(res.header.vaultId, cur.header.vaultId);
    assertEqual(res.records.map(function (r) { return r.id; }), ['r1', 'r2']);
    assertEqual(await C.decryptJson(cur.privateKey, res.records[0].envelope), { site: 'a.com', n: 1 });
    assertEqual(Array.from(await C.decryptBytes(cur.privateKey, res.shots.r1)), [1, 2, 3, 250]);
    await expectReject(C.decryptJson(t.vault.privateKey, res.records[0].envelope), 'bad-envelope');
    await expectReject(C.decryptBytes(t.vault.privateKey, res.shots.r1), 'bad-envelope');
    var json = JSON.stringify(res);
    assertTrue(json.indexOf('yedek-parola') === -1 && json.indexOf('a.com') === -1, 'düz metin olmamalı');
  });

  test('yedek: parseBackup geçersiz girdileri reddeder', function () {
    var ok = { format: 'keylord-backup', v: 1, vault: { v: 1 }, records: [], shots: {} };
    function mut(fn) {
      var o = JSON.parse(JSON.stringify(ok));
      fn(o);
      return JSON.stringify(o);
    }
    expectThrow(function () { B.parseBackup('{}'); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup('json değil'); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup('null'); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { o.format = 'x'; })); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { o.v = 2; })); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { delete o.vault; })); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { o.records = {}; })); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { o.shots = []; })); }, 'not-a-backup');
    expectThrow(function () { B.parseBackup(mut(function (o) { o.shots = null; })); }, 'not-a-backup');
    assertEqual(B.parseBackup(JSON.stringify(ok)).format, 'keylord-backup');
  });

  test('yedek: aynı yedeği iki kez yazmak kayıtları çoğaltmaz', async function () {
    var t = await makeBackup();
    var cur = await C.createVault('mevcut', { iterations: 1000 });
    var store = S.createStore({ sync: fakeArea(), local: fakeArea() });
    async function restoreInto() {
      var res = await B.restoreBackup({
        backup: t.backup,
        backupPassword: 'yedek-parola',
        unlockOptions: UNLOCK,
        currentHeader: cur.header
      });
      for (var i = 0; i < res.records.length; i++) await store.putRecord(res.records[i].id, res.records[i].envelope);
      for (var id in res.shots) await store.putShot(id, res.shots[id]);
    }
    await restoreInto();
    assertEqual((await store.listRecords()).length, 2);
    await restoreInto();
    assertEqual((await store.listRecords()).length, 2);
    var shot = await store.getShot('r1');
    assertEqual(Array.from(await C.decryptBytes(cur.privateKey, shot)), [1, 2, 3, 250]);
  });

  test('yedek: parseBackup kayıt ve görüntü girdilerini doğrular', function () {
    var env = { v: 1, epk: 'a', iv: 'b', ct: 'c' };
    function text(records, shots) {
      return JSON.stringify({ format: 'keylord-backup', v: 1, vault: { v: 1 }, records: records, shots: shots || {} });
    }
    function bad(records, shots, label) {
      try {
        B.parseBackup(typeof records === 'string' ? records : text(records, shots));
      } catch (e) {
        assertEqual(e.message, 'not-a-backup', label);
        return;
      }
      throw new Error('reddedilmeliydi: ' + label);
    }
    bad([null], {}, 'null kayıt');
    bad([{ envelope: env }], {}, 'id yok');
    bad([{ id: '', envelope: env }], {}, 'boş id');
    bad([{ id: 5, envelope: env }], {}, 'sayı id');
    bad([{ id: 'r1' }], {}, 'zarf yok');
    bad([{ id: 'r1', envelope: 'x' }], {}, 'zarf metin');
    bad([{ id: 'r1', envelope: [1] }], {}, 'zarf dizi');
    bad([{ id: '__proto__', envelope: env }], {}, '__proto__ kayıt');
    bad([{ id: 'constructor', envelope: env }], {}, 'constructor kayıt');
    bad([{ id: 'prototype', envelope: env }], {}, 'prototype kayıt');
    bad([], { r1: 'x' }, 'görüntü metin');
    bad([], { r1: null }, 'görüntü null');
    bad(
      '{"format":"keylord-backup","v":1,"vault":{"v":1},"records":[],"shots":{"__proto__":{"v":1}}}',
      null,
      '__proto__ görüntü'
    );
    bad([], { constructor: env }, 'constructor görüntü');
    bad([], { '': env }, 'boş görüntü anahtarı');
    var ok = B.parseBackup(text([{ id: 'r1', envelope: env }], { r1: env }));
    assertEqual(ok.records.length, 1);
    assertEqual(Object.getPrototypeOf(ok.shots), null, 'görüntü haritası prototipsiz');
    assertEqual(ok.shots.r1, env);
  });

  test('yedek: reencrypt eski anahtarla çözüp yeni başlığa şifreler', async function () {
    var oldV = await C.createVault('eski', { iterations: 1000 });
    var newV = await C.createVault('yeni', { iterations: 1000 });
    var records = [
      { id: 'a', envelope: await C.encryptJson(oldV.header, { site: 'a.com' }) },
      { id: 'b', envelope: await C.encryptJson(oldV.header, { site: 'b.com' }) }
    ];
    var shots = { a: await C.encryptBytes(oldV.header, new Uint8Array([9, 8, 7])) };
    var res = await B.reencrypt(oldV.privateKey, newV.header, records, shots);
    assertEqual(res.records.map(function (r) { return r.id; }), ['a', 'b']);
    assertEqual(res.records[0].envelope.vid, newV.header.vaultId, 'yeni vid');
    assertEqual(await C.decryptJson(newV.privateKey, res.records[1].envelope), { site: 'b.com' });
    assertEqual(Array.from(await C.decryptBytes(newV.privateKey, res.shots.a)), [9, 8, 7]);
    await expectReject(C.decryptJson(oldV.privateKey, res.records[0].envelope), 'bad-envelope');
    var json = JSON.stringify(res);
    assertTrue(json.indexOf('a.com') === -1, 'düz metin olmamalı');
    // Yanlış anahtar: hiçbir şey dönmez, bad-envelope.
    await expectReject(B.reencrypt(newV.privateKey, newV.header, records, {}), 'bad-envelope');
    // Boş girdi.
    var empty = await B.reencrypt(oldV.privateKey, newV.header, [], null);
    assertEqual(empty.records, []);
  });

  test('yedek: başlığı değiştirilmiş yedek bad-header', async function () {
    var t = await makeBackup();
    var other = await C.createVault('x', { iterations: 1000 });
    var forged = JSON.parse(JSON.stringify(t.backup));
    forged.vault.publicKey = JSON.parse(JSON.stringify(other.header.publicKey));
    await expectReject(
      B.restoreBackup({ backup: forged, backupPassword: 'yedek-parola', unlockOptions: UNLOCK }),
      'bad-header'
    );
    // Varsayılan tur alt sınırıyla 1000 turlu yedek reddedilir.
    await expectReject(B.restoreBackup({ backup: t.backup, backupPassword: 'yedek-parola' }), 'bad-header');
  });
})();
