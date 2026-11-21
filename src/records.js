// Şifre geçmişi kayıt modeli (şifrelenmeden önceki düz kayıt). Saf fonksiyonlar; girdiyi değiştirmez.
(function (g) {
  'use strict';
  if (g.KeyLordRecords) return; // çift yükleme koruması

  var STATUS_LABELS = {
    pending: 'Bekliyor',
    sent: 'Gönderildi',
    partial: 'Yarım',
    failed: 'Başarısız',
    copied: 'Kopyalandı'
  };

  // Yeni kayıt: tek "bekliyor" olayıyla başlar.
  function newRecord(info, now, id) {
    return {
      id: id,
      createdAt: now,
      url: info.url,
      host: info.host,
      username: info.username,
      password: info.password,
      method: info.method,
      status: 'pending',
      events: [{ at: now, method: info.method, status: 'pending' }],
      hasScreenshot: false
    };
  }

  // Kaydın kopyasını döner; olay eklenir, üst düzey status/method olaydan güncellenir.
  function withEvent(record, ev) {
    var copy = {};
    for (var k in record) {
      if (Object.prototype.hasOwnProperty.call(record, k)) copy[k] = record[k];
    }
    copy.events = record.events.map(function (e) {
      return { at: e.at, method: e.method, status: e.status };
    });
    copy.events.push({ at: ev.at, method: ev.method, status: ev.status });
    copy.status = ev.status;
    copy.method = ev.method;
    return copy;
  }

  // Karakter karakter gönderim sonucu.
  function runStatus(r) {
    if (r.total === 0) return 'failed';
    if (r.sent === r.total && !r.cancelled) return 'sent';
    if (r.sent === 0) return 'failed';
    return 'partial';
  }

  // Alan doldurma sonucu.
  function fillStatus(filledCount) {
    return filledCount > 0 ? 'sent' : 'failed';
  }

  g.KeyLordRecords = {
    newRecord: newRecord,
    withEvent: withEvent,
    runStatus: runStatus,
    fillStatus: fillStatus,
    STATUS_LABELS: STATUS_LABELS
  };
})(globalThis);
