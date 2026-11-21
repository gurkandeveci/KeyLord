// Kasa oturumu ve uyarı testleri. Yalnızca WebCrypto (crypto.subtle) varsa yüklenir.
(function () {
  var S = globalThis.KeyLordVaultSession;
  var C = globalThis.KeyLordVaultCrypto;
  var MIN = 60 * 1000;

  // chrome.storage.session benzeri, Promise döndüren bellek içi sahte alan.
  function fakeArea() {
    var data = {};
    return {
      data: data,
      get: function (key) {
        var out = {};
        if (key in data) out[key] = JSON.parse(JSON.stringify(data[key]));
        return Promise.resolve(out);
      },
      set: function (obj) {
        for (var k in obj) data[k] = JSON.parse(JSON.stringify(obj[k]));
        return Promise.resolve();
      },
      remove: function (key) {
        delete data[key];
        return Promise.resolve();
      }
    };
  }

  async function setup() {
    var v = await C.createVault('ana-parola', { iterations: 1000 });
    return { header: v.header, privateKey: v.privateKey, area: fakeArea() };
  }

  test('oturum: zaman aşımı 15 dakika', function () {
    assertEqual(S.TIMEOUT_MS, 900000);
  });

  test('oturum: kaydet, 14 dk sonra yükle anahtarı döner ve çözebilir', async function () {
    var s = await setup();
    var env = await C.encryptJson(s.header, { a: 1 });
    await S.saveKey(s.area, s.privateKey, 1000);
    assertEqual(Object.keys(s.area.data).join(','), 'vaultKey');
    assertEqual(typeof s.area.data.vaultKey.key, 'string');
    assertEqual(s.area.data.vaultKey.lastActivity, 1000);
    var key = await S.loadKey(s.area, 1000 + 14 * MIN);
    assertTrue(key, 'anahtar dönmeliydi');
    var obj = await C.decryptJson(key, env);
    assertEqual(obj.a, 1);
  });

  test('oturum: 16 dk sonra null ve kayıt silinir', async function () {
    var s = await setup();
    await S.saveKey(s.area, s.privateKey, 1000);
    assertEqual(await S.loadKey(s.area, 1000 + 16 * MIN), null);
    assertEqual('vaultKey' in s.area.data, false);
  });

  test('oturum: tam 15 dk geçerli, 15 dk + 1 ms geçersiz', async function () {
    var s = await setup();
    await S.saveKey(s.area, s.privateKey, 0);
    assertTrue(await S.loadKey(s.area, 15 * MIN), 'sınırda geçerli');
    var s2 = await setup();
    await S.saveKey(s2.area, s2.privateKey, 0);
    assertEqual(await S.loadKey(s2.area, 15 * MIN + 1), null);
  });

  test('oturum: yükleme lastActivity değerini ileri alır', async function () {
    var s = await setup();
    await S.saveKey(s.area, s.privateKey, 0);
    await S.loadKey(s.area, 10 * MIN);
    assertEqual(s.area.data.vaultKey.lastActivity, 10 * MIN);
    assertTrue(await S.loadKey(s.area, 24 * MIN), '10. dk etkinliğinden 14 dk sonra geçerli');
  });

  test('oturum: lock sonrası null; kayıt yokken null', async function () {
    var s = await setup();
    assertEqual(await S.loadKey(s.area, 0), null);
    await S.saveKey(s.area, s.privateKey, 0);
    await S.lock(s.area);
    assertEqual(await S.loadKey(s.area, 1), null);
    assertEqual('vaultKey' in s.area.data, false);
  });

  test('oturum: bozuk kayıt silinir ve null döner', async function () {
    var bad = [null, 'x', { key: 5, lastActivity: 1 }, { key: 'AAAA', lastActivity: 1 },
      { key: 'AAAA' }, { lastActivity: 1 }];
    for (var i = 0; i < bad.length; i++) {
      var area = fakeArea();
      area.data.vaultKey = bad[i];
      assertEqual(await S.loadKey(area, 2), null, 'bozuk #' + i);
      assertEqual('vaultKey' in area.data, false, 'silinmeli #' + i);
    }
  });

  test('uyarılar: e-posta boş / eşleşme / farklı hesap', function () {
    assertEqual(S.warnings({ googleEmail: 'a@x' }, '').join(','), 'no-google-account');
    assertEqual(S.warnings({ googleEmail: 'a@x' }, undefined).join(','), 'no-google-account');
    assertEqual(S.warnings({ googleEmail: 'a@x' }, null).join(','), 'no-google-account');
    assertEqual(S.warnings({ googleEmail: 'a@x' }, 'b@x').join(','), 'other-account');
    assertEqual(S.warnings({ googleEmail: 'a@x' }, 'a@x').length, 0);
  });

  test('uyarılar: başlıkta googleEmail yoksa', function () {
    assertEqual(S.warnings({}, 'b@x').length, 0);
    assertEqual(S.warnings({}, '').join(','), 'no-google-account');
    assertEqual(S.warnings(null, 'b@x').length, 0);
    assertEqual(S.warnings(undefined, undefined).join(','), 'no-google-account');
  });
})();
