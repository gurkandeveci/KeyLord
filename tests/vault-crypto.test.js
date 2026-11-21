// Kasa şifrelemesi testleri. Yalnızca WebCrypto (crypto.subtle) varsa yüklenir.
(function () {
  var V = globalThis.KeyLordVaultCrypto;
  var OPTS = { iterations: 1000 }; // testlerde hız için düşük tur
  var UNLOCK = { minIterations: 1000 }; // düşük turlu test başlıklarını açmak için alt sınır

  async function rejects(promise, message, label) {
    var err = null;
    try {
      await promise;
    } catch (e) {
      err = e;
    }
    assertTrue(err, (label || '') + ' reddedilmeliydi');
    assertEqual(err.message, message, label);
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesToB64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  test('kasa: varsayılan tur sayısı 600000', function () {
    assertEqual(V.DEFAULT_ITERATIONS, 600000);
  });

  test('kasa: createVault + unlockVault + JSON gidiş-dönüş', async function () {
    var r = await V.createVault('doğru parola', OPTS);
    var key = await V.unlockVault(r.header, 'doğru parola', UNLOCK);
    var obj = { site: 'vcenter', user: 'admin', n: 3, list: [1, 2] };
    var env = await V.encryptJson(r.header, obj);
    assertEqual(env.v, 1);
    assertEqual(await V.decryptJson(key, env), obj);
    assertEqual(await V.decryptJson(r.privateKey, env), obj, 'createVault anahtarı');
  });

  test('kasa: başlık alanları', async function () {
    var r = await V.createVault('p', { iterations: 1000, googleEmail: 'a@b.c', now: 42 });
    var h = r.header;
    assertEqual(h.v, 1);
    assertTrue(typeof h.vaultId === 'string' && h.vaultId.length >= 16, 'vaultId');
    assertEqual(h.kdf.iterations, 1000);
    assertEqual(b64ToBytes(h.kdf.salt).length, 16, 'tuz 16 bayt');
    assertEqual(b64ToBytes(h.wrappedPrivateKey.iv).length, 12, 'IV 12 bayt');
    assertEqual(h.publicKey.kty, 'EC');
    assertEqual(h.publicKey.crv, 'P-256');
    assertTrue(!('d' in h.publicKey), 'açık anahtarda gizli kısım olmamalı');
    assertEqual(h.googleEmail, 'a@b.c');
    assertEqual(h.createdAt, 42);
  });

  test('kasa: Türkçe karakterler korunur', async function () {
    var r = await V.createVault('p', OPTS);
    var obj = { note: 'Gürkan şifre ğüşıöç', u: 'İĞÜŞÖÇ' };
    var env = await V.encryptJson(r.header, obj);
    assertEqual(await V.decryptJson(r.privateKey, env), obj);
  });

  test('kasa: yanlış parola → wrong-password', async function () {
    var r = await V.createVault('doğru', OPTS);
    await rejects(V.unlockVault(r.header, 'yanlış', UNLOCK), 'wrong-password');
  });

  test('kasa: 1 KB rastgele bayt korunur', async function () {
    var r = await V.createVault('p', OPTS);
    var data = new Uint8Array(1024);
    crypto.getRandomValues(data);
    var env = await V.encryptBytes(r.header, data);
    var back = await V.decryptBytes(r.privateKey, env);
    assertTrue(back instanceof Uint8Array, 'Uint8Array dönmeli');
    assertEqual(Array.from(back), Array.from(data));
  });

  test('kasa: ct bozulursa → bad-envelope', async function () {
    var r = await V.createVault('p', OPTS);
    var env = await V.encryptJson(r.header, { a: 1 });
    var ct = b64ToBytes(env.ct);
    ct[0] ^= 1;
    var bad = { v: env.v, epk: env.epk, iv: env.iv, ct: bytesToB64(ct) };
    await rejects(V.decryptJson(r.privateKey, bad), 'bad-envelope');
  });

  test('kasa: biçimsiz zarf → bad-envelope', async function () {
    var r = await V.createVault('p', OPTS);
    await rejects(V.decryptJson(r.privateKey, null), 'bad-envelope', 'null');
    await rejects(V.decryptJson(r.privateKey, {}), 'bad-envelope', 'boş');
    await rejects(V.decryptBytes(r.privateKey, { v: 1, epk: '!!', iv: 'x', ct: 'y' }), 'bad-envelope', 'çöp');
    var env = await V.encryptJson(r.header, { a: 1 });
    await rejects(V.decryptJson(r.privateKey, { v: 2, epk: env.epk, iv: env.iv, ct: env.ct }), 'bad-envelope', 'sürüm');
  });

  test('kasa: başka kasanın anahtarı çözemez', async function () {
    var a = await V.createVault('p', OPTS);
    var b = await V.createVault('p', OPTS);
    var env = await V.encryptJson(a.header, { a: 1 });
    await rejects(V.decryptJson(b.privateKey, env), 'bad-envelope');
  });

  test('kasa: aynı nesne iki kez → farklı epk ve iv', async function () {
    var r = await V.createVault('p', OPTS);
    var e1 = await V.encryptJson(r.header, { a: 1 });
    var e2 = await V.encryptJson(r.header, { a: 1 });
    assertTrue(e1.epk !== e2.epk, 'epk farklı');
    assertTrue(e1.iv !== e2.iv, 'iv farklı');
    assertEqual(b64ToBytes(e1.epk).length, 65, 'sıkıştırılmamış P-256 noktası');
    assertEqual(b64ToBytes(e1.iv).length, 12, 'IV 12 bayt');
  });

  test('kasa: başlıkta parola metni geçmez', async function () {
    var pw = 'GizliParola-ÇokÖzel-12345';
    var r = await V.createVault(pw, OPTS);
    var json = JSON.stringify(r.header);
    assertTrue(json.indexOf(pw) < 0, 'parola başlıkta');
    assertTrue(json.indexOf(btoa(unescape(encodeURIComponent(pw)))) < 0, 'parola base64 başlıkta');
  });

  test('kasa: exportPrivateKey → importPrivateKey ile çözme', async function () {
    var r = await V.createVault('p', OPTS);
    var key = await V.unlockVault(r.header, 'p', UNLOCK);
    var b64 = await V.exportPrivateKey(key);
    assertTrue(typeof b64 === 'string' && b64.length > 0, 'base64 metin');
    var key2 = await V.importPrivateKey(b64);
    var env = await V.encryptJson(r.header, { x: 'y' });
    assertEqual(await V.decryptJson(key2, env), { x: 'y' });
  });

  function cloneHeader(h) {
    return JSON.parse(JSON.stringify(h));
  }

  test('kasa: açık anahtarı değiştirilmiş başlık → bad-header', async function () {
    var a = await V.createVault('p', OPTS);
    var b = await V.createVault('p', OPTS);
    var h = cloneHeader(a.header);
    h.publicKey = cloneHeader(b.header).publicKey;
    await rejects(V.unlockVault(h, 'p', UNLOCK), 'bad-header', 'takas');
  });

  test('kasa: varsayılan alt sınırla düşük tur reddedilir', async function () {
    var r = await V.createVault('p', OPTS);
    await rejects(V.unlockVault(r.header, 'p'), 'bad-header', '1000 tur, varsayılan sınır');
    var h = cloneHeader(r.header);
    h.kdf.iterations = 1;
    await rejects(V.unlockVault(h, 'p'), 'bad-header', '1 tur');
    await rejects(V.unlockVault(h, 'p', UNLOCK), 'bad-header', '1 tur, test sınırı');
    h.kdf.iterations = 5000001;
    await rejects(V.unlockVault(h, 'p', UNLOCK), 'bad-header', 'üst sınır');
    h.kdf.iterations = 1000.5;
    await rejects(V.unlockVault(h, 'p', UNLOCK), 'bad-header', 'tam sayı değil');
  });

  test('kasa: biçimsiz başlık → bad-header', async function () {
    var r = await V.createVault('p', OPTS);
    function mut(fn) {
      var h = cloneHeader(r.header);
      fn(h);
      return h;
    }
    await rejects(V.unlockVault(mut(function (h) { h.v = 2; }), 'p', UNLOCK), 'bad-header', 'v:2');
    await rejects(V.unlockVault(mut(function (h) { h.kdf.salt = btoa('kisa'); }), 'p', UNLOCK), 'bad-header', 'kısa tuz');
    await rejects(V.unlockVault(mut(function (h) { h.kdf.salt = '!!!'; }), 'p', UNLOCK), 'bad-header', 'çöp tuz');
    await rejects(V.unlockVault(mut(function (h) { delete h.kdf; }), 'p', UNLOCK), 'bad-header', 'kdf yok');
    await rejects(V.unlockVault(mut(function (h) { delete h.publicKey; }), 'p', UNLOCK), 'bad-header', 'açık anahtar yok');
    await rejects(V.unlockVault(mut(function (h) { h.wrappedPrivateKey = null; }), 'p', UNLOCK), 'bad-header', 'sarılı anahtar yok');
    await rejects(V.unlockVault(null, 'p', UNLOCK), 'bad-header', 'null');
    await rejects(V.unlockVault('x', 'p', UNLOCK), 'bad-header', 'metin');
  });

  test('kasa: validateHeader geçerli başlığı kabul eder', async function () {
    var r = await V.createVault('p', OPTS);
    assertTrue(V.validateHeader(r.header, UNLOCK) === r.header, 'aynı başlık döner');
    var threw = null;
    try { V.validateHeader(r.header); } catch (e) { threw = e; }
    assertEqual(threw && threw.message, 'bad-header', 'varsayılan alt sınır');
  });

  test('kasa: yeni zarflar kasa kimliğini (vid) taşır; vid olmayan eski zarf da çözülür', async function () {
    var r = await V.createVault('p', OPTS);
    var env = await V.encryptJson(r.header, { a: 1 });
    assertEqual(env.vid, r.header.vaultId, 'json vid');
    var benv = await V.encryptBytes(r.header, new Uint8Array([7]));
    assertEqual(benv.vid, r.header.vaultId, 'bytes vid');
    var old = { v: env.v, epk: env.epk, iv: env.iv, ct: env.ct };
    assertEqual(await V.decryptJson(r.privateKey, old), { a: 1 }, 'vid yok');
    var other = { v: env.v, vid: 'baska', epk: env.epk, iv: env.iv, ct: env.ct };
    assertEqual(await V.decryptJson(r.privateKey, other), { a: 1 }, 'vid çözmede yok sayılır');
  });
})();
