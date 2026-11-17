// "KeyLord" kutusu. Eklentinin yalıtılmış dünyasında çalışır; metni tuş vuruşlarına çevirir
// (layouts.js) ve sayfa dünyasındaki motora (engine.js) CustomEvent ile iletir.
// Yazılan metin hiçbir yere kaydedilmez; yalnızca gönderim ayarları saklanır.
(function () {
  'use strict';

  if (window.__keyLordDialog) return;

  var L = globalThis.KeyLordLayouts;

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
    hideText: false
  };

  var ERRORS = {
    'no-console':
      'Bu sayfada vCenter konsolu bulunamadı. Kutuyu sanal makinenin web konsolu sekmesinde açın.',
    'not-connected': 'Konsol sanal makineye bağlı değil. Bağlantı kurulunca tekrar deneyin.',
    busy: 'Devam eden bir gönderim var.',
    'send-failed': 'Gönderim sırasında hata oluştu'
  };

  var CSS = [
    ':host { all: initial; }',
    '.panel { --bg:#ffffff; --fg:#1b1f24; --muted:#5c6570; --line:#d5dae0; --field:#f6f8fa;',
    '  --accent:#0b62d6; --accent-fg:#ffffff; --ok:#1a7f37; --err:#c62828;',
    '  box-sizing:border-box; width:360px; max-width:calc(100vw - 16px); background:var(--bg); color:var(--fg);',
    '  border:1px solid var(--line); border-radius:10px; box-shadow:0 10px 32px rgba(0,0,0,.28);',
    '  font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; overflow:hidden; }',
    '@media (prefers-color-scheme: dark) { .panel { --bg:#1f2329; --fg:#e7eaee; --muted:#9aa4af; --line:#3a414a;',
    '  --field:#2a3038; --accent:#4c9aff; --accent-fg:#0b1220; --ok:#56d364; --err:#ff7b72; } }',
    '.panel * { box-sizing:border-box; font:inherit; color:inherit; }',
    '.title { display:flex; align-items:center; justify-content:space-between; padding:8px 8px 8px 12px;',
    '  border-bottom:1px solid var(--line); cursor:move; user-select:none; font-weight:600; }',
    '.close { border:0; background:transparent; width:26px; height:26px; border-radius:6px; cursor:pointer;',
    '  font-size:18px; line-height:1; color:var(--muted); }',
    '.close:hover { background:var(--field); color:var(--fg); }',
    '.body { padding:12px; display:flex; flex-direction:column; gap:10px; }',
    'textarea { width:100%; min-height:84px; resize:vertical; padding:8px; border:1px solid var(--line);',
    '  border-radius:6px; background:var(--field); font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;',
    '  font-size:12.5px; }',
    'textarea.masked { -webkit-text-security:disc; }',
    'textarea:focus, select:focus, button:focus-visible, input:focus-visible { outline:2px solid var(--accent);',
    '  outline-offset:1px; }',
    'fieldset { margin:0; padding:8px 10px 10px; border:1px solid var(--line); border-radius:6px;',
    '  display:flex; flex-direction:column; gap:8px; }',
    'legend { padding:0 4px; color:var(--muted); font-size:12px; }',
    '.field { display:flex; align-items:center; justify-content:space-between; gap:8px; }',
    '.field select { flex:0 1 200px; min-width:0; padding:4px 6px; border:1px solid var(--line); border-radius:6px;',
    '  background:var(--field); }',
    '.field label { white-space:nowrap; }',
    '.hint { margin:-4px 0 0; color:var(--muted); font-size:11.5px; }',
    '.hint.below { margin:4px 0 0; }',
    '.check { display:flex; align-items:center; gap:6px; cursor:pointer; }',
    '.check input { margin:0; accent-color:var(--accent); }',
    '.row { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }',
    'button.btn { padding:5px 10px; border:1px solid var(--line); border-radius:6px; background:var(--field);',
    '  cursor:pointer; }',
    'button.btn:hover:not(:disabled) { border-color:var(--accent); }',
    'button.btn:disabled { opacity:.5; cursor:default; }',
    'button.primary { background:var(--accent); border-color:var(--accent); color:var(--accent-fg); font-weight:600;',
    '  padding:6px 16px; }',
    '.muted { color:var(--muted); }',
    '.status { min-height:18px; color:var(--muted); overflow-wrap:anywhere; }',
    '.status.ok { color:var(--ok); }',
    '.status.error { color:var(--err); }',
    '.credit { padding-top:8px; border-top:1px solid var(--line); color:var(--muted); font-size:11.5px;',
    '  text-align:center; }',
    '[hidden] { display:none !important; }'
  ].join('\n');

  var settings = Object.assign({}, DEFAULTS);
  var host = null;
  var ui = {};
  var sending = null; // { id, clearOnDone }
  var sequence = 0;
  var detectTimer = null;

  // ---------- Ayarların saklanması ----------

  function loadSettings() {
    try {
      return chrome.storage.local.get('settings').then(
        function (stored) {
          Object.assign(settings, (stored && stored.settings) || {});
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

  function build() {
    host = el('div', { id: 'keylord-host' });
    host.style.cssText = 'position:fixed; top:16px; right:16px; z-index:2147483647;';
    var root = host.attachShadow({ mode: 'open' });
    var sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];

    ui.close = el('button', { type: 'button', class: 'close', 'aria-label': 'Kapat', title: 'Kapat', text: '×' });
    ui.title = el('div', { class: 'title' }, [el('span', { text: 'KeyLord' }), ui.close]);

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

    var body = el('div', { class: 'body' }, [
      ui.text,
      mask.label,
      settingsBox,
      el('div', { class: 'row' }, [ui.send, ui.stop]),
      el('div', { class: 'row' }, [el('span', { class: 'muted', text: 'Tek tuş:' })].concat(ui.keys)),
      ui.status,
      // Durum satırından ayrı bir öğe: durum metni ne olursa olsun hep onun altında kalır.
      el('div', { class: 'credit', text: 'Developed by Gürkan Deveci' })
    ]);

    root.appendChild(el('div', { class: 'panel', role: 'dialog', 'aria-label': 'KeyLord' }, [ui.title, body]));

    applySettingsToUi();
    wireEvents();
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

  function setBusy(busy) {
    ui.send.disabled = busy;
    ui.stop.disabled = !busy;
    ui.keys.forEach(function (b) {
      b.disabled = busy;
    });
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

    // Kutuda yazılan tuşlar sayfaya (dolayısıyla konsola) sızmasın.
    ['keydown', 'keypress', 'keyup'].forEach(function (type) {
      host.addEventListener(type, function (event) {
        event.stopPropagation();
        if (type !== 'keydown') return;
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          sendText();
        } else if (event.key === 'Escape' && !sending) {
          hide();
        }
      });
    });

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

  // ---------- Motorla haberleşme ----------

  function command(message) {
    document.dispatchEvent(new CustomEvent('keylord:cmd', { detail: JSON.stringify(message) }));
  }

  function detect() {
    setStatus('Konsol aranıyor…');
    clearTimeout(detectTimer);
    detectTimer = setTimeout(function () {
      setStatus('Konsol bileşenine ulaşılamadı. Sayfayı yenileyip kutuyu yeniden açın.', 'error');
    }, 1000);
    command({ type: 'detect' });
  }

  function onStatus(message) {
    clearTimeout(detectTimer);
    if (sending) return;
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

    if (message.type === 'progress') {
      setStatus('Gönderiliyor… ' + message.done + ' / ' + message.total);
    } else if (message.type === 'done') {
      var clearNow = sending.clearOnDone && !message.cancelled;
      finish();
      if (message.cancelled) {
        setStatus('Durduruldu: ' + message.sent + ' / ' + message.total + ' tuş vuruşu gönderildi.', 'error');
      } else {
        if (clearNow) ui.text.value = '';
        setStatus('Gönderildi: ' + message.total + ' tuş vuruşu.', 'ok');
      }
    } else if (message.type === 'error') {
      finish();
      var text = ERRORS[message.code] || ERRORS['send-failed'];
      if (message.message) text += ': ' + message.message;
      setStatus(text, 'error');
    }
  }

  function finish() {
    sending = null;
    setBusy(false);
  }

  function start(strokes, clearOnDone) {
    if (sending) return;
    var speed = SPEEDS[settings.speed] || SPEEDS.normal;
    sending = { id: 'ks' + ++sequence, clearOnDone: clearOnDone };
    setBusy(true);
    setStatus('Gönderiliyor… 0 / ' + strokes.length);
    command({
      type: 'send',
      id: sending.id,
      strokes: strokes,
      strokeDelay: speed.strokeDelay,
      eventGap: speed.eventGap
    });
  }

  function sendText() {
    if (sending) return;
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
    ui.text.focus();
  }

  function hide() {
    if (sending) command({ type: 'cancel' });
    clearTimeout(detectTimer);
    ui.text.value = ''; // Kapatılan kutuda parola kalmasın.
    host.style.display = 'none';
  }

  function toggle() {
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
