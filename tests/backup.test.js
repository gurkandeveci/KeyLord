// Yedek testleri. Yalnızca WebCrypto (crypto.subtle) varsa yüklenir.
(function () {
  var B = globalThis.KeyLordBackup;
  var C = globalThis.KeyLordVaultCrypto;
  var S = globalThis.KeyLordStore;

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
    var res = await B.restoreBackup({ backup: t.backup, backupPassword: 'yedek-parola' });
    assertEqual(res.header.vaultId, t.vault.header.vaultId);
    assertEqual(res.records.length, 2);
    var key = await C.unlockVault(res.header, 'yedek-parola');
    var rec = await C.decryptJson(key, res.records[1].envelope);
    assertEqual(rec, { site: 'b.com', n: 2 });
    assertEqual(Array.from(await C.decryptBytes(key, res.shots.r1)), [1, 2, 3, 250]);
    assertTrue(JSON.stringify(res).indexOf('yedek-parola') === -1, 'parola sonuçta olmamalı');
  });

  test('yedek: yanlış yedek parolası wrong-password', async function () {
    var t = await makeBackup();
    await expectReject(B.restoreBackup({ backup: t.backup, backupPassword: 'yanlis' }), 'wrong-password');
    var cur = await C.createVault('mevcut', { iterations: 1000 });
    await expectReject(
      B.restoreBackup({ backup: t.backup, backupPassword: 'yanlis', currentHeader: cur.header }),
      'wrong-password'
    );
  });

  test('yedek: farklı kasaya yükleme mevcut anahtarla çözülür, yedeğinkiyle çözülmez', async function () {
    var t = await makeBackup();
    var cur = await C.createVault('mevcut', { iterations: 1000 });
    var res = await B.restoreBackup({
      backup: t.backup,
      backupPassword: 'yedek-parola',
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
})();
