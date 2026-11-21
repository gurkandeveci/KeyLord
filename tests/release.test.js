(function () {
  var R = globalThis.KeyLordRelease;

  function memCache() {
    var data = {};
    return {
      data: data,
      get: function (k) { var o = {}; if (k in data) o[k] = JSON.parse(JSON.stringify(data[k])); return Promise.resolve(o); },
      set: function (obj) { for (var k in obj) data[k] = JSON.parse(JSON.stringify(obj[k])); return Promise.resolve(); }
    };
  }

  // Sahte fetch: URL -> { status, body }
  function fakeFetch(routes, calls) {
    return function (url) {
      calls.push(url);
      var r = routes[url];
      if (!r) return Promise.reject(new Error('ağ hatası'));
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: function () { return Promise.resolve(r.body); }
      });
    };
  }

  var API = 'https://api.github.com/repos/gurkandeveci/KeyLord';
  function okRoutes(tag, sha, installedTag, installedSha) {
    var routes = {};
    routes[API + '/releases/latest'] = { status: 200, body: { tag_name: tag, html_url: 'https://github.com/gurkandeveci/KeyLord/releases/tag/' + tag } };
    routes[API + '/commits/' + encodeURIComponent(tag)] = { status: 200, body: { sha: sha } };
    if (installedTag && installedTag !== tag) {
      routes[API + '/commits/' + encodeURIComponent(installedTag)] = { status: 200, body: { sha: installedSha } };
    }
    return routes;
  }

  test('sürüm: isNewer v önekini yok sayar ve sayısal karşılaştırır', function () {
    assertTrue(R.isNewer('v1.2.0', '1.1.0'));
    assertTrue(R.isNewer('v1.10.0', '1.9.3'));
    assertTrue(!R.isNewer('v1.1.0', '1.1.0'));
    assertTrue(!R.isNewer('v1.0.9', '1.1.0'));
    assertTrue(R.isNewer('v2', '1.9.9'));
    assertTrue(!R.isNewer('bozuk', '1.1.0'));
  });

  test('sürüm: getLatest etiket, 7 haneli commit ve sayfa adresini döner', async function () {
    var calls = [];
    var res = await R.getLatest({ fetch: fakeFetch(okRoutes('v1.1.0', 'dfe3a61abcdef0123'), calls), cache: memCache(), now: 1000, installed: '1.1.0' });
    assertEqual(res, { ok: true, tag: 'v1.1.0', sha: 'dfe3a61', url: 'https://github.com/gurkandeveci/KeyLord/releases/tag/v1.1.0', installed: '1.1.0', installedSha: 'dfe3a61', newer: false });
    assertEqual(calls.length, 2);
  });

  test('sürüm: kurulu sürüm farklıysa onun commit numarası da gelir', async function () {
    var res = await R.getLatest({ fetch: fakeFetch(okRoutes('v1.2.0', 'bbbbbbb22', 'v1.1.1', '46d3c11ff'), []), cache: memCache(), now: 1, installed: '1.1.1' });
    assertEqual(res.installedSha, '46d3c11');
    assertEqual(res.newer, true);
  });

  test('sürüm: kurulu sürümün etiketi GitHub\'da yoksa installedSha null, sonuç yine ok', async function () {
    var res = await R.getLatest({ fetch: fakeFetch(okRoutes('v1.2.0', 'bbbbbbb22'), []), cache: memCache(), now: 1, installed: '1.1.9' });
    assertEqual(res.ok, true);
    assertEqual(res.installedSha, null);
  });

  test('sürüm: kurulu sürüm değişince önbellek kullanılmaz', async function () {
    var cache = memCache();
    var calls = [];
    await R.getLatest({ fetch: fakeFetch(okRoutes('v1.2.0', 'bbbbbbb22', 'v1.1.1', '46d3c11ff'), calls), cache: cache, now: 0, installed: '1.1.1' });
    var n = calls.length;
    var res = await R.getLatest({ fetch: fakeFetch(okRoutes('v1.2.0', 'bbbbbbb22'), calls), cache: cache, now: 10, installed: '1.2.0' });
    assertTrue(calls.length > n);
    assertEqual(res.installedSha, 'bbbbbbb');
    assertEqual(res.newer, false);
  });

  test('sürüm: kurulu sürüm eskiyse newer true', async function () {
    var res = await R.getLatest({ fetch: fakeFetch(okRoutes('v1.2.0', 'aaaaaaa1', 'v1.1.0', 'ccccccc3'), []), cache: memCache(), now: 1, installed: '1.1.0' });
    assertTrue(res.newer);
  });

  test('sürüm: 1 saat içinde önbellekten döner, ağa gitmez', async function () {
    var cache = memCache();
    var calls = [];
    var f = fakeFetch(okRoutes('v1.1.0', 'dfe3a61x'), calls);
    await R.getLatest({ fetch: f, cache: cache, now: 0, installed: '1.1.0' });
    var res = await R.getLatest({ fetch: f, cache: cache, now: R.TTL_MS - 1, installed: '1.1.0' });
    assertEqual(calls.length, 2);
    assertEqual(res.tag, 'v1.1.0');
    await R.getLatest({ fetch: f, cache: cache, now: R.TTL_MS + 1, installed: '1.1.0' });
    assertEqual(calls.length, 4);
  });

  test('sürüm: ağ hatasında eski önbellek kullanılır', async function () {
    var cache = memCache();
    await R.getLatest({ fetch: fakeFetch(okRoutes('v1.1.0', 'dfe3a61x'), []), cache: cache, now: 0, installed: '1.1.0' });
    var res = await R.getLatest({ fetch: fakeFetch({}, []), cache: cache, now: R.TTL_MS * 5, installed: '1.1.0' });
    assertEqual(res.ok, true);
    assertEqual(res.sha, 'dfe3a61');
  });

  test('sürüm: önbellek yokken ağ hatası ok:false döner, atmaz', async function () {
    var res = await R.getLatest({ fetch: fakeFetch({}, []), cache: memCache(), now: 0, installed: '1.1.0' });
    assertEqual(res, { ok: false, installed: '1.1.0' });
  });

  test('sürüm: beklenmeyen yanıt (etiket yok, 404) ok:false', async function () {
    var routes = {};
    routes[API + '/releases/latest'] = { status: 404, body: { message: 'Not Found' } };
    var res = await R.getLatest({ fetch: fakeFetch(routes, []), cache: memCache(), now: 0, installed: '1.1.0' });
    assertEqual(res.ok, false);
  });
})();
