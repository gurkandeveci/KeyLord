// Kasa sayfasını tarayıcıda (uzantı olmadan) denemek için bellek içi `chrome` taklidi.
// Yalnızca test sayfaları (vault-harness, mock-console, mock-form) yükler; uzantıya girmez. Gerçek chrome.storage varsa hiçbir şey yapmaz.
// Veriler sayfa yenilenince kaybolur.
(function (g) {
  'use strict';
  if (g.chrome && g.chrome.storage) return; // gerçek uzantı ortamı: dokunma

  var SYNC_QUOTA = 102400;
  var SYNC_ITEM_MAX = 8192;

  function clone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }

  function itemBytes(key, value) {
    return new TextEncoder().encode(key + JSON.stringify(value)).length;
  }

  function makeArea(name, opts) {
    var data = {};
    var o = opts || {};
    var area = {
      _data: data,
      get: function (keys) {
        var out = {};
        if (keys === null || keys === undefined) {
          for (var k in data) out[k] = clone(data[k]);
        } else if (typeof keys === 'string') {
          if (Object.prototype.hasOwnProperty.call(data, keys)) out[keys] = clone(data[keys]);
        } else if (Array.isArray(keys)) {
          keys.forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(data, k)) out[k] = clone(data[k]);
          });
        } else if (typeof keys === 'object') {
          for (var d in keys) {
            out[d] = Object.prototype.hasOwnProperty.call(data, d) ? clone(data[d]) : clone(keys[d]);
          }
        }
        return Promise.resolve(out);
      },
      set: function (items) {
        if (o.sync) {
          if (area._fail) return Promise.reject(new Error('shim: sync devre dışı'));
          var total = 0;
          var next = {};
          for (var a in data) next[a] = data[a];
          for (var k in items) {
            if (itemBytes(k, items[k]) > SYNC_ITEM_MAX) {
              return Promise.reject(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
            }
            next[k] = items[k];
          }
          for (var n in next) total += itemBytes(n, next[n]);
          if (total > SYNC_QUOTA) return Promise.reject(new Error('QUOTA_BYTES quota exceeded'));
        }
        for (var key in items) data[key] = clone(items[key]);
        return Promise.resolve();
      },
      remove: function (keys) {
        (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
          delete data[k];
        });
        return Promise.resolve();
      },
      getBytesInUse: function (keys) {
        var list;
        if (keys === null || keys === undefined) list = Object.keys(data);
        else list = Array.isArray(keys) ? keys : [keys];
        var sum = 0;
        list.forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(data, k)) sum += itemBytes(k, data[k]);
        });
        return Promise.resolve(sum);
      }
    };
    if (o.sync) area.QUOTA_BYTES = SYNC_QUOTA;
    area._name = name;
    return area;
  }

  var sync = makeArea('sync', { sync: true });
  var local = makeArea('local');
  var session = makeArea('session');

  function queryParam(name) {
    try {
      return new URLSearchParams(g.location.search).get(name);
    } catch (e) {
      return null;
    }
  }

  var email = queryParam('email');
  if (email === null) email = 'test@example.com';

  g.chrome = {
    storage: { sync: sync, local: local, session: session },
    identity: {
      getProfileUserInfo: function (details, cb) {
        if (typeof details === 'function') {
          cb = details;
          details = {};
        }
        var info = { email: email, id: '' };
        if (typeof cb === 'function') {
          setTimeout(function () {
            cb(info);
          }, 0);
          return undefined;
        }
        return Promise.resolve(info);
      }
    },
    runtime: {
      id: 'shim',
      lastError: undefined,
      getURL: function (p) {
        return new URL(String(p).replace(/^\//, ''), g.location.href).href;
      },
      // background.js mesaj API'sinin bellek içi taklidi (vault:exists, record:put, shot:capture, vault:open).
      sendMessage: function (msg, cb) {
        var p = Promise.resolve()
          .then(function () {
            return handleMessage(clone(msg));
          })
          .catch(function (e) {
            return { ok: false, error: String((e && e.message) || e).slice(0, 80) };
          });
        if (typeof cb === 'function') {
          p.then(cb);
          return undefined;
        }
        return p;
      }
    }
  };

  // ---- Arka plan taklidi: gerçek KeyLordVaultCrypto + KeyLordStore ile, taklit depolamaya yazar ----
  // (Bu iki dosya, mesaj gönderilmeden önce sayfada yüklü olmalıdır.)
  var bg = {
    failPut: false,
    failShot: false,
    opened: 0,
    captures: 0,
    messages: [], // yalnızca { type, id } – kayıt içeriği (şifre) tutulmaz
    privateKey: null,
    store: null
  };
  // Küçük sahte JPEG (SOI ... EOI).
  var FAKE_JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9];

  function bgStore() {
    if (!bg.store) bg.store = g.KeyLordStore.createStore({ sync: sync, local: local });
    return bg.store;
  }

  async function handleMessage(msg) {
    if (!msg || typeof msg.type !== 'string') return { ok: false, error: 'unknown' };
    bg.messages.push({ type: msg.type, id: msg.id });
    var store = bgStore();
    var header;
    switch (msg.type) {
      case 'vault:exists':
        return { exists: !!(await store.getHeader()) };
      case 'record:put':
        if (typeof msg.id !== 'string' || !msg.id || !msg.record || typeof msg.record !== 'object') {
          return { ok: false, error: 'bad-request' };
        }
        if (bg.failPut) return { ok: false, error: 'shim-fail' };
        header = await store.getHeader();
        if (!header) return { ok: false, error: 'no-vault' };
        var res = await store.putRecord(msg.id, await g.KeyLordVaultCrypto.encryptJson(header, msg.record));
        return { ok: true, synced: res.synced };
      case 'shot:capture':
        if (typeof msg.id !== 'string' || !msg.id || bg.failShot) return { ok: false, error: 'capture-failed' };
        header = await store.getHeader();
        if (!header) return { ok: false, error: 'no-vault' };
        await store.putShot(msg.id, await g.KeyLordVaultCrypto.encryptBytes(header, new Uint8Array(FAKE_JPEG)));
        bg.captures++;
        return { ok: true };
      case 'vault:open':
        bg.opened++;
        return { ok: true };
      default:
        return { ok: false, error: 'unknown' };
    }
  }

  // Test yardımcıları (yalnızca taklitte).
  g.__shim = {
    areas: { sync: sync, local: local, session: session },
    // Düz kaydı mevcut kasa başlığıyla şifreleyip depoya yazar. id yoksa rastgele verilir.
    addRecord: async function (plain) {
      var store = g.KeyLordStore.createStore({ sync: sync, local: local });
      var header = await store.getHeader();
      if (!header) throw new Error('no-vault');
      var id = (plain && plain.id) || 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      var rec = Object.assign({ id: id }, plain);
      var env = await g.KeyLordVaultCrypto.encryptJson(header, rec);
      return Object.assign({ id: id }, await store.putRecord(id, env));
    },
    // Ekran görüntüsü baytlarını şifreleyip local'e yazar.
    addShot: async function (id, bytes) {
      var store = g.KeyLordStore.createStore({ sync: sync, local: local });
      var header = await store.getHeader();
      if (!header) throw new Error('no-vault');
      await store.putShot(id, await g.KeyLordVaultCrypto.encryptBytes(header, bytes));
    },
    // true: sync.set her çağrıda reddeder (bekleyen kayıt senaryosu).
    failSync: function (on) {
      sync._fail = !!on;
    },
    // Arka plan taklidinin durumu (opened, captures, messages, failPut, failShot).
    bg: bg,
    // Kasa kurar (testte düşük tur: { iterations: 1000 }); gizli anahtar records() için saklanır.
    createVault: async function (password, opts) {
      var v = await g.KeyLordVaultCrypto.createVault(password, opts || {});
      await bgStore().putHeader(v.header);
      bg.privateKey = v.privateKey;
      return v.header;
    },
    // true: record:put { ok:false } döner (kayıt yazılamadı senaryosu).
    failRecordPut: function (on) {
      bg.failPut = !!on;
    },
    // true: shot:capture { ok:false } döner.
    failShot: function (on) {
      bg.failShot = !!on;
    },
    // Kayıtları createVault'un gizli anahtarıyla çözer: [{ id, synced, record }].
    records: async function () {
      if (!bg.privateKey) throw new Error('no-private-key');
      var list = await bgStore().listRecords();
      var out = [];
      for (var i = 0; i < list.length; i++) {
        out.push({
          id: list[i].id,
          synced: list[i].synced,
          record: await g.KeyLordVaultCrypto.decryptJson(bg.privateKey, list[i].envelope)
        });
      }
      return out;
    },
    // Yerelde şifreli ekran görüntüsü bulunan kayıt id'leri.
    shotIds: function () {
      return Object.keys(local._data)
        .filter(function (k) {
          return k.indexOf('shot:') === 0;
        })
        .map(function (k) {
          return k.slice(5);
        });
    }
  };
})(globalThis);
