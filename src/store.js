// Kayıt deposu: şifreli zarflar chrome.storage.sync'e yazılır; sync reddederse
// (kota, 8 KB öğe sınırı, hız sınırı) chrome.storage.local'da "bekleyen" tutulur.
// Zarflar opak JSON nesneleridir; depo içlerine bakmaz. Service worker'da çalışır (window/document yok).
(function (g) {
  'use strict';
  if (g.KeyLordStore) return; // çift yükleme koruması

  var HEADER_KEY = 'vault';
  var REC = 'rec:';
  var PENDING = 'pending:';
  var SHOT = 'shot:';
  var DEFAULT_QUOTA = 102400;

  // area: chrome.storage.sync / .local (Promise API). Bu sahte alanlarla da aynı çalışır.
  function createStore(areas) {
    var sync = areas.sync;
    var local = areas.local;

    async function getOne(area, key) {
      var o = await area.get(key);
      return o && Object.prototype.hasOwnProperty.call(o, key) ? o[key] : null;
    }

    // Bir alandaki belirli önekli öğeleri { id: değer } olarak döner.
    async function byPrefix(area, prefix) {
      var all = await area.get(null);
      var out = {};
      for (var k in all) {
        if (Object.prototype.hasOwnProperty.call(all, k) && k.indexOf(prefix) === 0) {
          out[k.slice(prefix.length)] = all[k];
        }
      }
      return out;
    }

    async function getHeader() {
      return getOne(sync, HEADER_KEY);
    }

    async function putHeader(header) {
      var o = {};
      o[HEADER_KEY] = header;
      await sync.set(o);
    }

    // Önce sync'e dener; hata olursa local'e bekleyen olarak yazar (kayıp olmaz).
    async function putRecord(id, envelope) {
      var o = {};
      o[REC + id] = envelope;
      try {
        await sync.set(o);
      } catch (e) {
        var p = {};
        p[PENDING + id] = envelope;
        await local.set(p);
        return { synced: false };
      }
      await local.remove(PENDING + id);
      return { synced: true };
    }

    // Bekleyenleri sync'e taşımayı dener; hâlâ bekleyen sayısını döner. Tek tek hatalarda atmaz.
    async function retryPending() {
      var pend = await byPrefix(local, PENDING);
      var left = 0;
      for (var id in pend) {
        var o = {};
        o[REC + id] = pend[id];
        try {
          await sync.set(o);
          await local.remove(PENDING + id);
        } catch (e) {
          left++;
        }
      }
      return left;
    }

    // Aynı id'de bekleyen öncelikli; id'ye göre sıralı (deterministik).
    async function listRecords() {
      var synced = await byPrefix(sync, REC);
      var pend = await byPrefix(local, PENDING);
      var map = {};
      for (var a in synced) map[a] = { id: a, envelope: synced[a], synced: true };
      for (var b in pend) map[b] = { id: b, envelope: pend[b], synced: false };
      return Object.keys(map)
        .sort()
        .map(function (k) {
          return map[k];
        });
    }

    async function deleteRecord(id) {
      await sync.remove(REC + id);
      await local.remove([PENDING + id, SHOT + id]);
    }

    async function putShot(id, envelope) {
      var o = {};
      o[SHOT + id] = envelope;
      await local.set(o);
    }

    async function getShot(id) {
      return getOne(local, SHOT + id);
    }

    async function syncUsage() {
      var bytes = await sync.getBytesInUse(null);
      var quota = sync.QUOTA_BYTES || DEFAULT_QUOTA;
      return { bytes: bytes, quota: quota, ratio: bytes / quota };
    }

    return {
      getHeader: getHeader,
      putHeader: putHeader,
      putRecord: putRecord,
      retryPending: retryPending,
      listRecords: listRecords,
      deleteRecord: deleteRecord,
      putShot: putShot,
      getShot: getShot,
      syncUsage: syncUsage
    };
  }

  g.KeyLordStore = { createStore: createStore };
})(globalThis);
