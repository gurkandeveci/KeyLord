// KeyLord Kasa sayfası (vault.html). Ana parola yalnızca burada yazılır; şifre geçmişi yalnızca
// burada çözülüp gösterilir. Ekranlar: kurulum | kilit | ana ekran (liste, ayrıntı, yedek).
// DOM tamamen createElement ile kurulur (innerHTML yok). Ana parola saklanmaz, hiçbir şey log'lanmaz;
// çözülen kayıtlar yalnızca kilit açıkken bu sayfanın belleğinde durur, kilitlenince atılır.
(function (g) {
  'use strict';
  if (g.__keyLordVaultPage) return; // çift yükleme koruması
  g.__keyLordVaultPage = true;

  var C = g.KeyLordVaultCrypto;
  var S = g.KeyLordVaultSession;
  var B = g.KeyLordBackup;
  var R = g.KeyLordRecords;

  var MIN_PASSWORD = 12;
  var MASK = '••••••••••';
  var SESSION_KEY = 'vaultKey'; // vault-session.js içindeki anahtar adı (yalnızca hareketsizlik denetimi için okunur)
  var QUOTA_WARN_RATIO = 0.8;

  var METHOD_LABELS = { usb: 'Tuş vuruşu', fill: 'Alan doldurma', copy: 'Kopyalama' };

  var ERRORS = {
    'wrong-password': 'Ana parola yanlış.',
    'backup-wrong-password': 'Yedeğin ana parolası yanlış.',
    'not-a-backup': 'Bu dosya bir KeyLord yedeği değil.',
    'bad-envelope': 'Yedekteki bazı kayıtlar bozuk; geri yükleme yapılmadı.'
  };

  // --- Yalnızca test sayfasında (uzantı dışında) geçerli parametreler ---
  var IS_EXTENSION = g.location.protocol === 'chrome-extension:';
  function testParam(name) {
    if (IS_EXTENSION) return NaN; // yüklenen uzantı her zaman varsayılanları kullanır
    try {
      return parseInt(new URLSearchParams(g.location.search).get(name), 10);
    } catch (e) {
      return NaN;
    }
  }
  var iterationsParam = testParam('iterations');
  var ITERATIONS = iterationsParam > 0 ? iterationsParam : C.DEFAULT_ITERATIONS;
  var timeoutParam = testParam('timeout');
  var IDLE_MS = timeoutParam > 0 ? timeoutParam : S.TIMEOUT_MS;
  // Test zaman aşımı: TIMEOUT_MS sabit olduğundan saat hızlandırılır (kayıt ve okuma aynı saati kullanır).
  var CLOCK_FACTOR = S.TIMEOUT_MS / IDLE_MS;
  var CLOCK_EPOCH = 1.7e12;
  function now() {
    var t = Date.now();
    return CLOCK_FACTOR === 1 ? t : CLOCK_EPOCH + (t - CLOCK_EPOCH) * CLOCK_FACTOR;
  }

  var session = chrome.storage.session;
  var store = g.KeyLordStore.createStore({ sync: chrome.storage.sync, local: chrome.storage.local });

  var root = null;
  var toastNode = null;
  var toastTimer = null;
  var ui = {};
  var state = {
    screen: null, // 'setup' | 'unlock' | 'main'
    gen: 0, // her kilitte artar; kilitten önce başlamış işlerin sonucu atılır
    header: null,
    records: [], // [{ id, rec, synced }] – yalnızca kilit açıkken
    pending: 0,
    bad: 0,
    query: '',
    selectedId: null,
    showPassword: false,
    shotUrl: null,
    detailToken: 0,
    busy: false
  };

  // ---------- DOM yardımcıları ----------

  function el(tag, props, children) {
    var node = document.createElement(tag);
    for (var key in props || {}) {
      if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
      var v = props[key];
      if (v === undefined || v === null || v === false) continue;
      if (key === 'class') node.className = v;
      else if (key === 'text') node.textContent = v;
      else if (key === 'hidden') node.hidden = true;
      else if (key === 'onclick') node.addEventListener('click', v);
      else node.setAttribute(key, v === true ? '' : v);
    }
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function button(id, text, cls, onclick) {
    return el('button', { id: id, type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), text: text, onclick: onclick });
  }

  function passwordField(id, label, autocomplete) {
    var input = el('input', { id: id, type: 'password', autocomplete: autocomplete, spellcheck: 'false' });
    return { input: input, node: el('label', { class: 'lbl', for: id }, [label, input]) };
  }

  function setMsg(node, text, kind) {
    if (!node) return;
    node.textContent = text || '';
    node.className = 'msg' + (kind ? ' ' + kind : '');
  }

  function toast(text, isError) {
    if (!toastNode) {
      toastNode = el('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite', hidden: true });
      document.body.appendChild(toastNode);
    }
    toastNode.textContent = text;
    toastNode.className = 'toast' + (isError ? ' error' : '');
    toastNode.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastNode.hidden = true;
    }, 2600);
  }

  function formatDate(ts) {
    if (typeof ts !== 'number' || !isFinite(ts)) return '—';
    try {
      return new Date(ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return new Date(ts).toLocaleString();
    }
  }

  function statusLabel(s) {
    return R.STATUS_LABELS[s] || String(s || '—');
  }

  function methodLabel(m) {
    return METHOD_LABELS[m] || String(m || '—');
  }

  function text(v) {
    return typeof v === 'string' && v ? v : '—';
  }

  function errorCode(err) {
    return err && typeof err.message === 'string' ? err.message : '';
  }

  // Sayfanın iskeleti: üst çubuk + ekran içeriği + imza.
  function mount(actions, content) {
    clear(root);
    root.appendChild(
      el('header', { class: 'topbar' }, [el('h1', { class: 'brand', text: 'KeyLord Kasa' }), actions || null])
    );
    content.forEach(function (n) {
      root.appendChild(n);
    });
    root.appendChild(el('footer', { id: 'credit', class: 'credit', text: 'Developed by Gürkan Deveci' }));
  }

  // ---------- Oturum ----------

  // Her işlemden önce çağrılır: anahtar yoksa (süre doldu / başka sekmede kilitlendi) kilit ekranına döner.
  async function requireKey() {
    var key = null;
    try {
      key = await S.loadKey(session, now());
    } catch (e) {
      key = null;
    }
    if (!key) lockUi('Oturum süresi doldu. Kilidi yeniden açın.');
    return key;
  }

  function revokeShot() {
    if (state.shotUrl) {
      URL.revokeObjectURL(state.shotUrl);
      state.shotUrl = null;
    }
  }

  // Bellekteki çözülmüş her şeyi atar ve listeyi DOM'dan temizler.
  function dropSecrets() {
    state.gen++;
    revokeShot();
    state.records = [];
    state.selectedId = null;
    state.showPassword = false;
    state.query = '';
    state.detailToken++;
    if (ui.list) clear(ui.list);
    if (ui.detail) clear(ui.detail);
  }

  function lockUi(message) {
    showUnlock(message); // showUnlock sırları atar
  }

  // Hareketsizlik denetimi: anahtarın son etkinliğine bakar (loadKey çağırmaz, süreyi uzatmaz).
  async function checkIdle() {
    if (state.screen !== 'main') return;
    var gen = state.gen;
    var entry;
    try {
      var res = await session.get(SESSION_KEY);
      entry = res && res[SESSION_KEY];
    } catch (e) {
      entry = null;
    }
    if (gen !== state.gen || state.screen !== 'main') return;
    var expired = !entry || typeof entry.lastActivity !== 'number' || now() - entry.lastActivity > S.TIMEOUT_MS;
    if (expired) {
      try {
        await S.lock(session);
      } catch (e) {}
      lockUi('Kasa hareketsizlik nedeniyle kilitlendi.');
    }
  }

  function getEmail() {
    return new Promise(function (resolve) {
      try {
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, function (info) {
          void (chrome.runtime && chrome.runtime.lastError);
          resolve((info && info.email) || '');
        });
      } catch (e) {
        resolve('');
      }
    });
  }

  // ---------- Kurulum ----------

  function showSetup() {
    dropSecrets();
    ui = {};
    state.screen = 'setup';
    var p1 = passwordField('setup-password', 'Ana parola (en az ' + MIN_PASSWORD + ' karakter)', 'new-password');
    var p2 = passwordField('setup-confirm', 'Ana parola (tekrar)', 'new-password');
    var msg = el('div', { id: 'setup-msg', class: 'msg', role: 'status' });
    var submit = el('button', { id: 'btn-setup', type: 'submit', class: 'btn primary big', text: 'Kasayı oluştur' });
    var form = el('form', { id: 'setup-form', autocomplete: 'off' }, [p1.node, p2.node, submit, msg]);
    var restore = buildRestorePanel(false);
    restore.node.hidden = true;

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (state.busy) return;
      var pw = p1.input.value;
      var pw2 = p2.input.value;
      p1.input.value = '';
      p2.input.value = '';
      if (Array.from(pw).length < MIN_PASSWORD) {
        setMsg(msg, 'Ana parola en az ' + MIN_PASSWORD + ' karakter olmalı.', 'error');
        p1.input.focus();
        return;
      }
      if (pw !== pw2) {
        setMsg(msg, 'Parolalar eşleşmiyor.', 'error');
        p1.input.focus();
        return;
      }
      state.busy = true;
      submit.disabled = true;
      setMsg(msg, 'Kasa oluşturuluyor…');
      try {
        if (await store.getHeader()) {
          // Başka bir sekmede kasa kurulmuş; üzerine yazılmaz.
          showUnlock('Bu cihazda zaten bir kasa var. Kilidi açın.');
          return;
        }
        var email = await getEmail();
        var vault = await C.createVault(pw, { iterations: ITERATIONS, googleEmail: email });
        pw = pw2 = '';
        await store.putHeader(vault.header);
        await S.saveKey(session, vault.privateKey, now());
        await showMain(vault.privateKey);
        toast('Kasa oluşturuldu. Düzenli yedek almayı unutmayın.');
      } catch (e) {
        setMsg(msg, 'Kasa oluşturulamadı. Tekrar deneyin.', 'error');
      } finally {
        pw = pw2 = '';
        state.busy = false;
        submit.disabled = false;
      }
    });

    var showRestore = button('btn-show-restore', 'Yedekten yükle', 'big', function () {
      restore.node.hidden = !restore.node.hidden;
      if (!restore.node.hidden) restore.file.focus();
    });

    mount(null, [
      el('section', { id: 'setup', class: 'card' }, [
        el('h2', { text: 'Kasayı kur' }),
        el('p', {
          class: 'muted',
          text:
            'Şifre geçmişiniz bu ana parolayla şifrelenir. Ana parola hiçbir yerde saklanmaz; ' +
            'kayıtları görmek için bu sayfada sorulur.'
        }),
        el('div', {
          id: 'setup-warning',
          class: 'notice',
          role: 'note',
          text: 'Ana parolayı unutursanız kayıtlar geri getirilemez. Düzenli yedek alın.'
        }),
        form,
        el('div', { class: 'divider', text: 'veya' }),
        el('p', { class: 'muted small', text: 'Daha önce aldığınız bir KeyLord yedeğiniz varsa kasayı ondan kurun.' }),
        showRestore,
        restore.node
      ])
    ]);
    p1.input.focus();
  }

  // ---------- Kilit ----------

  function showUnlock(info) {
    dropSecrets();
    ui = {};
    state.screen = 'unlock';
    var p = passwordField('unlock-password', 'Ana parola', 'current-password');
    var msg = el('div', { id: 'unlock-msg', class: 'msg', role: 'status' });
    var submit = el('button', { id: 'btn-unlock', type: 'submit', class: 'btn primary big', text: 'Kilidi aç' });
    var form = el('form', { id: 'unlock-form', autocomplete: 'off' }, [p.node, submit, msg]);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (state.busy) return;
      var pw = p.input.value;
      p.input.value = '';
      if (!pw) {
        setMsg(msg, 'Ana parolayı girin.', 'error');
        return;
      }
      state.busy = true;
      submit.disabled = true;
      setMsg(msg, 'Açılıyor…');
      try {
        var header = await store.getHeader();
        if (!header) {
          pw = '';
          showSetup();
          return;
        }
        var key;
        try {
          key = await C.unlockVault(header, pw);
        } catch (e) {
          setMsg(msg, errorCode(e) === 'wrong-password' ? ERRORS['wrong-password'] : 'Kasa açılamadı.', 'error');
          p.input.focus();
          return;
        } finally {
          pw = '';
        }
        await S.saveKey(session, key, now());
        await showMain(key);
      } catch (e) {
        setMsg(msg, 'Kasa açılamadı.', 'error');
      } finally {
        state.busy = false;
        submit.disabled = false;
      }
    });

    mount(null, [
      el('section', { id: 'unlock', class: 'card' }, [
        el('h2', { text: 'Kasa kilitli' }),
        el('p', { id: 'unlock-info', class: 'muted', text: info || 'Kayıtları görmek için ana parolayı girin.' }),
        form
      ])
    ]);
    p.input.focus();
  }

  // ---------- Ana ekran ----------

  async function showMain(key) {
    if (!key) {
      key = await requireKey();
      if (!key) return;
    }
    dropSecrets();
    ui = {};
    state.screen = 'main';

    var restore = buildRestorePanel(true);
    restore.node.hidden = true;

    var actions = el('div', { class: 'actions' }, [
      button('btn-backup', 'Yedek al', '', onBackup),
      button('btn-restore', 'Yedekten yükle', '', function () {
        restore.node.hidden = !restore.node.hidden;
        if (!restore.node.hidden) restore.file.focus();
      }),
      button('btn-refresh', 'Yenile', '', onRefresh),
      button('btn-lock', 'Şimdi kilitle', 'primary', onLockNow)
    ]);

    var search = el('input', {
      id: 'search',
      type: 'search',
      placeholder: 'Ara: adres veya kullanıcı adı',
      'aria-label': 'Kayıtlarda ara',
      autocomplete: 'off',
      spellcheck: 'false'
    });
    search.addEventListener('input', async function () {
      state.query = search.value;
      renderList();
      await requireKey(); // arama da etkinlik sayılır; süre dolduysa kilitler
    });

    ui.warnings = el('div', { id: 'warnings', class: 'warnings', 'aria-live': 'polite' });
    ui.syncHint = el('p', { id: 'sync-hint', class: 'muted small', hidden: true });
    ui.count = el('span', { id: 'record-count', class: 'muted small' });
    ui.list = el('ul', { id: 'record-list', class: 'list' });
    ui.empty = el('p', { id: 'list-empty', class: 'muted', text: 'Yükleniyor…' });
    ui.detail = el('aside', { id: 'detail', class: 'panel', hidden: true, 'aria-label': 'Kayıt ayrıntısı' });
    ui.grid = el('div', { class: 'main' }, [
      el('section', { class: 'panel', 'aria-label': 'Kayıtlar' }, [
        el('div', { class: 'listhead' }, [search, ui.count]),
        ui.list,
        ui.empty
      ]),
      ui.detail
    ]);
    ui.search = search;

    mount(actions, [ui.warnings, restore.node, ui.grid, ui.syncHint]);
    ui.restore = restore;
    await refreshData(key);
  }

  // Kayıtları depodan okuyup çözer, uyarıları ve listeyi yeniler.
  async function refreshData(key) {
    var gen = state.gen;
    try {
      await store.retryPending();
    } catch (e) {}
    var header = await store.getHeader();
    var list = await store.listRecords();
    var out = [];
    var bad = 0;
    for (var i = 0; i < list.length; i++) {
      try {
        out.push({ id: list[i].id, rec: await C.decryptJson(key, list[i].envelope), synced: list[i].synced });
      } catch (e) {
        bad++;
      }
    }
    if (gen !== state.gen || state.screen !== 'main') return; // bu arada kilitlendi
    out.sort(function (a, b) {
      return (Number(b.rec.createdAt) || 0) - (Number(a.rec.createdAt) || 0);
    });
    state.header = header;
    state.records = out;
    state.bad = bad;
    state.pending = out.filter(function (r) {
      return !r.synced;
    }).length;
    renderList();
    if (state.selectedId && !findRecord(state.selectedId)) closeDetail();
    await renderWarnings();
  }

  function findRecord(id) {
    for (var i = 0; i < state.records.length; i++) if (state.records[i].id === id) return state.records[i];
    return null;
  }

  async function renderWarnings() {
    var gen = state.gen;
    var email = await getEmail();
    var usage = null;
    try {
      usage = await store.syncUsage();
    } catch (e) {}
    if (gen !== state.gen || state.screen !== 'main' || !ui.warnings) return;
    clear(ui.warnings);
    function add(id, t) {
      ui.warnings.appendChild(el('div', { id: id, class: 'notice', role: 'alert', text: t }));
    }
    var header = state.header;
    S.warnings(header, email).forEach(function (w) {
      if (w === 'no-google-account') {
        add(
          'warn-no-google',
          "Chrome'da Google hesabıyla oturum açın ve Uzantılar eşitlemesini açın; yoksa kayıtlar " +
            'yalnızca bu bilgisayarda kalır. Yedek alın.'
        );
      } else if (w === 'other-account') {
        add('warn-other-account', 'Bu kasa ' + header.googleEmail + ' hesabına ait.');
      }
    });
    if (usage && usage.ratio >= QUOTA_WARN_RATIO) {
      add(
        'warn-quota',
        'Eşitleme alanı %' + Math.round(usage.ratio * 100) + ' dolu. Eski kayıtları yedekleyip silin ' +
          '(“Yedek al”, sonra kayıt ayrıntısında “Sil”).'
      );
    }
    if (state.pending > 0) add('warn-pending', state.pending + ' kayıt eşitlenmedi');
    if (state.bad > 0) add('warn-bad', state.bad + ' kayıt bu kasanın anahtarıyla çözülemedi.');
    if (ui.syncHint) {
      ui.syncHint.hidden = !email;
      ui.syncHint.textContent =
        'Kayıtların diğer bilgisayarlarınıza gelmesi için Chrome’da Uzantılar eşitlemesinin açık olduğundan emin olun.';
    }
  }

  function matches(r, q) {
    if (!q) return true;
    var hay = (String(r.rec.host || '') + '\n' + String(r.rec.username || '')).toLocaleLowerCase('tr');
    return hay.indexOf(q) !== -1;
  }

  function renderList() {
    if (!ui.list) return;
    var q = state.query.trim().toLocaleLowerCase('tr');
    var shown = state.records.filter(function (r) {
      return matches(r, q);
    });
    clear(ui.list);
    shown.forEach(function (r) {
      var rec = r.rec;
      var row = el(
        'button',
        {
          type: 'button',
          class: 'row' + (rec.status === 'failed' ? ' failed' : '') + (r.id === state.selectedId ? ' selected' : ''),
          'data-id': r.id
        },
        [
          el('span', { class: 'date', text: formatDate(rec.createdAt) }),
          el('span', { class: 'host', text: text(rec.host) }),
          el('span', { class: 'user', text: text(rec.username) }),
          el('span', { class: 'badge' + (r.synced ? '' : ' unsynced'), text: statusLabel(rec.status) })
        ]
      );
      row.addEventListener('click', function () {
        openDetail(r.id);
      });
      ui.list.appendChild(el('li', null, [row]));
    });
    var total = state.records.length;
    ui.count.textContent = q ? shown.length + ' / ' + total + ' kayıt' : total + ' kayıt';
    ui.empty.hidden = shown.length > 0;
    ui.empty.textContent = total === 0 ? 'Henüz kayıt yok.' : 'Eşleşen kayıt yok.';
  }

  // ---------- Ayrıntı ----------

  function kv(label, valueNode) {
    return [el('dt', { text: label }), el('dd', null, [valueNode])];
  }

  async function openDetail(id) {
    var key = await requireKey();
    if (!key) return;
    var r = findRecord(id);
    if (!r) return;
    var token = ++state.detailToken;
    var gen = state.gen;
    revokeShot();
    state.selectedId = id;
    state.showPassword = false;
    renderList();

    var rec = r.rec;
    var pwNode = el('span', { id: 'detail-password', class: 'secret', text: MASK });
    var showBtn = button('btn-show', 'Göster', '', function () {
      onTogglePassword(id, pwNode, showBtn);
    });
    var copyBtn = button('btn-copy', 'Kopyala', '', function () {
      onCopy(id);
    });
    var shotBox = el('div', { id: 'detail-shot', class: 'shot muted small', text: 'Ekran görüntüsü yükleniyor…' });
    var events = el(
      'ol',
      { id: 'detail-events', class: 'events' },
      (Array.isArray(rec.events) ? rec.events : []).map(function (e) {
        return el('li', {
          class: e && e.status === 'failed' ? 'muted' : '',
          text: formatDate(e && e.at) + ' – ' + methodLabel(e && e.method) + ' – ' + statusLabel(e && e.status)
        });
      })
    );

    var dl = el('dl', { class: 'kv' }, []);
    [
      kv('Tarih', el('span', { id: 'detail-date', text: formatDate(rec.createdAt) })),
      kv('Adres', el('span', { id: 'detail-url', text: text(rec.url) })),
      kv('Kullanıcı adı', el('span', { id: 'detail-username', text: text(rec.username) })),
      kv('Şifre', el('div', null, [pwNode, el('div', { class: 'actions under' }, [showBtn, copyBtn])])),
      kv('Yöntem', el('span', { id: 'detail-method', text: methodLabel(rec.method) })),
      kv('Durum', el('span', { id: 'detail-status', text: statusLabel(rec.status) })),
      kv('Eşitleme', el('span', { id: 'detail-sync', text: r.synced ? 'Eşitlendi' : 'Bu bilgisayarda bekliyor' }))
    ].forEach(function (pair) {
      dl.appendChild(pair[0]);
      dl.appendChild(pair[1]);
    });

    clear(ui.detail);
    ui.detail.appendChild(
      el('div', { class: 'detailhead' }, [
        el('h3', { id: 'detail-host', text: text(rec.host) }),
        el('button', {
          id: 'btn-close-detail',
          type: 'button',
          class: 'close',
          text: '×',
          'aria-label': 'Kapat',
          onclick: closeDetail
        })
      ])
    );
    ui.detail.appendChild(dl);
    ui.detail.appendChild(el('h3', { text: 'Olaylar' }));
    ui.detail.appendChild(events);
    ui.detail.appendChild(el('h3', { text: 'Ekran görüntüsü' }));
    ui.detail.appendChild(shotBox);
    ui.detail.appendChild(el('div', { class: 'actions' }, [button('btn-delete', 'Sil', 'danger', function () {
      onDelete(id);
    })]));
    ui.detail.hidden = false;
    ui.grid.classList.add('with-detail');

    // Ekran görüntüsü: şifreli baytlar çözülür, yalnızca bu sayfaya özel bir blob adresiyle gösterilir.
    try {
      var env = await store.getShot(id);
      if (token !== state.detailToken || gen !== state.gen) return;
      if (!env) {
        shotBox.textContent = 'Ekran görüntüsü yok.';
        return;
      }
      var bytes = await C.decryptBytes(key, env);
      if (token !== state.detailToken || gen !== state.gen) return;
      var url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
      state.shotUrl = url;
      clear(shotBox);
      shotBox.className = 'shot';
      shotBox.appendChild(el('img', { id: 'detail-shot-img', src: url, alt: 'Gönderim anındaki ekran görüntüsü' }));
    } catch (e) {
      if (token === state.detailToken) shotBox.textContent = 'Ekran görüntüsü çözülemedi.';
    }
  }

  function closeDetail() {
    state.detailToken++;
    revokeShot();
    state.selectedId = null;
    state.showPassword = false;
    if (ui.detail) {
      clear(ui.detail);
      ui.detail.hidden = true;
    }
    if (ui.grid) ui.grid.classList.remove('with-detail');
    renderList();
  }

  async function onTogglePassword(id, pwNode, btn) {
    if (!(await requireKey())) return;
    var r = findRecord(id);
    if (!r || state.selectedId !== id) return;
    state.showPassword = !state.showPassword;
    // Şifre yalnızca metin düğümüne yazılır; hiçbir özniteliğe/başlığa/adrese girmez.
    pwNode.textContent = state.showPassword ? String(r.rec.password || '') : MASK;
    btn.textContent = state.showPassword ? 'Gizle' : 'Göster';
  }

  async function onCopy(id) {
    if (!(await requireKey())) return;
    var r = findRecord(id);
    if (!r) return;
    try {
      await navigator.clipboard.writeText(String(r.rec.password || ''));
      toast('Şifre panoya kopyalandı.');
    } catch (e) {
      toast('Kopyalanamadı: tarayıcı panoya erişim vermedi.', true);
    }
  }

  async function onDelete(id) {
    if (!(await requireKey())) return;
    var r = findRecord(id);
    if (!r) return;
    var label = text(r.rec.host) + ' – ' + text(r.rec.username);
    if (!g.confirm('Bu kayıt silinsin mi?\n' + label + '\n\nBu işlem geri alınamaz (yedeğiniz yoksa kayıt kaybolur).')) return;
    try {
      await store.deleteRecord(id);
    } catch (e) {
      toast('Kayıt silinemedi.', true);
      return;
    }
    state.records = state.records.filter(function (x) {
      return x.id !== id;
    });
    state.pending = state.records.filter(function (x) {
      return !x.synced;
    }).length;
    closeDetail();
    await renderWarnings();
    toast('Kayıt silindi.');
  }

  async function onRefresh() {
    var key = await requireKey();
    if (!key) return;
    await refreshData(key);
    toast('Liste yenilendi.');
  }

  async function onLockNow() {
    try {
      await S.lock(session);
    } catch (e) {}
    lockUi('Kasa kilitlendi.');
  }

  // ---------- Yedek ----------

  function today() {
    var d = new Date();
    function two(n) {
      return (n < 10 ? '0' : '') + n;
    }
    return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
  }

  async function onBackup() {
    if (!(await requireKey())) return;
    try {
      var header = await store.getHeader();
      var list = await store.listRecords();
      var shots = {};
      for (var i = 0; i < list.length; i++) {
        var shot = await store.getShot(list[i].id);
        if (shot) shots[list[i].id] = shot;
      }
      // Kayıtlar zaten şifreli; dosyaya olduğu gibi yazılır.
      var backup = B.buildBackup(header, list, shots);
      var name = 'keylord-yedek-' + today() + '.json';
      var url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      var a = el('a', { href: url, download: name, hidden: true });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      toast('Yedek indirildi: ' + name + ' (' + list.length + ' kayıt)');
    } catch (e) {
      toast('Yedek alınamadı.', true);
    }
  }

  // hasVault: ana ekrandan (mevcut kasaya birleştirme) mı, kurulumdan (yedeğin kasası benimsenir) mi.
  function buildRestorePanel(hasVault) {
    var file = el('input', { id: 'restore-file', type: 'file', accept: '.json,application/json' });
    var p = passwordField('restore-password', 'Yedeğin ana parolası', 'off');
    var msg = el('div', { id: 'restore-msg', class: 'msg', role: 'status' });
    var run = el('button', { id: 'btn-restore-run', type: 'submit', class: 'btn primary', text: 'Yükle' });
    var cancel = button('btn-restore-cancel', 'Vazgeç', '', function () {
      file.value = '';
      p.input.value = '';
      setMsg(msg, '');
      node.hidden = true;
    });
    var form = el('form', { id: 'restore-form', autocomplete: 'off' }, [
      el('label', { class: 'lbl', for: 'restore-file' }, ['Yedek dosyası (keylord-yedek-….json)', file]),
      p.node,
      el('div', { class: 'actions' }, [run, cancel]),
      msg
    ]);
    var node = el('section', { id: 'restore-panel', class: 'panel' }, [
      el('h3', { text: 'Yedekten yükle' }),
      el('p', {
        class: 'muted small',
        text: hasVault
          ? 'Yedekteki kayıtlar bu kasaya eklenir; aynı kayıtlar yedektekiyle değiştirilir.'
          : 'Yedeğin kasası bu cihazın kasası olur; sonra yedeğin ana parolasıyla açılır.'
      }),
      form
    ]);

    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (state.busy) return;
      var f = file.files && file.files[0];
      if (!f) {
        setMsg(msg, 'Yedek dosyası seçin.', 'error');
        return;
      }
      var pw = p.input.value;
      p.input.value = '';
      if (!pw) {
        setMsg(msg, 'Yedeğin ana parolasını girin.', 'error');
        return;
      }
      state.busy = true;
      run.disabled = true;
      setMsg(msg, 'Yedek doğrulanıyor…');
      try {
        await runRestore(f, pw, msg);
      } finally {
        pw = '';
        state.busy = false;
        run.disabled = false;
      }
    });

    return { node: node, file: file };
  }

  async function runRestore(f, pw, msg) {
    var backup;
    try {
      backup = B.parseBackup(await f.text());
    } catch (e) {
      setMsg(msg, ERRORS['not-a-backup'], 'error');
      return;
    }
    var currentHeader = await store.getHeader();
    var currentKey = null;
    if (currentHeader) {
      currentKey = await requireKey(); // mevcut kasa önce açık olmalı
      if (!currentKey) return;
    }
    var res;
    try {
      res = await B.restoreBackup({
        backup: backup,
        backupPassword: pw,
        currentHeader: currentHeader,
        currentPrivateKey: currentKey
      });
    } catch (e) {
      var code = errorCode(e);
      if (code === 'wrong-password') setMsg(msg, ERRORS['backup-wrong-password'], 'error');
      else if (code === 'bad-envelope' || code === 'not-a-backup') setMsg(msg, ERRORS[code], 'error');
      else setMsg(msg, 'Yedek yüklenemedi.', 'error');
      return;
    }
    try {
      if (!currentHeader) await store.putHeader(res.header); // yedeğin kasası benimsenir
      for (var i = 0; i < res.records.length; i++) await store.putRecord(res.records[i].id, res.records[i].envelope);
      for (var id in res.shots) {
        if (Object.prototype.hasOwnProperty.call(res.shots, id)) await store.putShot(id, res.shots[id]);
      }
    } catch (e) {
      setMsg(msg, 'Yedek yazılamadı (depolama hatası).', 'error');
      return;
    }
    var n = res.records.length;
    if (!currentHeader) {
      // Yeni benimsenen kasa yedeğin parolasıyla açılır (parola doğrulandı).
      var key;
      try {
        key = await C.unlockVault(res.header, pw);
      } catch (e) {
        showUnlock('Yedek yüklendi. Yedeğin ana parolasıyla kilidi açın.');
        return;
      }
      await S.saveKey(session, key, now());
      await showMain(key);
    } else {
      var k = await requireKey();
      if (!k) return;
      if (ui.restore) ui.restore.node.hidden = true;
      await refreshData(k);
    }
    toast(n + ' kayıt yedekten yüklendi.');
  }

  // ---------- Başlangıç ----------

  async function init() {
    root = el('div', { id: 'app', class: 'app' });
    document.body.appendChild(root);
    // Hareketsizlik denetimi her ekranda kurulur (yalnızca ana ekranda iş yapar).
    setInterval(checkIdle, Math.max(250, Math.min(5000, Math.floor(IDLE_MS / 4))));
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) checkIdle();
    });
    try {
      var header = await store.getHeader();
      if (!header) {
        showSetup();
        return;
      }
      var key = null;
      try {
        key = await S.loadKey(session, now());
      } catch (e) {
        key = null;
      }
      if (key) await showMain(key);
      else showUnlock();
    } catch (e) {
      mount(null, [el('div', { class: 'card notice', role: 'alert', text: 'Kasa yüklenemedi. Sayfayı yenileyin.' })]);
    }
  }

  init();
})(globalThis);
