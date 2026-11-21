// Kasa şifrelemesi testleri. Yalnızca WebCrypto (crypto.subtle) varsa yüklenir.
(function () {
  var V = globalThis.KeyLordVaultCrypto;
  var OPTS = { iterations: 1000 }; // testlerde hız için düşük tur

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
    var key = await V.unlockVault(r.header, 'doğru parola');
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
    await rejects(V.unlockVault(r.header, 'yanlış'), 'wrong-password');
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
    var key = await V.unlockVault(r.header, 'p');
    var b64 = await V.exportPrivateKey(key);
    assertTrue(typeof b64 === 'string' && b64.length > 0, 'base64 metin');
    var key2 = await V.importPrivateKey(b64);
    var env = await V.encryptJson(r.header, { x: 'y' });
    assertEqual(await V.decryptJson(key2, env), { x: 'y' });
  });
})();
