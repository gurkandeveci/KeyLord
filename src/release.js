// GitHub'daki en son yayınlanan sürümü (Latest Release) ve o sürümün commit numarasını getirir.
// Service worker'da çalışır; fetch ve önbellek dışarıdan verilir, böylece testlerde ağa çıkılmaz.
// GitHub kimliksiz API'si saatte 60 istekle sınırlı olduğu için sonuç 1 saat önbellekte tutulur.
(function (g) {
  'use strict';

  if (g.KeyLordRelease) return;

  var API = 'https://api.github.com/repos/gurkandeveci/KeyLord';
  var CACHE_KEY = 'latestRelease';
  var TTL_MS = 60 * 60 * 1000;

  function parts(v) {
    var m = /^v?(\d+(?:\.\d+)*)$/.exec(String(v || '').trim());
    return m ? m[1].split('.').map(Number) : null;
  }

  // latest, installed'dan yeniyse true. Okunamayan sürüm numarası için false.
  function isNewer(latest, installed) {
    var a = parts(latest);
    var b = parts(installed);
    if (!a || !b) return false;
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = a[i] || 0;
      var y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  function getJson(fetchFn, url) {
    return fetchFn(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (res) {
      if (!res || !res.ok) throw new Error('http-' + (res && res.status));
      return res.json();
    });
  }

  async function fetchFresh(fetchFn) {
    var rel = await getJson(fetchFn, API + '/releases/latest');
    if (!rel || typeof rel.tag_name !== 'string' || !rel.tag_name) throw new Error('bad-release');
    var commit = await getJson(fetchFn, API + '/commits/' + encodeURIComponent(rel.tag_name));
    if (!commit || typeof commit.sha !== 'string' || commit.sha.length < 7) throw new Error('bad-commit');
    return { tag: rel.tag_name, sha: commit.sha.slice(0, 7), url: String(rel.html_url || '') };
  }

  function result(info, installed) {
    return {
      ok: true,
      tag: info.tag,
      sha: info.sha,
      url: info.url,
      installed: installed,
      newer: isNewer(info.tag, installed)
    };
  }

  // o: { fetch, cache: {get,set}, now, installed }. Hiçbir zaman atmaz.
  async function getLatest(o) {
    var cached = null;
    try {
      var got = await o.cache.get(CACHE_KEY);
      cached = got && got[CACHE_KEY];
    } catch (e) {}
    if (cached && cached.info && o.now - cached.at >= 0 && o.now - cached.at < TTL_MS) {
      return result(cached.info, o.installed);
    }
    try {
      var info = await fetchFresh(o.fetch);
      try {
        var item = {};
        item[CACHE_KEY] = { at: o.now, info: info };
        await o.cache.set(item);
      } catch (e) {}
      return result(info, o.installed);
    } catch (err) {
      // Ağ yoksa ya da GitHub sınırı aşıldıysa eski bilgi varsa onu göster.
      if (cached && cached.info) return result(cached.info, o.installed);
      return { ok: false, installed: o.installed };
    }
  }

  g.KeyLordRelease = { getLatest: getLatest, isNewer: isNewer, TTL_MS: TTL_MS, API: API };
})(globalThis);
