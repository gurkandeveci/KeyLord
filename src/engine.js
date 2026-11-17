// Sayfanın kendi JavaScript dünyasında (MAIN world) çalışır: vCenter web konsolunun WMKS nesnesini
// bulur ve tuş kodlarını doğrudan sanal makineye yollar. Diyalogla CustomEvent üzerinden konuşur.
(function (g) {
  'use strict';

  if (g.KeyLordEngine) return; // Aynı sayfaya ikinci kez eklenirse tekrar kurma.

  // ---------- Saf mantık (testlerde doğrudan kullanılır) ----------

  // strokes: [[[tuşKodu, 1|0], ...], ...]
  // o: { send(scan, down), sleep(ms), strokeDelay, eventGap, isCancelled?(), onProgress?(done, total) }
  // İptal ya da hata durumunda sanal makinede basılı kalan tuşları mutlaka bırakır.
  async function runStrokes(strokes, o) {
    var held = [];
    var sent = 0;
    var total = strokes.length;

    function isCancelled() {
      return !!(o.isCancelled && o.isCancelled());
    }
    function releaseHeld() {
      while (held.length) {
        var scan = held.pop();
        try {
          o.send(scan, 0);
        } catch (err) {
          // Bırakma sırasında yapılabilecek bir şey yok; kalanları denemeye devam et.
        }
      }
    }
    function stopped() {
      releaseHeld();
      return { sent: sent, total: total, cancelled: true };
    }

    try {
      for (var i = 0; i < total; i++) {
        if (isCancelled()) return stopped();
        if (i > 0) {
          await o.sleep(o.strokeDelay);
          if (isCancelled()) return stopped();
        }
        var stroke = strokes[i];
        for (var j = 0; j < stroke.length; j++) {
          if (j > 0) {
            await o.sleep(o.eventGap);
            if (isCancelled()) return stopped();
          }
          var scan = stroke[j][0];
          var down = stroke[j][1];
          o.send(scan, down);
          if (down) {
            held.push(scan);
          } else {
            var at = held.lastIndexOf(scan);
            if (at !== -1) held.splice(at, 1);
          }
        }
        sent++;
        if (o.onProgress) o.onProgress(sent, total);
      }
      return { sent: sent, total: total, cancelled: false };
    } catch (err) {
      releaseHeld();
      throw err;
    }
  }

  // Verilen değerler arasından WMKS çözücülerini (onKeyVScan sahibi nesneleri) ayıklar.
  // Değer ya WMKS bileşeninin kendisidir (_vncDecoder) ya da createWMKS sarmalayıcısıdır (wmksData).
  function pickDecoders(candidates) {
    var found = [];
    for (var i = 0; i < candidates.length; i++) {
      var decoder = null;
      try {
        var value = candidates[i];
        if (!value || typeof value !== 'object') continue;
        decoder = value._vncDecoder || (value.wmksData && value.wmksData._vncDecoder) || null;
        if (!decoder || typeof decoder.onKeyVScan !== 'function') continue;
      } catch (err) {
        continue; // Erişimi yasak nesneler (ör. başka kökenli pencere) atlanır.
      }
      if (found.indexOf(decoder) === -1) found.push(decoder);
    }
    return found;
  }

  g.KeyLordEngine = { runStrokes: runStrokes, pickDecoders: pickDecoders };

  if (typeof document === 'undefined') return; // Test ortamı: sayfa bağlantısı yok.

  // ---------- Sayfa bağlantısı ----------

  var lastUsedCanvas = null;
  var active = null; // { id, cancelled }

  // Bir elemana jQuery'nin iliştirdiği veri değerleri (WMKS, jQuery UI bileşeni olarak burada durur).
  function attachedValues(el) {
    var values = [];
    function addAll(obj) {
      if (!obj || typeof obj !== 'object') return;
      for (var key in obj) {
        try {
          values.push(obj[key]);
        } catch (err) {}
      }
    }
    try {
      var jq = g.jQuery || g.$;
      if (jq && typeof jq.data === 'function') addAll(jq.data(el));
    } catch (err) {}
    try {
      // jQuery 2+/3+: veri, eleman üzerinde "jQuery<sayılar>" adlı özellikte tutulur (jQuery global olmasa da).
      var names = Object.getOwnPropertyNames(el);
      for (var i = 0; i < names.length; i++) {
        if (/^jQuery\d/.test(names[i])) addAll(el[names[i]]);
      }
    } catch (err) {}
    return values;
  }

  function isVisible(el) {
    return !!(el && el.getClientRects && el.getClientRects().length);
  }

  // Sayfadaki konsolları bulur: [{ decoder, canvas }]
  function findConsoles() {
    var consoles = [];
    var canvases = document.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var node = canvases[i];
      for (var depth = 0; node && node !== document && depth < 8; depth++, node = node.parentNode) {
        var decoders = pickDecoders(attachedValues(node));
        if (decoders.length) {
          consoles.push({ decoder: decoders[0], canvas: canvases[i] });
          break;
        }
      }
    }
    if (!consoles.length) {
      // Yedek yol: konsol nesnesi global bir değişkende tutuluyor olabilir (ör. var wmks = WMKS.createWMKS(...)).
      var globals = [];
      var names = Object.getOwnPropertyNames(g);
      for (var n = 0; n < names.length; n++) {
        if (!/wmks|console|mks|vm/i.test(names[n])) continue;
        try {
          globals.push(g[names[n]]);
        } catch (err) {}
      }
      var fromGlobals = pickDecoders(globals);
      for (var d = 0; d < fromGlobals.length; d++) {
        consoles.push({ decoder: fromGlobals[d], canvas: document.getElementById('mainCanvas') });
      }
    }
    return consoles;
  }

  // Birden fazla konsol varsa: son tıklanan, yoksa görünür olan, yoksa ilki.
  function chooseConsole() {
    var consoles = findConsoles();
    if (!consoles.length) return null;
    var visible = consoles.filter(function (c) {
      return isVisible(c.canvas);
    });
    var pool = visible.length ? visible : consoles;
    for (var i = 0; i < pool.length; i++) {
      if (pool[i].canvas && pool[i].canvas === lastUsedCanvas) return pool[i];
    }
    return pool[0];
  }

  function isConnected(decoder) {
    return decoder._serverInitialized !== false;
  }

  function status() {
    var chosen = chooseConsole();
    return {
      type: 'status',
      consoles: findConsoles().length,
      connected: !!chosen && isConnected(chosen.decoder)
    };
  }

  function emit(message) {
    document.dispatchEvent(new CustomEvent('keylord:evt', { detail: JSON.stringify(message) }));
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function handleSend(message) {
    var id = message.id;
    if (active) {
      emit({ type: 'error', id: id, code: 'busy' });
      return;
    }
    var chosen = chooseConsole();
    if (!chosen) {
      emit({ type: 'error', id: id, code: 'no-console' });
      return;
    }
    if (!isConnected(chosen.decoder)) {
      emit({ type: 'error', id: id, code: 'not-connected' });
      return;
    }

    var job = { id: id, cancelled: false };
    active = job;
    try {
      var result = await runStrokes(message.strokes, {
        send: function (scan, down) {
          chosen.decoder.onKeyVScan(scan, down ? 1 : 0);
        },
        sleep: sleep,
        strokeDelay: message.strokeDelay,
        eventGap: message.eventGap,
        isCancelled: function () {
          return job.cancelled;
        },
        onProgress: function (done, total) {
          emit({ type: 'progress', id: id, done: done, total: total });
        }
      });
      emit({ type: 'done', id: id, sent: result.sent, total: result.total, cancelled: result.cancelled });
    } catch (err) {
      emit({ type: 'error', id: id, code: 'send-failed', message: String((err && err.message) || err) });
    } finally {
      active = null;
    }
  }

  document.addEventListener('keylord:cmd', function (event) {
    var message;
    try {
      message = JSON.parse(event.detail);
    } catch (err) {
      return;
    }
    if (!message) return;
    if (message.type === 'detect') emit(status());
    else if (message.type === 'cancel' && active) active.cancelled = true;
    else if (message.type === 'send') handleSend(message);
  });

  document.addEventListener(
    'mousedown',
    function (event) {
      if (event.target && event.target.tagName === 'CANVAS') lastUsedCanvas = event.target;
    },
    true
  );

  g.KeyLordEngine.consoleCount = function () {
    return findConsoles().length;
  };
})(globalThis);
