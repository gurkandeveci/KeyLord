// "KeyLord" kutusu. Eklentinin yalıtılmış dünyasında çalışır; metni tuş vuruşlarına çevirir
// (layouts.js) ve sayfa dünyasındaki motora (engine.js) CustomEvent ile iletir.
// Konsol sekmesinde yazılan metin hiçbir yere kaydedilmez; yalnızca gönderim ayarları saklanır.
// Şifre sekmesinde üretilen şifre, gönderilmeden/kopyalanmadan ÖNCE arka plana (service worker)
// kaydettirilir; arka plan onu kasanın açık anahtarıyla şifreler. Kayıt yazılamazsa hiçbir şey gönderilmez.
(function () {
  'use strict';

  if (window.__keyLordDialog) return;

  var L = globalThis.KeyLordLayouts;
  var G = globalThis.KeyLordGenerator;
  var R = globalThis.KeyLordRecords;
  var F = globalThis.KeyLordFieldFill;

  // strokeDelay: karakterler arası bekleme; eventGap: tek karakterin bas/bırak adımları arası bekleme (ms)
  var SPEEDS = {
    fast: { strokeDelay: 10, eventGap: 5 },
    normal: { strokeDelay: 30, eventGap: 10 },
    slow: { strokeDelay: 80, eventGap: 20 },
    verySlow: { strokeDelay: 200, eventGap: 40 }
  };

  var DEFAULTS = {
    layout: 'trq',
    deadKeyFix: 'windows',
    speed: 'normal',
    appendEnter: false,
    clearAfter: true,
    hideText: false,
    tab: 'console' // 'console' | 'password'
    // gen: üretici ayarları (KeyLordGenerator.DEFAULTS üzerine birleştirilir)
  };

  var ERRORS = {
    'no-console':
      'Bu sayfada vCenter konsolu bulunamadı. Kutuyu sanal makinenin web konsolu sekmesinde açın.',
    'not-connected': 'Konsol sanal makineye bağlı değil. Bağlantı kurulunca tekrar deneyin.',
    busy: 'Devam eden bir gönderim var.',
    'send-failed': 'Gönderim sırasında hata oluştu'
  };

  var FILL_ERROR = 'Doldurulacak boş şifre alanı bulunamadı. Alana tıklayıp tekrar deneyin.';

  var CSS = [
    ':host { all: initial; }',
    '.panel { --bg:#ffffff; --fg:#1b1f24; --muted:#5c6570; --line:#d5dae0; --field:#f6f8fa;',
    '  --accent:#0b62d6; --accent-fg:#ffffff; --ok:#1a7f37; --err:#c62828; --sel:#e3edfb;',
    '  box-sizing:border-box; display:flex; width:400px; max-width:calc(100vw - 16px); background:var(--bg);',
    '  color:var(--fg); border:1px solid var(--line); border-radius:10px; box-shadow:0 10px 32px rgba(0,0,0,.28);',
    '  font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; overflow:hidden; }',
    '@media (prefers-color-scheme: dark) { .panel { --bg:#1f2329; --fg:#e7eaee; --muted:#9aa4af; --line:#3a414a;',
    '  --field:#2a3038; --accent:#4c9aff; --accent-fg:#0b1220; --ok:#56d364; --err:#ff7b72; --sel:#26354a; } }',
    '.panel * { box-sizing:border-box; font:inherit; color:inherit; }',
    '.rail { flex:0 0 auto; display:flex; flex-direction:column; gap:4px; padding:8px 4px;',
    '  border-right:1px solid var(--line); background:var(--field); }',
    'button.tab { width:34px; height:34px; border:1px solid transparent; border-radius:8px; background:transparent;',
    '  cursor:pointer; font-size:17px; line-height:1; padding:0; }',
    'button.tab:hover { border-color:var(--line); background:var(--bg); }',
    'button.tab.selected { background:var(--sel); border-color:var(--accent); }',
    '.main { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }',
    '.title { display:flex; align-items:center; justify-content:space-between; padding:8px 8px 8px 12px;',
    '  border-bottom:1px solid var(--line); cursor:move; user-select:none; font-weight:600; }',
    '.heading { display:flex; flex-direction:column; min-width:0; }',
    '.origin { font-weight:400; font-size:11.5px; color:var(--muted); overflow-wrap:anywhere; }',
    '.close { border:0; background:transparent; width:26px; height:26px; border-radius:6px; cursor:pointer;',
    '  font-size:18px; line-height:1; color:var(--muted); }',
    '.close:hover { background:var(--field); color:var(--fg); }',
    '.body { padding:12px 12px 0; display:flex; flex-direction:column; gap:10px; }',
    '.foot { padding:10px 12px 12px; }',
    'textarea { width:100%; min-height:84px; resize:vertical; padding:8px; border:1px solid var(--line);',
    '  border-radius:6px; background:var(--field); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    '  font-size:12.5px; }',
    'textarea.masked, input.masked { -webkit-text-security:disc; }',
    'textarea:focus, select:focus, button:focus-visible, input:focus-visible { outline:2px solid var(--accent);',
    '  outline-offset:1px; }',
    'fieldset { margin:0; padding:8px 10px 10px; border:1px solid var(--line); border-radius:6px;',
    '  display:flex; flex-direction:column; gap:8px; min-width:0; }',
    'fieldset.plain { border:0; padding:0; gap:10px; }',
    'legend { padding:0 4px; color:var(--muted); font-size:12px; }',
    '.field { display:flex; align-items:center; justify-content:space-between; gap:8px; }',
    '.field select, .field input.text { flex:0 1 200px; min-width:0; padding:4px 6px; border:1px solid var(--line);',
    '  border-radius:6px; background:var(--field); }',
    '.field label { white-space:nowrap; }',
    '.field input[type=range] { flex:1 1 auto; min-width:0; accent-color:var(--accent); }',
    '.value { min-width:2.2em; text-align:right; font-variant-numeric:tabular-nums; }',
    '.hint { margin:-4px 0 0; color:var(--muted); font-size:11.5px; }',
    '.hint.below { margin:4px 0 0; }',
    '.check { display:flex; align-items:center; gap:6px; cursor:pointer; }',
    '.check input { margin:0; accent-color:var(--accent); }',
    '.row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }',
    '.group { display:flex; flex-direction:column; gap:8px; }',
    '.seg { display:inline-flex; align-self:flex-start; border:1px solid var(--line); border-radius:6px;',
    '  overflow:hidden; }',
    '.seg label { position:relative; cursor:pointer; }',
    '.seg input { position:absolute; opacity:0; width:1px; height:1px; margin:0; }',
    '.seg span { display:block; padding:4px 14px; background:var(--field); }',
    '.seg label + label span { border-left:1px solid var(--line); }',
    '.seg input:checked + span { background:var(--accent); color:var(--accent-fg); font-weight:600; }',
    '.seg input:focus-visible + span { outline:2px solid var(--accent); outline-offset:-2px; }',
    '.pwrow { display:flex; gap:6px; }',
    '.pwrow input { flex:1 1 auto; min-width:0; padding:6px 8px; border:1px solid var(--line); border-radius:6px;',
    '  background:var(--field); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:13px; }',
    '.notice { border:1px solid var(--err); border-radius:6px; padding:8px 10px; display:flex;',
    '  flex-direction:column; gap:6px; }',
    '.notice strong { color:var(--err); font-weight:600; }',
    'button.btn { padding:5px 10px; border:1px solid var(--line); border-radius:6px; background:var(--field);',
    '  cursor:pointer; }',
    'button.btn:hover:not(:disabled) { border-color:var(--accent); }',
    'button.btn:disabled { opacity:.5; cursor:default; }',
    'button.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); font-weight:600;',
    '  padding:6px 16px; }',
    'button.notice-btn { align-self:flex-start; }',
    '.muted { color:var(--muted); }',
    '.status { min-height:18px; color:var(--muted); overflow-wrap:anywhere; }',
    '.status.ok { color:var(--ok); }',
    '.status.error { color:var(--err); }',
    '.credit { padding-top:8px; border-top:1px solid var(--line); color:var(--muted); font-size:11.5px;',
    '  text-align:center; }',
    '[hidden] { display:none !important; }'
  ].join('\n');

  var settings = Object.assign({}, DEFAULTS);
  normalizeSettings();
  var host = null;
  var ui = {};
  var sending = null; // { id, clearOnDone, onResult, done, total }
  var sequence = 0;
  var detectTimer = null;
  // Konsol bulunup bağlı olduğu doğrulanmadan metin sayfaya hiç iletilmez.
  var ready = false;

  // Şifre sekmesi durumu. Düz şifre ve düz kayıt yalnızca bu şifre gösterildiği sürece bellekte tutulur.
  var current = null; // { password, record }
  var pwBusy = false; // kayıt yazımı / gönderim / görüntü sürüyor
  var vaultState = 'unknown'; // 'unknown' | 'yes' | 'no'
  var focusBeforeOpen = null; // kutu odak almadan önce sayfada odaklı öğe (alan doldurma için)
  // Süren gönder/kopyala işlemi: { aborted }. hide() iptal eder; eski işlemin sonucu yeni şifrenin altına yazılmaz.
  var activeRun = null;

  // ---------- Ayarların saklanması ----------

  function normalizeSettings() {
    if (settings.tab !== 'console' && settings.tab !== 'password') settings.tab = 'console';
    var stored = settings.gen && typeof settings.gen === 'object' ? settings.gen : {};
    settings.gen = Object.assign({}, G.DEFAULTS, stored);
  }

  function loadSettings() {
    try {
      return chrome.storage.local.get('settings').then(
        function (stored) {
          Object.assign(settings, (stored && stored.settings) || {});
          normalizeSettings();
        },
        function () {}
      );
    } catch (err) {
      return Promise.resolve(); // Eklenti yeniden yüklendiyse depolama erişilemez; varsayılanlarla devam.
    }
  }

  function saveSettings() {
    try {
      chrome.storage.local.set({ settings: settings });
    } catch (err) {}
  }

  // ---------- Arka planla haberleşme ----------

  // chrome.runtime kanalı sayfa tarafından dinlenemez. Hata olursa (eklenti yeniden yüklendi vb.)
  // { ok:false } döner; hiçbir zaman atmaz.
  function bg(message) {
    try {
      return Promise.resolve(chrome.runtime.sendMessage(message)).then(
        function (res) {
          return res || { ok: false, error: 'no-response' };
        },
        function () {
          return { ok: false, error: 'no-background' };
        }
      );
    } catch (err) {
      return Promise.resolve({ ok: false, error: 'no-background' });
    }
  }

  function putRecord(record) {
    return bg({ type: 'record:put', id: record.id, record: record }).then(function (res) {
      return !!(res && res.ok);
    });
  }

  function newId() {
    var c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    // Güvenli olmayan (http) sayfalarda randomUUID yoktur; getRandomValues ile v4 UUID üret.
    var b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = Array.prototype.map.call(b, function (x) {
      return (x < 16 ? '0' : '') + x.toString(16);
    }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  // ---------- Arayüz ----------

  function el(tag, props, children) {
    var node = document.createElement(tag);
    for (var key in props || {}) {
      if (key === 'class') node.className = props[key];
      else if (key === 'text') node.textContent = props[key];
      else node.setAttribute(key, props[key]);
    }
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function select(id, options) {
    return el(
      'select',
      { id: id },
      options.map(function (option) {
        return el('option', { value: option[0], text: option[1] });
      })
    );
  }

  function field(labelText, control) {
    return el('div', { class: 'field' }, [el('label', { for: control.id, text: labelText }), control]);
  }

  function check(id, labelText) {
    var input = el('input', { type: 'checkbox', id: id });
    return { input: input, label: el('label', { class: 'check' }, [input, el('span', { text: labelText })]) };
  }

  function button(text, className) {
    return el('button', { type: 'button', class: 'btn' + (className ? ' ' + className : ''), text: text });
  }

  function railButton(icon, label) {
    return el('button', { type: 'button', class: 'tab', 'aria-label': label, title: label, text: icon });
  }

  function segOption(name, value, text) {
    var input = el('input', { type: 'radio', name: name, value: value });
    return { input: input, label: el('label', {}, [input, el('span', { text: text })]) };
  }

  function buildConsolePane() {
    ui.text = el('textarea', {
      id: 'text',
      'aria-label': 'Gönderilecek metin',
      placeholder: 'Konsola gönderilecek metni yazın veya yapıştırın',
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off'
    });

    var mask = check('hide', 'Metni gizle (parola için)');
    ui.hide = mask.input;

    ui.layout = select('layout', [
      ['trq', 'Türkçe Q'],
      ['us', 'US (İngilizce)']
    ]);
    ui.dead = select('dead', [
      ['windows', 'Windows ( ^ ~ ` )'],
      ['linux', 'Linux ( ^ )'],
      ['off', 'Kapalı']
    ]);
    ui.deadField = el('div', {}, [
      field('Ölü tuş düzeltmesi', ui.dead),
      el('p', {
        class: 'hint below',
        text: 'Parantezdeki karakterlerden sonra boşluk basılır; yoksa hedefte ekrana çıkmazlar.'
      })
    ]);
    ui.speed = select('speed', [
      ['fast', 'Hızlı'],
      ['normal', 'Normal'],
      ['slow', 'Yavaş'],
      ['verySlow', 'Çok yavaş (BIOS, kurulum)']
    ]);
    var enter = check('enter', 'Sonunda Enter gönder');
    ui.enter = enter.input;
    var clear = check('clear', 'Gönderdikten sonra kutuyu temizle');
    ui.clear = clear.input;

    var settingsBox = el('fieldset', {}, [
      el('legend', { text: 'Gönderim ayarları' }),
      field('Klavye düzeni', ui.layout),
      el('p', {
        class: 'hint',
        text: 'Sanal makinenin içindeki işletim sisteminin düzenini seçin; kendi klavyeniz fark etmez.'
      }),
      ui.deadField,
      field('Hız', ui.speed),
      enter.label,
      clear.label
    ]);

    ui.send = button('Gönder', 'primary');
    ui.stop = button('Durdur');
    ui.stop.disabled = true;

    ui.keys = [
      ['tab', 'Tab'],
      ['enter', 'Enter'],
      ['esc', 'Esc'],
      ['cad', 'Ctrl+Alt+Del']
    ].map(function (key) {
      var b = button(key[1]);
      b.addEventListener('click', function () {
        start([L.SPECIAL_KEYS[key[0]]], false);
      });
      return b;
    });

    ui.status = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

    return el('div', { class: 'body' }, [
      ui.text,
      mask.label,
      settingsBox,
      el('div', { class: 'row' }, [ui.send, ui.stop]),
      el('div', { class: 'row' }, [el('span', { class: 'muted', text: 'Tek tuş:' })].concat(ui.keys)),
      ui.status
    ]);
  }

  function buildPasswordPane() {
    var random = segOption('kind', 'random', 'Rastgele');
    var pin = segOption('kind', 'pin', 'PIN');
    ui.kindRandom = random.input;
    ui.kindPin = pin.input;
    var kind = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Tür' }, [random.label, pin.label]);

    // Şifre yalnızca bu salt okunur alanda (kapalı shadow root içinde) görünür; varsayılan gizli.
    ui.pw = el('input', {
      type: 'text',
      class: 'masked',
      readonly: '',
      'aria-label': 'Üretilen şifre',
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off'
    });
    ui.reveal = button('Göster');
    ui.reveal.setAttribute('aria-pressed', 'false');
    ui.regen = button('↻');
    ui.regen.setAttribute('aria-label', 'Yeniden üret');
    ui.regen.setAttribute('title', 'Yeniden üret');

    ui.length = el('input', { type: 'range', id: 'gen-length', step: '1' });
    ui.lengthValue = el('span', { class: 'value', 'aria-hidden': 'true' });
    var lengthRow = el('div', { class: 'field' }, [
      el('label', { for: 'gen-length', text: 'Uzunluk' }),
      ui.length,
      ui.lengthValue
    ]);

    var digits = check('gen-digits', 'Rakam');
    var symbols = check('gen-symbols', 'Sembol');
    ui.digits = digits.input;
    ui.symbols = symbols.input;
    ui.symbolSet = select('gen-set', [
      ['cli', 'CLI-güvenli'],
      ['all', 'Tüm']
    ]);
    var ambiguous = check('gen-ambiguous', 'Benzer karakterleri hariç tut (0 O o 1 l I)');
    ui.ambiguous = ambiguous.input;
    // PIN türünde gizlenen denetimler.
    ui.randomOnly = el('div', { class: 'group' }, [
      el('div', { class: 'row' }, [digits.label, symbols.label]),
      field('Semboller', ui.symbolSet),
      ambiguous.label
    ]);

    ui.user = el('input', {
      type: 'text',
      id: 'gen-user',
      class: 'text',
      spellcheck: 'false',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off'
    });

    ui.genBox = el('fieldset', { class: 'plain' }, [
      kind,
      el('div', { class: 'pwrow' }, [ui.pw, ui.reveal, ui.regen]),
      lengthRow,
      ui.randomOnly,
      field('Kullanıcı adı / not', ui.user)
    ]);

    ui.vaultSetup = button('Kasayı kur', 'notice-btn');
    ui.vaultNotice = el('div', { class: 'notice' }, [
      el('strong', { text: 'Önce kasayı kurun' }),
      el('span', {
        class: 'muted',
        text: 'Gönderilen şifreler kasaya kaydedilir; kasa kurulmadan şifre gönderilemez.'
      }),
      ui.vaultSetup
    ]);
    ui.vaultNotice.hidden = true;

    ui.pwSend = button('Gönder', 'primary');
    ui.pwCopy = button('Kopyala');
    ui.pwStop = button('Durdur');
    ui.pwTarget = el('p', { class: 'hint below' });
    ui.pwStatus = el('div', { class: 'status', role: 'status', 'aria-live': 'polite' });

    return el('div', { class: 'body' }, [
      ui.genBox,
      ui.vaultNotice,
      el('div', { class: 'row' }, [ui.pwSend, ui.pwCopy, ui.pwStop]),
      ui.pwTarget,
      ui.pwStatus
    ]);
  }

  function build() {
    host = el('div', { id: 'keylord-host' });
    host.style.cssText = 'position:fixed; top:16px; right:16px; z-index:2147483647;';
    // closed: sayfanın kendi scriptleri host.shadowRoot ile kutunun içine (parolaya) ulaşamaz.
    var root = host.attachShadow({ mode: 'closed' });
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];

    ui.tabConsole = railButton('⌨', 'Konsol');
    ui.tabPassword = railButton('🔑', 'Şifre');
    ui.tabHistory = railButton('🕘', 'Geçmiş');
    var rail = el('nav', { class: 'rail', 'aria-label': 'KeyLord menüsü' }, [
      ui.tabConsole,
      ui.tabPassword,
      ui.tabHistory
    ]);

    ui.close = el('button', { type: 'button', class: 'close', 'aria-label': 'Kapat', title: 'Kapat', text: '×' });
    // Kutunun hangi sayfada (çerçevede) açıldığını göster: parola yanlış adrese yazılmasın.
    ui.origin = el('div', { class: 'origin', text: location.host || location.origin });
    ui.title = el('div', { class: 'title' }, [
      el('div', { class: 'heading' }, [el('span', { text: 'KeyLord' }), ui.origin]),
      ui.close
    ]);

    ui.consolePane = buildConsolePane();
    ui.passwordPane = buildPasswordPane();

    var main = el('div', { class: 'main' }, [
      ui.title,
      ui.consolePane,
      ui.passwordPane,
      // Durum satırlarından ayrı bir öğe: durum metni ne olursa olsun hep onların altında kalır.
      el('div', { class: 'foot' }, [el('div', { class: 'credit', text: 'Developed by Gürkan Deveci' })])
    ]);

    root.appendChild(el('div', { class: 'panel', role: 'dialog', 'aria-label': 'KeyLord' }, [rail, main]));

    applySettingsToUi();
    applyGenToUi();
    reflectTab();
    wireEvents();
    wirePasswordEvents();
    setReady(false);
    document.documentElement.appendChild(host);
  }

  function applySettingsToUi() {
    ui.layout.value = settings.layout;
    ui.dead.value = settings.deadKeyFix;
    ui.speed.value = settings.speed;
    ui.enter.checked = !!settings.appendEnter;
    ui.clear.checked = !!settings.clearAfter;
    ui.hide.checked = !!settings.hideText;
    reflectSettings();
  }

  function reflectSettings() {
    ui.deadField.hidden = settings.layout !== 'trq';
    ui.text.classList.toggle('masked', !!settings.hideText);
  }

  function readSettingsFromUi() {
    settings.layout = ui.layout.value;
    settings.deadKeyFix = ui.dead.value;
    settings.speed = ui.speed.value;
    settings.appendEnter = ui.enter.checked;
    settings.clearAfter = ui.clear.checked;
    settings.hideText = ui.hide.checked;
    reflectSettings();
    saveSettings();
  }

  function setStatus(text, kind) {
    ui.status.textContent = text;
    ui.status.className = 'status' + (kind ? ' ' + kind : '');
  }

  // Şifre sekmesinin durum satırı. Buraya asla şifre yazılmaz.
  function setPwStatus(text, kind) {
    ui.pwStatus.textContent = text;
    ui.pwStatus.className = 'status' + (kind ? ' ' + kind : '');
  }

  // Gönder ve tek tuş düğmeleri yalnızca konsol bulunup bağlıyken ve gönderim yokken açıktır.
  function setBusy(busy) {
    var off = busy || !ready;
    ui.send.disabled = off;
    ui.stop.disabled = !busy;
    ui.keys.forEach(function (b) {
      b.disabled = off;
    });
    refreshPasswordControls();
  }

  function setReady(value) {
    ready = value;
    ui.pwTarget.textContent = ready
      ? 'Hedef: vCenter konsolu (tuş vuruşu).'
      : 'Hedef: bu sayfadaki boş şifre alanları.';
    setBusy(!!sending);
  }

  function wireEvents() {
    [ui.layout, ui.dead, ui.speed, ui.enter, ui.clear, ui.hide].forEach(function (control) {
      control.addEventListener('change', readSettingsFromUi);
    });

    ui.send.addEventListener('click', sendText);
    ui.stop.addEventListener('click', function () {
      command({ type: 'cancel' });
    });
    ui.close.addEventListener('click', hide);

    ui.tabConsole.addEventListener('click', function () {
      selectTab('console');
    });
    ui.tabPassword.addEventListener('click', function () {
      selectTab('password');
    });
    // Geçmiş kutuda açılmaz: eklentinin Kasa sayfası yeni sekmede açılır; sekme değişmez.
    ui.tabHistory.addEventListener('click', openVault);

    // Kutuda yazılan tuşlar sayfaya (dolayısıyla konsola) sızmasın.
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      host.addEventListener(type, function (event) {
        event.stopPropagation();
        if (type !== 'keydown') return;
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          if (settings.tab === 'password') sendPassword();
          else sendText();
        } else if (event.key === 'Escape' && !sending && !pwBusy) {
          hide();
        }
      });
    });

    // Kutu açıkken kullanıcı sayfada başka bir alana tıklarsa alan doldurma o alanı hedef alır.
    document.addEventListener(
      'focusin',
      function (event) {
        if (host && event.target !== host && host.style.display !== 'none') focusBeforeOpen = event.target;
      },
      true
    );

    enableDragging();
  }

  function enableDragging() {
    var drag = null;
    ui.title.addEventListener('pointerdown', function (event) {
      if (event.target === ui.close || event.button !== 0) return;
      var rect = host.getBoundingClientRect();
      drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
      ui.title.setPointerCapture(event.pointerId);
    });
    ui.title.addEventListener('pointermove', function (event) {
      if (!drag) return;
      var rect = host.getBoundingClientRect();
      var left = Math.min(Math.max(0, event.clientX - drag.dx), Math.max(0, window.innerWidth - rect.width));
      var top = Math.min(Math.max(0, event.clientY - drag.dy), Math.max(0, window.innerHeight - 40));
      host.style.left = left + 'px';
      host.style.top = top + 'px';
      host.style.right = 'auto';
    });
    ['pointerup', 'pointercancel'].forEach(function (type) {
      ui.title.addEventListener(type, function () {
        drag = null;
      });
    });
  }

  // ---------- Sekmeler ----------

  function reflectTab() {
    var pw = settings.tab === 'password';
    ui.consolePane.hidden = pw;
    ui.passwordPane.hidden = !pw;
    ui.tabConsole.classList.toggle('selected', !pw);
    ui.tabPassword.classList.toggle('selected', pw);
    ui.tabConsole.setAttribute('aria-pressed', String(!pw));
    ui.tabPassword.setAttribute('aria-pressed', String(pw));
  }

  function selectTab(name) {
    settings.tab = name;
    saveSettings();
    reflectTab();
    if (name === 'password') enterPasswordTab();
  }

  function openVault() {
    bg({ type: 'vault:open' });
  }

  // ---------- Şifre sekmesi ----------

  function enterPasswordTab() {
    if (!current) regenerate();
    checkVault();
  }

  // Sekme her gösterildiğinde kasa yeniden sorulur (kasa sayfasında az önce kurulmuş olabilir).
  function checkVault() {
    vaultState = 'unknown';
    refreshPasswordControls();
    bg({ type: 'vault:exists' }).then(function (res) {
      vaultState = res && res.exists ? 'yes' : 'no';
      refreshPasswordControls();
    });
  }

  function refreshPasswordControls() {
    if (!ui.pwSend) return;
    var can = vaultState === 'yes' && !pwBusy && !sending && !!current;
    ui.pwSend.disabled = !can;
    ui.pwCopy.disabled = !can;
    ui.pwStop.disabled = !(sending && sending.onResult);
    ui.genBox.disabled = pwBusy;
    ui.vaultNotice.hidden = vaultState !== 'no';
  }

  function regenerate() {
    current = { password: G.generate(settings.gen), record: null };
    ui.pw.value = current.password;
    setPwStatus(''); // önceki şifrenin sonucu yeni şifreye aitmiş gibi görünmesin
    refreshPasswordControls();
  }

  function applyGenToUi() {
    var gen = settings.gen;
    ui.kindRandom.checked = gen.kind !== 'pin';
    ui.kindPin.checked = gen.kind === 'pin';
    ui.digits.checked = !!gen.digits;
    ui.symbols.checked = !!gen.symbols;
    ui.symbolSet.value = gen.symbolSet === 'all' ? 'all' : 'cli';
    ui.ambiguous.checked = !!gen.avoidAmbiguous;
    reflectGen();
  }

  function reflectGen() {
    var gen = settings.gen;
    var pin = gen.kind === 'pin';
    ui.randomOnly.hidden = pin;
    ui.length.min = pin ? '4' : '8';
    ui.length.max = pin ? '12' : '64';
    ui.length.value = String(pin ? gen.pinLength : gen.length);
    ui.lengthValue.textContent = ui.length.value;
    ui.symbolSet.disabled = !gen.symbols;
  }

  // Üretici ayarı değişince yeni şifre üretilir (eski şifrenin kaydı ile bağ kopar).
  function onGenChange(save) {
    reflectGen();
    if (save) saveSettings();
    regenerate();
  }

  function setReveal(on) {
    ui.pw.classList.toggle('masked', !on);
    ui.reveal.textContent = on ? 'Gizle' : 'Göster';
    ui.reveal.setAttribute('aria-pressed', String(on));
  }

  function wirePasswordEvents() {
    [ui.kindRandom, ui.kindPin].forEach(function (radio) {
      radio.addEventListener('change', function () {
        settings.gen.kind = ui.kindPin.checked ? 'pin' : 'random';
        onGenChange(true);
      });
    });
    // Kaydırırken canlı yeni şifre; ayar bırakınca saklanır.
    ui.length.addEventListener('input', function () {
      var n = Number(ui.length.value);
      if (settings.gen.kind === 'pin') settings.gen.pinLength = n;
      else settings.gen.length = n;
      onGenChange(false);
    });
    ui.length.addEventListener('change', saveSettings);
    ui.digits.addEventListener('change', function () {
      settings.gen.digits = ui.digits.checked;
      onGenChange(true);
    });
    ui.symbols.addEventListener('change', function () {
      settings.gen.symbols = ui.symbols.checked;
      onGenChange(true);
    });
    ui.symbolSet.addEventListener('change', function () {
      settings.gen.symbolSet = ui.symbolSet.value;
      onGenChange(true);
    });
    ui.ambiguous.addEventListener('change', function () {
      settings.gen.avoidAmbiguous = ui.ambiguous.checked;
      onGenChange(true);
    });

    ui.regen.addEventListener('click', regenerate);
    ui.reveal.addEventListener('click', function () {
      setReveal(ui.pw.classList.contains('masked'));
    });
    ui.vaultSetup.addEventListener('click', openVault);
    ui.pwSend.addEventListener('click', sendPassword);
    ui.pwCopy.addEventListener('click', copyPassword);
    ui.pwStop.addEventListener('click', function () {
      command({ type: 'cancel' });
    });
  }

  function recordInfo(cur, method) {
    return {
      url: location.href,
      host: location.host,
      username: ui.user.value.trim(),
      password: cur.password,
      method: method
    };
  }

  // Yeni olay: kayıt yoksa oluşturulur, varsa aynı kayda eklenir. Kullanıcı adı/not en güncel değerle yazılır.
  function nextRecord(cur, method, status) {
    var at = Date.now();
    var rec;
    if (!cur.record) {
      rec = R.newRecord(recordInfo(cur, method), at, newId());
      if (status !== 'pending') {
        rec.status = status;
        rec.events = [{ at: at, method: method, status: status }];
      }
    } else {
      rec = R.withEvent(cur.record, { at: at, method: method, status: status });
    }
    rec.username = ui.user.value.trim();
    return rec;
  }

  function newRun(cur) {
    activeRun = { aborted: false, cur: cur };
    return activeRun;
  }

  // Durum yalnızca bu işlem hâlâ en son işlemse, kutu görünürse ve aynı şifre hâlâ gösteriliyorsa yazılır:
  // eski işlemin sonucu yeni şifrenin altında görünmez. closeNote: "kutu kapatıldı" bildirimi (şifreye ait değil).
  function pwSay(run, text, kind, closeNote) {
    if (run !== activeRun || host.style.display === 'none') return;
    if (!closeNote && current !== run.cur) return;
    setPwStatus(text, kind);
  }

  function endPw(run, text, kind, closeNote) {
    pwBusy = false;
    refreshPasswordControls();
    pwSay(run, text, kind, closeNote);
  }

  // Kutu kayıt yazılırken kapatıldı: hiçbir şey gönderilmez/kopyalanmaz, olay "başarısız" işlenir.
  function abortRun(cur, run, method) {
    cur.record = nextRecord(cur, method, 'failed');
    return putRecord(cur.record).then(function () {
      endPw(run, 'Kutu kapatıldı; gönderilmedi.', 'error', true);
    });
  }

  function sendPassword() {
    if (pwBusy || sending || !current || vaultState !== 'yes') return;
    var cur = current;
    var run = newRun(cur);
    var useConsole = ready;
    var method = useConsole ? 'usb' : 'fill';
    pwBusy = true;
    refreshPasswordControls();
    setPwStatus('Kaydediliyor…');

    // 1) Önce kayıt: yazılamazsa hiçbir şey gönderilmez.
    var pending = nextRecord(cur, method, 'pending');
    putRecord(pending).then(function (ok) {
      if (!ok) return endPw(run, 'Kayıt yazılamadı; gönderilmedi.', 'error');
      cur.record = pending;
      if (run.aborted) return abortRun(cur, run, method);

      // 2) Gönderim.
      if (useConsole) {
        var plan = L.planKeys(cur.password, {
          layout: settings.layout,
          deadKeyFix: settings.deadKeyFix,
          appendEnter: settings.appendEnter
        });
        if (plan.unsupported.length) {
          return finishSend(cur, run, method, 'failed', {
            text: 'Seçili klavye düzeninde yazılamayan karakter var. Hiçbir şey gönderilmedi.'
          });
        }
        start(plan.strokes, false, function (result, errorText) {
          finishSend(cur, run, method, R.runStatus(result), { result: result, errorText: errorText });
        });
      } else {
        var filled = F.fillPassword(document, focusBeforeOpen, cur.password);
        finishSend(cur, run, method, R.fillStatus(filled), { filled: filled });
      }
    });
  }

  function resultText(method, status, info) {
    if (info.text) return info.text;
    if (method === 'fill') {
      return status === 'sent' ? 'Şifre ' + info.filled + ' alana yazıldı ve geçmişe kaydedildi.' : FILL_ERROR;
    }
    var r = info.result || { sent: 0, total: 0 };
    if (status === 'sent') return 'Şifre konsola gönderildi (' + r.total + ' tuş vuruşu) ve geçmişe kaydedildi.';
    if (status === 'partial') {
      return (
        'Yarıda kaldı: ' + r.sent + ' / ' + r.total + ' tuş vuruşu gönderildi. Geçmişe "Yarım" olarak kaydedildi.'
      );
    }
    return (info.errorText ? info.errorText + '. ' : 'Hiçbir tuş gönderilmedi. ') + 'Geçmişe "Başarısız" olarak kaydedildi.';
  }

  // 3) Sonuç kayda işlenir; gönderildiyse/yarımsa ekran görüntüsü alınır
  // (kutu bu arada kapatıldıysa görüntü alınmaz).
  function finishSend(cur, run, method, status, info) {
    cur.record = nextRecord(cur, method, status);
    var text = resultText(method, status, info);
    var kind = status === 'sent' ? 'ok' : 'error';
    putRecord(cur.record).then(function (ok) {
      if (!ok) text += ' Sonuç kayda işlenemedi (kayıt "Bekliyor" kalabilir).';
      if ((status !== 'sent' && status !== 'partial') || run.aborted) return endPw(run, text, kind);
      pwSay(run, 'Ekran görüntüsü alınıyor…');
      return capture(cur).then(function (note) {
        endPw(run, text + note, kind);
      });
    });
  }

  function nextFrame() {
    return new Promise(function (resolve) {
      var done = false;
      function go() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      }
      // Arka plandaki sekmede rAF çalışmaz; takılıp kalmasın.
      var timer = setTimeout(go, 200);
      requestAnimationFrame(go);
    });
  }

  // Kutu görüntüye girmesin (açık şifre) diye gizlenir, arka plan sekmenin görüntüsünü alır, kutu geri açılır.
  function capture(cur) {
    var wasVisible = host.style.display !== 'none';
    if (wasVisible) host.style.display = 'none';
    var id = cur.record.id;
    return nextFrame()
      .then(nextFrame)
      .then(function () {
        return bg({ type: 'shot:capture', id: id });
      })
      .then(
        function (res) {
          if (wasVisible) host.style.display = '';
          if (!res || !res.ok) return ' Ekran görüntüsü alınamadı.';
          cur.record = Object.assign({}, cur.record, { hasScreenshot: true });
          return putRecord(cur.record).then(function (ok) {
            return ok ? '' : ' Ekran görüntüsü kayda işlenemedi.';
          });
        },
        function () {
          if (wasVisible) host.style.display = '';
          return ' Ekran görüntüsü alınamadı.';
        }
      );
  }

  function copyPassword() {
    if (pwBusy || sending || !current || vaultState !== 'yes') return;
    var clip = navigator.clipboard;
    if (!clip || typeof clip.writeText !== 'function') {
      setPwStatus('Bu sayfada panoya erişilemiyor (güvenli olmayan bağlantı). Hiçbir şey kopyalanmadı.', 'error');
      return;
    }
    var cur = current;
    var run = newRun(cur);
    pwBusy = true;
    refreshPasswordControls();
    setPwStatus('Kaydediliyor…');
    var rec = nextRecord(cur, 'copy', 'copied');
    putRecord(rec).then(function (ok) {
      if (!ok) return endPw(run, 'Kayıt yazılamadı; kopyalanmadı.', 'error');
      cur.record = rec;
      if (run.aborted) return abortRun(cur, run, 'copy');
      return clip.writeText(cur.password).then(
        function () {
          endPw(run, 'Şifre panoya kopyalandı ve geçmişe kaydedildi.', 'ok');
        },
        function () {
          cur.record = nextRecord(cur, 'copy', 'failed');
          return putRecord(cur.record).then(function () {
            endPw(run, 'Panoya kopyalanamadı.', 'error');
          });
        }
      );
    });
  }

  // ---------- Motorla haberleşme ----------

  function command(message) {
    document.dispatchEvent(new CustomEvent('keylord:cmd', { detail: JSON.stringify(message) }));
  }

  function detect() {
    setStatus('Konsol aranıyor…');
    setReady(false);
    clearTimeout(detectTimer);
    detectTimer = setTimeout(function () {
      setStatus('Konsol bileşenine ulaşılamadı. Sayfayı yenileyip kutuyu yeniden açın.', 'error');
    }, 1000);
    command({ type: 'detect' });
  }

  function onStatus(message) {
    clearTimeout(detectTimer);
    if (sending) return;
    setReady(!!message.consoles && !!message.connected);
    if (!message.consoles) setStatus(ERRORS['no-console'], 'error');
    else if (!message.connected) setStatus(ERRORS['not-connected'], 'error');
    else setStatus('Konsol bulundu, gönderime hazır.', 'ok');
  }

  function onEngineEvent(event) {
    var message;
    try {
      message = JSON.parse(event.detail);
    } catch (err) {
      return;
    }
    if (!message || !host) return;
    if (message.type === 'status') return onStatus(message);
    if (!sending || message.id !== sending.id) return;

    var onResult = sending.onResult;
    if (message.type === 'progress') {
      sending.done = message.done;
      var progress = 'Gönderiliyor… ' + message.done + ' / ' + message.total;
      if (onResult) setPwStatus(progress);
      else setStatus(progress);
    } else if (message.type === 'done') {
      var clearNow = sending.clearOnDone && !message.cancelled;
      finish();
      if (onResult) {
        onResult({ sent: message.sent, total: message.total, cancelled: !!message.cancelled });
      } else if (message.cancelled) {
        setStatus('Durduruldu: ' + message.sent + ' / ' + message.total + ' tuş vuruşu gönderildi.', 'error');
      } else {
        if (clearNow) ui.text.value = '';
        setStatus('Gönderildi: ' + message.total + ' tuş vuruşu.', 'ok');
      }
    } else if (message.type === 'error') {
      // Yarıda hata: son ilerlemeye göre kaç tuş gittiği bilinir.
      var partial = { sent: sending.done || 0, total: sending.total, cancelled: true };
      finish();
      var text = ERRORS[message.code] || ERRORS['send-failed'];
      if (message.message) text += ': ' + message.message;
      if (onResult) onResult(partial, text);
      else setStatus(text, 'error');
    }
  }

  function finish() {
    sending = null;
    setBusy(false);
  }

  // onResult verilirse (şifre sekmesi) sonuç { sent, total, cancelled } ile ona bildirilir.
  function start(strokes, clearOnDone, onResult) {
    var none = { sent: 0, total: strokes.length, cancelled: false };
    if (sending) {
      if (onResult) onResult(none, ERRORS.busy);
      return;
    }
    if (!ready) {
      setStatus('Konsol hazır değil; hiçbir şey gönderilmedi.', 'error');
      detect();
      if (onResult) onResult(none, 'Konsol hazır değil');
      return;
    }
    var speed = SPEEDS[settings.speed] || SPEEDS.normal;
    sending = { id: 'ks' + ++sequence, clearOnDone: clearOnDone, onResult: onResult, done: 0, total: strokes.length };
    setBusy(true);
    var progress = 'Gönderiliyor… 0 / ' + strokes.length;
    if (onResult) setPwStatus(progress);
    else setStatus(progress);
    command({
      type: 'send',
      id: sending.id,
      strokes: strokes,
      strokeDelay: speed.strokeDelay,
      eventGap: speed.eventGap
    });
  }

  function sendText() {
    if (sending || pwBusy) return;
    var text = ui.text.value;
    if (!text) {
      setStatus('Gönderilecek metin yok.', 'error');
      return;
    }
    var plan = L.planKeys(text, {
      layout: settings.layout,
      deadKeyFix: settings.deadKeyFix,
      appendEnter: settings.appendEnter
    });
    if (plan.unsupported.length) {
      // Metin gizliyken parolanın karakterlerini durum satırında açığa çıkarma.
      var which = settings.hideText
        ? plan.unsupported.length + ' farklı karakter'
        : plan.unsupported.join(' ');
      setStatus('Seçili klavye düzeninde yazılamayan karakter var: ' + which + '. Hiçbir şey gönderilmedi.', 'error');
      return;
    }
    start(plan.strokes, settings.clearAfter);
  }

  // ---------- Aç / kapat ----------

  function show() {
    host.style.display = '';
    detect();
    if (settings.tab === 'password') {
      enterPasswordTab();
      ui.user.focus();
    } else {
      ui.text.focus();
    }
  }

  function hide() {
    if (sending) command({ type: 'cancel' });
    if (activeRun) activeRun.aborted = true; // kayıt yazımı sürerken kapatılırsa gönderim yapılmaz
    clearTimeout(detectTimer);
    ui.text.value = ''; // Kapatılan kutuda parola kalmasın.
    // Üretilen şifre ve düz kaydı da bellekten bırakılır; kutu yeniden açılınca yeni şifre üretilir.
    current = null;
    ui.pw.value = '';
    setReveal(false);
    setPwStatus('');
    refreshPasswordControls();
    host.style.display = 'none';
  }

  function toggle() {
    // Kutu odak almadan önce: alan doldurma kullanıcının tıkladığı şifre alanını hedef alsın.
    if (!host || host.style.display === 'none') focusBeforeOpen = document.activeElement;
    if (!host) {
      return loadSettings().then(function () {
        if (host) return;
        build();
        show();
      });
    }
    if (host.style.display === 'none') show();
    else hide();
    return Promise.resolve();
  }

  document.addEventListener('keylord:evt', onEngineEvent);

  window.__keyLordDialog = { toggle: toggle };
})();
