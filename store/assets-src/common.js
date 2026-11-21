// Mağaza ekran görüntüleri için ortak hazırlık: GitHub isteğini sabit yanıtla karşılar (çıktı her seferinde aynı olsun),
// kurulu sürümü manifest'teki sürüm yapar ve sahte bir konsol bileşeni kurar (engine.js bunu bulur).
(function (g) {
  'use strict';
  var VERSION = '1.1.3';
  var SHA = 'e59765c0000000';
  g.__SHOWCASE_VERSION = VERSION;
  g.fetch = function (url) {
    var body = /releases\/latest$/.test(url)
      ? { tag_name: 'v' + VERSION, html_url: 'https://github.com/gurkandeveci/KeyLord/releases/tag/v' + VERSION }
      : { sha: SHA };
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve(body); } });
  };
  if (g.__shim) g.__shim.bg.installed = VERSION;

  // Sahte WMKS bileşeni: canvas'ın üstündeki öğeye jQuery veri alanı gibi bir özellik eklenir.
  g.installFakeConsole = function (container) {
    container['jQuery' + '1234567'] = {
      nwmks: { _vncDecoder: { _serverInitialized: true, onKeyVScan: function () {} } }
    };
  };

  g.setSettings = function (settings) {
    return chrome.storage.local.set({ settings: settings });
  };
})(globalThis);
