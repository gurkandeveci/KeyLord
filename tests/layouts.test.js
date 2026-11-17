(function () {
  var L = globalThis.KeyLordLayouts;

  var SHIFT = 0x2a;
  var ALTGR = 0x138;
  var ENTER = 0x1c;
  var TAB = 0x0f;
  var SPACE = 0x39;

  function tap(scan) {
    return [[scan, 1], [scan, 0]];
  }
  function withMod(mod, scan) {
    return [[mod, 1], [scan, 1], [scan, 0], [mod, 0]];
  }
  function plan(text, layout, extra) {
    var options = { layout: layout, deadKeyFix: 'off', appendEnter: false };
    for (var k in extra || {}) options[k] = extra[k];
    return L.planKeys(text, options);
  }
  function strokes(text, layout, extra) {
    return plan(text, layout, extra).strokes;
  }

  // ---- US düzeni ----
  test('US: küçük harf tek tuş basıp bırakır', function () {
    assertEqual(strokes('a', 'us'), [tap(0x1e)]);
  });

  test('US: büyük harf Shift ile sarılır', function () {
    assertEqual(strokes('A', 'us'), [withMod(SHIFT, 0x1e)]);
  });

  test('US: @ işareti Shift+2 olur', function () {
    assertEqual(strokes('@', 'us'), [withMod(SHIFT, 0x03)]);
  });

  test('US: ters bölü ve dikey çizgi aynı tuştadır', function () {
    assertEqual(strokes('\\|', 'us'), [tap(0x2b), withMod(SHIFT, 0x2b)]);
  });

  test('US: boşluk karakteri boşluk tuşudur', function () {
    assertEqual(strokes(' ', 'us'), [tap(SPACE)]);
  });

  // ---- Türkçe Q düzeni ----
  test('TRQ: @ işareti AltGr+Q olur', function () {
    assertEqual(strokes('@', 'trq'), [withMod(ALTGR, 0x10)]);
  });

  test('TRQ: noktalı ve noktasız i ayrı tuşlardadır', function () {
    assertEqual(strokes('ıiIİ', 'trq'), [
      tap(0x17),
      tap(0x28),
      withMod(SHIFT, 0x17),
      withMod(SHIFT, 0x28)
    ]);
  });

  test('TRQ: Türkçe harfler kendi tuşlarına gider', function () {
    assertEqual(strokes('ğüşöç', 'trq'), [tap(0x1a), tap(0x1b), tap(0x27), tap(0x33), tap(0x34)]);
  });

  test('TRQ: büyük Türkçe harfler Shift ile gider', function () {
    assertEqual(strokes('ĞÜŞÖÇ', 'trq'), [
      withMod(SHIFT, 0x1a),
      withMod(SHIFT, 0x1b),
      withMod(SHIFT, 0x27),
      withMod(SHIFT, 0x33),
      withMod(SHIFT, 0x34)
    ]);
  });

  test('TRQ: ters bölü ve dikey çizgi AltGr ile üst sıradadır', function () {
    assertEqual(strokes('\\|', 'trq'), [withMod(ALTGR, 0x0c), withMod(ALTGR, 0x0d)]);
  });

  test('TRQ: süslü ve köşeli parantezler AltGr+7/8/9/0 olur', function () {
    assertEqual(strokes('{[]}', 'trq'), [
      withMod(ALTGR, 0x08),
      withMod(ALTGR, 0x09),
      withMod(ALTGR, 0x0a),
      withMod(ALTGR, 0x0b)
    ]);
  });

  test('TRQ: küçüktür ve büyüktür Z yanındaki tuştadır', function () {
    assertEqual(strokes('<>', 'trq'), [tap(0x56), withMod(SHIFT, 0x56)]);
  });

  test('TRQ: nokta, virgül, iki nokta, noktalı virgül', function () {
    assertEqual(strokes('.,:;', 'trq'), [
      tap(0x35),
      tap(0x2b),
      withMod(SHIFT, 0x35),
      withMod(SHIFT, 0x2b)
    ]);
  });

  test('TRQ: tırnaklar, diyez ve dolar', function () {
    assertEqual(strokes('"\'#$', 'trq'), [
      tap(0x29),
      withMod(SHIFT, 0x03),
      withMod(ALTGR, 0x04),
      withMod(ALTGR, 0x05)
    ]);
  });

  test('TRQ: eksi, alt çizgi, yıldız, soru işareti, eşittir, bölü', function () {
    assertEqual(strokes('-_*?=/', 'trq'), [
      tap(0x0d),
      withMod(SHIFT, 0x0d),
      tap(0x0c),
      withMod(SHIFT, 0x0c),
      withMod(SHIFT, 0x0b),
      withMod(SHIFT, 0x08)
    ]);
  });

  // ---- Satır sonu ve sekme ----
  test('satır sonu Enter tuşuna çevrilir', function () {
    assertEqual(strokes('a\nb', 'us'), [tap(0x1e), tap(ENTER), tap(0x30)]);
  });

  test('Windows satır sonu (CRLF) tek Enter olur', function () {
    assertEqual(strokes('a\r\nb', 'us'), [tap(0x1e), tap(ENTER), tap(0x30)]);
  });

  test('sekme karakteri Tab tuşuna çevrilir', function () {
    assertEqual(strokes('\t', 'trq'), [tap(TAB)]);
  });

  test('appendEnter seçeneği sona Enter ekler', function () {
    assertEqual(strokes('a', 'us', { appendEnter: true }), [tap(0x1e), tap(ENTER)]);
  });

  // ---- Desteklenmeyen karakterler ----
  test('düzende olmayan karakterler unsupported listesinde bildirilir', function () {
    var result = plan('aşb☺ş', 'us');
    assertEqual(result.unsupported, ['ş', '☺']);
  });

  test('desteklenen metinde unsupported boştur', function () {
    assertEqual(plan('Merhaba Dünya', 'trq').unsupported, []);
  });

  test('yazdırılabilir tüm ASCII karakterleri iki düzende de desteklenir', function () {
    var ascii = '';
    for (var c = 32; c < 127; c++) ascii += String.fromCharCode(c);
    assertEqual(plan(ascii, 'us').unsupported, [], 'us');
    assertEqual(plan(ascii, 'trq').unsupported, [], 'trq');
    assertEqual(plan(ascii, 'us').strokes.length, 95, 'us vuruş sayısı');
    assertEqual(plan(ascii, 'trq').strokes.length, 95, 'trq vuruş sayısı');
  });

  // ---- Ölü tuş düzeltmesi (Türkçe Q) ----
  test('ölü tuş düzeltmesi kapalıyken ^ sonrası boşluk basılmaz', function () {
    assertEqual(strokes('^', 'trq'), [withMod(SHIFT, 0x04)]);
  });

  test('Windows düzeltmesi ^ ~ ` sonrasında boşluk basar', function () {
    assertEqual(strokes('^~`', 'trq', { deadKeyFix: 'windows' }), [
      withMod(SHIFT, 0x04),
      tap(SPACE),
      withMod(ALTGR, 0x1b),
      tap(SPACE),
      withMod(ALTGR, 0x2b),
      tap(SPACE)
    ]);
  });

  test('Linux düzeltmesi yalnızca ^ sonrasında boşluk basar', function () {
    assertEqual(strokes('^~`', 'trq', { deadKeyFix: 'linux' }), [
      withMod(SHIFT, 0x04),
      tap(SPACE),
      withMod(ALTGR, 0x1b),
      withMod(ALTGR, 0x2b)
    ]);
  });

  test('US düzeninde ölü tuş düzeltmesi hiçbir şey eklemez', function () {
    assertEqual(strokes('^~`', 'us', { deadKeyFix: 'windows' }), [
      withMod(SHIFT, 0x07),
      withMod(SHIFT, 0x29),
      tap(0x29)
    ]);
  });

  // ---- Özel tuşlar ----
  test('özel tuşlar: Tab, Enter, Esc', function () {
    assertEqual(L.SPECIAL_KEYS.tab, tap(TAB));
    assertEqual(L.SPECIAL_KEYS.enter, tap(ENTER));
    assertEqual(L.SPECIAL_KEYS.esc, tap(0x01));
  });

  test('özel tuşlar: Ctrl+Alt+Del sırayla basıp ters sırayla bırakır', function () {
    assertEqual(L.SPECIAL_KEYS.cad, [
      [0x1d, 1],
      [0x38, 1],
      [0x153, 1],
      [0x153, 0],
      [0x38, 0],
      [0x1d, 0]
    ]);
  });
})();
