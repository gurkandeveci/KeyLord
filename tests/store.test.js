(function () {
  var S = globalThis.KeyLordStore;

  // Sahte chrome.storage alanı (Promise API). limit: öğe başına JSON bayt sınırı.
  function fakeArea(opts) {
    opts = opts || {};
    var data = {};
    var area = {
      data: data,
      failAll: false,
      QUOTA_BYTES: opts.quota,
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
        if (area.failAll) return Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
        if (opts.limit) {
          for (var k in obj) {
            if (JSON.stringify(k).length + JSON.stringify(obj[k]).length > opts.limit) {
              return Promise.reject(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
            }
          }
        }
        for (var j in obj) data[j] = obj[j];
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
    return area;
  }
  function mk() {
    var sync = fakeArea({ limit: 8192, quota: 102400 });
    var local = fakeArea();
    return { sync: sync, local: local, store: S.createStore({ sync: sync, local: local }) };
  }
  var big = { v: 1, epk: 'a', iv: 'b', ct: new Array(9001).join('x') };
  var small = { v: 1, epk: 'a', iv: 'b', ct: 'zzz' };

  test('depo: normal kayıt senkronlanır', async function () {
    var t = mk();
    var r = await t.store.putRecord('r1', small);
    assertEqual(r.synced, true);
    assertTrue(!!t.sync.data['rec:r1']);
    assertTrue(!t.local.data['pending:r1']);
    var list = await t.store.listRecords();
    assertEqual(list.length, 1);
    assertEqual(list[0].id, 'r1');
    assertEqual(list[0].synced, true);
    assertEqual(list[0].envelope.ct, 'zzz');
  });

  test('depo: 9 KB zarf bekleyen olur, synced:false listelenir', async function () {
    var t = mk();
    var r = await t.store.putRecord('r2', big);
    assertEqual(r.synced, false);
    assertTrue(!t.sync.data['rec:r2']);
    assertTrue(!!t.local.data['pending:r2']);
    var list = await t.store.listRecords();
    assertEqual(list.length, 1);
    assertEqual(list[0].synced, false);
    assertEqual(list[0].envelope.ct.length, big.ct.length);
  });

  test('depo: pending aynı id için önceliklidir ve sıralama id iledir', async function () {
    var t = mk();
    await t.store.putRecord('b', small);
    await t.store.putRecord('a', small);
    t.local.data['pending:b'] = { v: 1, epk: 'a', iv: 'b', ct: 'new' };
    var list = await t.store.listRecords();
    assertEqual(list.map(function (x) { return x.id; }).join(','), 'a,b');
    assertEqual(list[1].envelope.ct, 'new');
    assertEqual(list[1].synced, false);
  });

  test('depo: sync düzelince retryPending 0 döner', async function () {
    var t = mk();
    t.sync.failAll = true;
    var r = await t.store.putRecord('r3', small);
    assertEqual(r.synced, false);
    assertEqual(await t.store.retryPending(), 1);
    t.sync.failAll = false;
    assertEqual(await t.store.retryPending(), 0);
    assertTrue(!!t.sync.data['rec:r3']);
    assertTrue(!t.local.data['pending:r3']);
    assertEqual((await t.store.listRecords())[0].synced, true);
  });

  test('depo: retryPending büyük kayıt için bekleyen sayar, atmaz', async function () {
    var t = mk();
    await t.store.putRecord('big', big);
    await t.store.putRecord('ok', small);
    t.sync.failAll = true;
    await t.store.putRecord('p', small);
    t.sync.failAll = false;
    assertEqual(await t.store.retryPending(), 1);
  });

  test('depo: başarılı yazma eski pending kaydı siler', async function () {
    var t = mk();
    t.sync.failAll = true;
    await t.store.putRecord('r4', small);
    t.sync.failAll = false;
    var r = await t.store.putRecord('r4', small);
    assertEqual(r.synced, true);
    assertTrue(!t.local.data['pending:r4']);
  });

  test('depo: deleteRecord üç anahtarı siler', async function () {
    var t = mk();
    await t.store.putRecord('r5', small);
    t.local.data['pending:r5'] = small;
    await t.store.putShot('r5', small);
    await t.store.deleteRecord('r5');
    assertTrue(!t.sync.data['rec:r5']);
    assertTrue(!t.local.data['pending:r5']);
    assertTrue(!t.local.data['shot:r5']);
    assertEqual(await t.store.getShot('r5'), null);
  });

  test('depo: başlık ve ekran görüntüsü', async function () {
    var t = mk();
    assertEqual(await t.store.getHeader(), null);
    await t.store.putHeader({ v: 1, salt: 's' });
    assertEqual((await t.store.getHeader()).salt, 's');
    assertTrue(!!t.sync.data['vault']);
    assertEqual(await t.store.getShot('x'), null);
    await t.store.putShot('x', small);
    assertEqual((await t.store.getShot('x')).ct, 'zzz');
    assertTrue(!!t.local.data['shot:x']);
    assertEqual((await t.store.listRecords()).length, 0);
  });

  test('depo: syncUsage oranı hesaplar', async function () {
    var t = mk();
    t.sync.getBytesInUse = function () { return Promise.resolve(10240); };
    var u = await t.store.syncUsage();
    assertEqual(u.bytes, 10240);
    assertEqual(u.quota, 102400);
    assertEqual(u.ratio, 0.1);
    t.sync.QUOTA_BYTES = undefined;
    assertEqual((await t.store.syncUsage()).quota, 102400);
  });

  test('depo: eşzamanlı retryPending ve yeni putRecord - yeni olan kazanır', async function () {
    var t = mk();
    t.sync.failAll = true;
    await t.store.putRecord('c1', { v: 1, ct: 'old' });
    t.sync.failAll = false;
    var p1 = t.store.retryPending();
    var p2 = t.store.putRecord('c1', { v: 1, ct: 'newer' });
    await Promise.all([p1, p2]);
    var list = await t.store.listRecords();
    assertEqual(list.length, 1);
    assertEqual(list[0].envelope.ct, 'newer');
    assertEqual(list[0].synced, true);
  });

  test('depo: eşzamanlı deleteRecord retryPending ile geri gelmez', async function () {
    var t = mk();
    t.sync.failAll = true;
    await t.store.putRecord('c2', small);
    t.sync.failAll = false;
    var p1 = t.store.retryPending();
    var p2 = t.store.deleteRecord('c2');
    await Promise.all([p1, p2]);
    assertEqual((await t.store.listRecords()).length, 0);
  });

  test('depo: local.remove hatası senkron başarılı yazmayı bozmaz', async function () {
    var t = mk();
    t.local.remove = function () { return Promise.reject(new Error('x')); };
    var r = await t.store.putRecord('c3', small);
    assertEqual(r.synced, true);
    assertTrue(!!t.sync.data['rec:c3']);
  });

  test('depo: sync ve local yazma ikisi de başarısızsa putRecord atar', async function () {
    var t = mk();
    t.sync.failAll = true;
    t.local.failAll = true;
    var threw = false;
    try { await t.store.putRecord('c4', small); } catch (e) { threw = true; }
    assertTrue(threw);
  });

  test('depo: remove başarısızsa bayat pending yeni zarfla ezilir', async function () {
    var t = mk();
    t.sync.failAll = true;
    await t.store.putRecord('c5', { v: 1, ct: 'old' });
    t.sync.failAll = false;
    t.local.remove = function () { return Promise.reject(new Error('x')); };
    var r = await t.store.putRecord('c5', { v: 1, ct: 'newer' });
    assertEqual(r.synced, true);
    var list = await t.store.listRecords();
    assertEqual(list.length, 1);
    assertEqual(list[0].envelope.ct, 'newer');
    await t.store.retryPending();
    assertEqual(t.sync.data['rec:c5'].ct, 'newer');
  });

  test('depo: remove ve ezme ikisi de başarısızsa putRecord atar', async function () {
    var t = mk();
    t.local.remove = function () { return Promise.reject(new Error('x')); };
    t.local.failAll = true;
    var threw = false;
    try { await t.store.putRecord('c6', small); } catch (e) { threw = true; }
    assertTrue(threw);
  });
})();
