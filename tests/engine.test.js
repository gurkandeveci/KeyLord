(function () {
  var E = globalThis.KeyLordEngine;

  var SHIFT = 0x2a;

  function recorder() {
    var log = [];
    return {
      log: log,
      send: function (scan, down) {
        log.push(['key', scan, down]);
      },
      sleep: function (ms) {
        log.push(['sleep', ms]);
        return Promise.resolve();
      }
    };
  }

  function keysOnly(log) {
    return log
      .filter(function (entry) {
        return entry[0] === 'key';
      })
      .map(function (entry) {
        return [entry[1], entry[2]];
      });
  }

  var typeA = [[SHIFT, 1], [0x1e, 1], [0x1e, 0], [SHIFT, 0]];
  var typeB = [[0x30, 1], [0x30, 0]];

  test('runStrokes olayları verilen sırayla gönderir', async function () {
    var r = recorder();
    await E.runStrokes([typeA, typeB], { send: r.send, sleep: r.sleep, strokeDelay: 30, eventGap: 5 });
    assertEqual(keysOnly(r.log), typeA.concat(typeB));
  });

  test('runStrokes olaylar arasında eventGap, vuruşlar arasında strokeDelay bekler', async function () {
    var r = recorder();
    await E.runStrokes([typeB, typeB], { send: r.send, sleep: r.sleep, strokeDelay: 30, eventGap: 5 });
    assertEqual(r.log, [
      ['key', 0x30, 1],
      ['sleep', 5],
      ['key', 0x30, 0],
      ['sleep', 30],
      ['key', 0x30, 1],
      ['sleep', 5],
      ['key', 0x30, 0]
    ]);
  });

  test('runStrokes tamamlanınca gönderilen vuruş sayısını döndürür', async function () {
    var r = recorder();
    var result = await E.runStrokes([typeA, typeB], { send: r.send, sleep: r.sleep, strokeDelay: 1, eventGap: 1 });
    assertEqual(result, { sent: 2, total: 2, cancelled: false });
  });

  test('runStrokes her vuruştan sonra ilerleme bildirir', async function () {
    var r = recorder();
    var progress = [];
    await E.runStrokes([typeA, typeB, typeB], {
      send: r.send,
      sleep: r.sleep,
      strokeDelay: 1,
      eventGap: 1,
      onProgress: function (done, total) {
        progress.push([done, total]);
      }
    });
    assertEqual(progress, [[1, 3], [2, 3], [3, 3]]);
  });

  test('vuruşlar arasında iptal edilince kalanlar gönderilmez', async function () {
    var r = recorder();
    var cancelled = false;
    var result = await E.runStrokes([typeB, typeA, typeB], {
      send: r.send,
      sleep: r.sleep,
      strokeDelay: 1,
      eventGap: 1,
      isCancelled: function () {
        return cancelled;
      },
      onProgress: function (done) {
        if (done === 1) cancelled = true;
      }
    });
    assertEqual(keysOnly(r.log), typeB);
    assertEqual(result, { sent: 1, total: 3, cancelled: true });
  });

  test('vuruşun ortasında iptal edilince basılı kalan tuşlar bırakılır', async function () {
    var log = [];
    var cancelled = false;
    var result = await E.runStrokes([typeA, typeB], {
      send: function (scan, down) {
        log.push([scan, down]);
        if (scan === 0x1e && down === 1) cancelled = true; // Shift ve A basılıyken iptal
      },
      sleep: function () {
        return Promise.resolve();
      },
      strokeDelay: 1,
      eventGap: 1,
      isCancelled: function () {
        return cancelled;
      }
    });
    assertEqual(log, [[SHIFT, 1], [0x1e, 1], [0x1e, 0], [SHIFT, 0]]);
    assertEqual(result, { sent: 0, total: 2, cancelled: true });
  });

  test('gönderim hata verirse basılı tuşlar bırakılır ve hata yukarı iletilir', async function () {
    var log = [];
    var failOnce = true;
    var caught = null;
    try {
      await E.runStrokes([typeA], {
        send: function (scan, down) {
          if (scan === 0x1e && down === 1 && failOnce) {
            failOnce = false;
            throw new Error('bağlantı koptu');
          }
          log.push([scan, down]);
        },
        sleep: function () {
          return Promise.resolve();
        },
        strokeDelay: 1,
        eventGap: 1
      });
    } catch (err) {
      caught = err;
    }
    assertTrue(caught && caught.message === 'bağlantı koptu', 'hata iletilmeli');
    assertEqual(log, [[SHIFT, 1], [SHIFT, 0]]);
  });

  // ---- Konsol nesnesini bulma ----
  function fakeDecoder() {
    return { onKeyVScan: function () {} };
  }

  test('pickDecoders: _vncDecoder taşıyan WMKS nesnesinden çözücüyü alır', function () {
    var decoder = fakeDecoder();
    var found = E.pickDecoders([{ _vncDecoder: decoder, options: {} }]);
    assertTrue(found.length === 1 && found[0] === decoder);
  });

  test('pickDecoders: createWMKS sarmalayıcısındaki wmksData içinden çözücüyü alır', function () {
    var decoder = fakeDecoder();
    var found = E.pickDecoders([{ wmksData: { _vncDecoder: decoder } }]);
    assertTrue(found.length === 1 && found[0] === decoder);
  });

  test('pickDecoders: ilgisiz değerleri ve onKeyVScan içermeyenleri atlar', function () {
    var found = E.pickDecoders([null, 5, 'metin', {}, { _vncDecoder: {} }, { _vncDecoder: null }]);
    assertEqual(found.length, 0);
  });

  test('pickDecoders: aynı çözücüyü bir kez döndürür', function () {
    var decoder = fakeDecoder();
    var widget = { _vncDecoder: decoder };
    var found = E.pickDecoders([widget, { wmksData: widget }, widget]);
    assertEqual(found.length, 1);
  });
})();
