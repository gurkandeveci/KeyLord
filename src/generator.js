// Rastgele şifre ve PIN üretir. Tarayıcıdan bağımsızdır; eklentide ve testlerde aynı dosya kullanılır.
(function (g) {
  'use strict';
  if (g.KeyLordGenerator) return; // çift yükleme koruması

  var LOWER = 'abcdefghijklmnopqrstuvwxyz';
  var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var DIGITS = '0123456789';
  var AMBIGUOUS = '0Oo1lI'; // birbirine benzeyen karakterler

  var SYMBOL_SETS = {
    // Linux konsolunda sorunsuz yazılan semboller.
    cli: '!@%_-+=.,:',
    // Tüm yazdırılabilir semboller; ^ ~ ` ölü tuş yaptığı için yok.
    all: '!"#$%&\'()*+,-./:;<=>?@[\\]_{|}'
  };

  var DEFAULTS = {
    kind: 'random',
    length: 20,
    pinLength: 6,
    digits: true,
    symbols: true,
    symbolSet: 'cli',
    avoidAmbiguous: true
  };

  // 0 <= n < max; crypto.getRandomValues + reddetme örneklemesi (modulo yanlılığı yok).
  function randomInt(max) {
    var c = g.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('Güvenli rastgele sayı üreteci yok');
    }
    if (!(max > 0) || max > 0x100000000) throw new RangeError('max geçersiz');
    var limit = 0x100000000 - (0x100000000 % max);
    var buf = new Uint32Array(1);
    do {
      c.getRandomValues(buf);
    } while (buf[0] >= limit);
    return buf[0] % max;
  }

  function clamp(n, min, max, fallback) {
    n = Math.floor(Number(n));
    if (!isFinite(n)) n = fallback;
    return Math.max(min, Math.min(max, n));
  }

  function without(chars, bad) {
    var out = '';
    for (var i = 0; i < chars.length; i++) {
      if (bad.indexOf(chars[i]) < 0) out += chars[i];
    }
    return out;
  }

  function pick(chars, rnd) {
    return chars.charAt(rnd(chars.length));
  }

  function generate(options, rnd) {
    var o = {};
    var k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    for (k in options || {}) if (options[k] !== undefined) o[k] = options[k];
    rnd = rnd || randomInt;

    var i;
    var out = [];

    if (o.kind === 'pin') {
      var pl = clamp(o.pinLength, 4, 12, DEFAULTS.pinLength);
      for (i = 0; i < pl; i++) out.push(pick(DIGITS, rnd));
      return out.join('');
    }

    var len = clamp(o.length, 8, 64, DEFAULTS.length);
    var groups = [LOWER, UPPER];
    if (o.digits) groups.push(DIGITS);
    if (o.symbols) groups.push(SYMBOL_SETS[o.symbolSet] || SYMBOL_SETS.cli);
    if (o.avoidAmbiguous) {
      groups = groups.map(function (grp) { return without(grp, AMBIGUOUS); });
    }

    var all = groups.join('');
    // Her etkin gruptan en az bir karakter, kalanı birleşik kümeden.
    for (i = 0; i < groups.length; i++) out.push(pick(groups[i], rnd));
    while (out.length < len) out.push(pick(all, rnd));

    // Fisher–Yates karıştırma.
    for (i = out.length - 1; i > 0; i--) {
      var j = rnd(i + 1);
      var t = out[i];
      out[i] = out[j];
      out[j] = t;
    }
    return out.join('');
  }

  g.KeyLordGenerator = {
    generate: generate,
    randomInt: randomInt,
    DEFAULTS: DEFAULTS,
    SYMBOL_SETS: SYMBOL_SETS
  };
})(globalThis);
