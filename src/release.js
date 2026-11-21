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

  async function commitOf(fetchFn, tag) {
    var commit = await getJson(fetchFn, API + '/commits/' + encodeURIComponent(tag));
    if (!commit || typeof commit.sha !== 'string' || commit.sha.length < 7) throw new Error('bad-commit');
    return commit.sha.slice(0, 7);
  }

  // Son sürüm + kurulu sürümün (etiketi "v" + sürüm) commit numarası. Kurulu sürümün etiketi
  // GitHub'da yoksa (ör. yayınlanmamış geliştirme sürümü) installedSha null olur.
  async function fetchFresh(fetchFn, installed) {
    var rel = await getJson(fetchFn, API + '/releases/latest');
    if (!rel || typeof rel.tag_name !== 'string' || !rel.tag_name) throw new Error('bad-release');
    var sha = await commitOf(fetchFn, rel.tag_name);
    var installedTag = 'v' + installed;
    var installedSha = null;
    if (parts(installedTag) && parts(rel.tag_name) && !isNewer(rel.tag_name, installed) && !isNewer('v' + installed, rel.tag_name)) {
      installedSha = sha; // kurulu sürüm = son sürüm
    } else {
      try {
        installedSha = await commitOf(fetchFn, installedTag);
      } catch (e) {
        installedSha = null;
      }
    }
    return { tag: rel.tag_name, sha: sha, url: String(rel.html_url || ''), installed: installed, installedSha: installedSha };
  }

  function result(info, installed) {
    return {
      ok: true,
      tag: info.tag,
      sha: info.sha,
      url: info.url,
      installed: installed,
      installedSha: info.installedSha === undefined ? null : info.installedSha,
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
    // Önbellek yalnızca aynı kurulu sürüm için geçerlidir (eklenti güncellenince yeniden sorulur).
    var sameInstalled = cached && cached.info && cached.info.installed === o.installed;
    if (sameInstalled && o.now - cached.at >= 0 && o.now - cached.at < TTL_MS) {
      return result(cached.info, o.installed);
    }
    try {
      var info = await fetchFresh(o.fetch, o.installed);
      try {
        var item = {};
        item[CACHE_KEY] = { at: o.now, info: info };
        await o.cache.set(item);
      } catch (e) {}
      return result(info, o.installed);
    } catch (err) {
      // Ağ yoksa ya da GitHub sınırı aşıldıysa eski bilgi varsa onu göster.
      if (sameInstalled) return result(cached.info, o.installed);
      return { ok: false, installed: o.installed };
    }
  }

  g.KeyLordRelease = { getLatest: getLatest, isNewer: isNewer, TTL_MS: TTL_MS, API: API };
})(globalThis);
