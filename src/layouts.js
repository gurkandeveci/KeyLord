// Metni, hedef sanal makinenin klavye düzenine göre ham tuş kodlarına (PC scancode set 1) çevirir.
// Tarayıcıdan bağımsızdır; hem eklentide hem testlerde aynı dosya kullanılır.
(function (g) {
  'use strict';

  var SHIFT = 0x2a; // Sol Shift
  var ALTGR = 0x138; // Sağ Alt (genişletilmiş kodlar 0x100 ile işaretlenir)
  var CTRL = 0x1d;
  var ALT = 0x38;
  var ENTER = 0x1c;
  var TAB = 0x0f;
  var ESC = 0x01;
  var SPACE = 0x39;
  var DELETE = 0x153;

  // Her satır: [ilk tuş kodu, düz, Shift ile, AltGr ile]. Karakterler soldan sağa ardışık tuşlardır.
  // Boşluk karakteri "bu tuşta bu seviyede bir şey yok" demektir.
  var ROWS = {
    us: [
      [0x02, '1234567890-=', '!@#$%^&*()_+'],
      [0x10, 'qwertyuiop[]', 'QWERTYUIOP{}'],
      [0x1e, "asdfghjkl;'`", 'ASDFGHJKL:"~'],
      [0x2b, '\\zxcvbnm,./', '|ZXCVBNM<>?']
    ],
    trq: [
      [0x02, '1234567890*-', "!'^+%&/()=?_", '>£#$½ {[]}\\|'],
      [0x10, 'qwertyuıopğü', 'QWERTYUIOPĞÜ', '@ €        ~'],
      [0x1e, 'asdfghjklşi"', 'ASDFGHJKLŞİé'],
      [0x2b, ',zxcvbnmöç.', ';ZXCVBNMÖÇ:', '`'],
      [0x56, '<', '>', '|']
    ]
  };

  // Hedef sistemde "ölü tuş" olan karakterler: ardından boşluk basılmazsa ekrana çıkmazlar.
  var DEAD_KEYS = {
    trq: { windows: '^~`', linux: '^' }
  };

  // Bir karakter birden fazla yerde varsa en az değiştirici tuş gerektiren kazanır:
  // önce düz, sonra Shift, sonra AltGr; aynı seviyede ilk yazılan satır.
  function buildMap(rows) {
    var map = {};
    var modifiers = [null, SHIFT, ALTGR];
    for (var level = 0; level < modifiers.length; level++) {
      for (var r = 0; r < rows.length; r++) {
        var chars = Array.from(rows[r][level + 1] || '');
        for (var i = 0; i < chars.length; i++) {
          var ch = chars[i];
          if (ch === ' ' || map[ch]) continue;
          map[ch] = { scan: rows[r][0] + i, mod: modifiers[level] };
        }
      }
    }
    return map;
  }

  var MAPS = { us: buildMap(ROWS.us), trq: buildMap(ROWS.trq) };

  function tap(scan) {
    return [[scan, 1], [scan, 0]];
  }

  function press(key) {
    if (!key.mod) return tap(key.scan);
    return [[key.mod, 1], [key.scan, 1], [key.scan, 0], [key.mod, 0]];
  }

  // text: gönderilecek metin
  // options: { layout: 'us' | 'trq', deadKeyFix: 'windows' | 'linux' | 'off', appendEnter: boolean }
  // Dönen değer: { strokes, unsupported }
  //   strokes: her karakter için [[tuşKodu, 1=bas | 0=bırak], ...] dizisi
  //   unsupported: seçili düzende yazılamayan karakterler (varsa hiçbir şey gönderilmemelidir)
  function planKeys(text, options) {
    var map = MAPS[options.layout];
    if (!map) throw new Error('Bilinmeyen klavye düzeni: ' + options.layout);
    var dead = (DEAD_KEYS[options.layout] || {})[options.deadKeyFix] || '';

    var strokes = [];
    var unsupported = [];
    var chars = Array.from(String(text).replace(/\r\n?/g, '\n'));

    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === '\n') {
        strokes.push(tap(ENTER));
      } else if (ch === '\t') {
        strokes.push(tap(TAB));
      } else if (ch === ' ') {
        strokes.push(tap(SPACE));
      } else if (map[ch]) {
        strokes.push(press(map[ch]));
        if (dead.indexOf(ch) !== -1) strokes.push(tap(SPACE));
      } else if (unsupported.indexOf(ch) === -1) {
        unsupported.push(ch);
      }
    }

    if (options.appendEnter) strokes.push(tap(ENTER));
    return { strokes: strokes, unsupported: unsupported };
  }

  g.KeyLordLayouts = {
    planKeys: planKeys,
    SPECIAL_KEYS: {
      tab: tap(TAB),
      enter: tap(ENTER),
      esc: tap(ESC),
      cad: [[CTRL, 1], [ALT, 1], [DELETE, 1], [DELETE, 0], [ALT, 0], [CTRL, 0]]
    }
  };
})(globalThis);
