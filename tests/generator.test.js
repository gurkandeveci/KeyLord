(function () {
  var G = globalThis.KeyLordGenerator;
  var L = globalThis.KeyLordLayouts;

  // Deterministik, ama çeşitli değer üreten sayaç (doğrusal eşlenik üreteç).
  function seq(seed) {
    var s = seed || 12345;
    return function (max) {
      s = (s * 1103515245 + 12345) % 2147483648;
      return Math.floor(s / 7) % max;
    };
  }
  function loop(fn) {
    for (var i = 1; i <= 200; i++) fn(seq(i * 977), i);
  }

  test('üretici: varsayılan 20 karakter', function () {
    assertEqual(G.generate({}, seq()).length, 20);
  });

  test('üretici: uzunluk 8-64 arasına kıstırılır', function () {
    assertEqual(G.generate({ length: 3 }, seq()).length, 8);
    assertEqual(G.generate({ length: 500 }, seq()).length, 64);
  });

  test('üretici: PIN yalnızca rakam, 4-12', function () {
    assertTrue(/^\d{6}$/.test(G.generate({ kind: 'pin' }, seq())));
    assertEqual(G.generate({ kind: 'pin', pinLength: 1 }, seq()).length, 4);
    assertEqual(G.generate({ kind: 'pin', pinLength: 99 }, seq()).length, 12);
  });

  test('üretici: seçili her gruptan en az bir karakter', function () {
    var cli = new RegExp('[' + G.SYMBOL_SETS.cli.replace(/[\\\]\-^]/g, '\\$&') + ']');
    loop(function (r) {
      var p = G.generate({ length: 8 }, r);
      assertTrue(/[a-z]/.test(p));
      assertTrue(/[A-Z]/.test(p));
      assertTrue(/\d/.test(p));
      assertTrue(cli.test(p));
    });
  });

  test('üretici: rakam/sembol kapalıysa hiç yok', function () {
    loop(function (r) {
      assertTrue(/^[A-Za-z]+$/.test(G.generate({ digits: false, symbols: false }, r)));
    });
  });

  test('üretici: CLI kümesi tam olarak !@%_-+=.,:', function () {
    assertEqual(G.SYMBOL_SETS.cli, '!@%_-+=.,:');
  });

  test('üretici: tüm semboller ^ ~ ` içermez', function () {
    assertTrue(!/[\^~`]/.test(G.SYMBOL_SETS.all));
  });

  test('üretici: benzer karakterler varsayılan hariç', function () {
    loop(function (r) {
      assertTrue(!/[0Oo1lI]/.test(G.generate({ symbolSet: 'all' }, r)));
    });
  });

  test('üretici: avoidAmbiguous kapalıyken de uzunluk korunur', function () {
    assertEqual(G.generate({ avoidAmbiguous: false }, seq()).length, 20);
  });

  test('üretici: varsayılan randomInt aralık içinde döner', function () {
    if (!(globalThis.crypto && globalThis.crypto.getRandomValues)) return;
    for (var i = 0; i < 200; i++) {
      var n = G.randomInt(7);
      assertTrue(n >= 0 && n < 7);
    }
    assertEqual(G.generate({}).length, 20);
  });

  test('üretici: her çıktı TR-Q ve US ile ölü tuşsuz yazılabilir', function () {
    ['us', 'trq'].forEach(function (layout) {
      loop(function (r) {
        var p = G.generate({ symbolSet: 'all', avoidAmbiguous: false }, r);
        var res = L.planKeys(p, { layout: layout, deadKeyFix: 'off', appendEnter: false });
        assertEqual(res.unsupported.length, 0);
      });
    });
  });
})();
