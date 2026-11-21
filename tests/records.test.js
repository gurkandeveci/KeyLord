(function () {
  var R = globalThis.KeyLordRecords;

  test('kayıt: newRecord alanları', function () {
    var r = R.newRecord(
      { url: 'https://a.com/x', host: 'a.com', username: 'u', password: 'p', method: 'usb' },
      1000,
      'id1'
    );
    assertEqual(r.id, 'id1');
    assertEqual(r.createdAt, 1000);
    assertEqual(r.url, 'https://a.com/x');
    assertEqual(r.host, 'a.com');
    assertEqual(r.username, 'u');
    assertEqual(r.password, 'p');
    assertEqual(r.method, 'usb');
    assertEqual(r.status, 'pending');
    assertEqual(r.hasScreenshot, false);
    assertEqual(r.events.length, 1);
    assertEqual(r.events[0].at, 1000);
    assertEqual(r.events[0].method, 'usb');
    assertEqual(r.events[0].status, 'pending');
  });

  test('kayıt: withEvent orijinali değiştirmez', function () {
    var r = R.newRecord({ url: 'u', host: 'h', username: 'a', password: 'p', method: 'usb' }, 1, 'i');
    var r2 = R.withEvent(r, { at: 2, method: 'fill', status: 'sent' });
    assertEqual(r.events.length, 1);
    assertEqual(r.status, 'pending');
    assertEqual(r.method, 'usb');
    assertEqual(r2.events.length, 2);
    assertEqual(r2.status, 'sent');
    assertEqual(r2.method, 'fill');
    assertEqual(r2.events[1].at, 2);
    assertTrue(r2.events !== r.events);
    r2.events[0].status = 'x';
    assertEqual(r.events[0].status, 'pending');
  });

  test('kayıt: runStatus', function () {
    assertEqual(R.runStatus({ sent: 3, total: 3, cancelled: false }), 'sent');
    assertEqual(R.runStatus({ sent: 0, total: 3, cancelled: true }), 'failed');
    assertEqual(R.runStatus({ sent: 1, total: 3, cancelled: false }), 'partial');
    assertEqual(R.runStatus({ sent: 3, total: 3, cancelled: true }), 'partial');
    assertEqual(R.runStatus({ sent: 0, total: 0, cancelled: false }), 'failed');
  });

  test('kayıt: fillStatus', function () {
    assertEqual(R.fillStatus(0), 'failed');
    assertEqual(R.fillStatus(2), 'sent');
  });

  test('kayıt: STATUS_LABELS', function () {
    assertEqual(R.STATUS_LABELS.pending, 'Bekliyor');
    assertEqual(R.STATUS_LABELS.sent, 'Gönderildi');
    assertEqual(R.STATUS_LABELS.partial, 'Yarım');
    assertEqual(R.STATUS_LABELS.failed, 'Başarısız');
    assertEqual(R.STATUS_LABELS.copied, 'Kopyalandı');
  });

  test('kayıt: bestStatus olaylardaki en iyi sonucu döner', function () {
    function rec(statuses, top) {
      return {
        status: top || statuses[statuses.length - 1],
        events: statuses.map(function (st, i) { return { at: i, method: 'usb', status: st }; })
      };
    }
    assertEqual(R.bestStatus(rec(['pending', 'sent', 'failed'])), 'sent', 'gönderildi sonra başarısız');
    assertEqual(R.bestStatus(rec(['pending', 'copied', 'failed'])), 'copied');
    assertEqual(R.bestStatus(rec(['pending', 'partial', 'copied'])), 'partial');
    assertEqual(R.bestStatus(rec(['pending', 'failed'])), 'pending');
    assertEqual(R.bestStatus(rec(['failed'])), 'failed');
    assertEqual(R.bestStatus(rec(['pending', 'sent', 'partial', 'copied'])), 'sent');
    assertEqual(R.bestStatus({ status: 'sent', events: [] }), 'sent', 'olay yok: status');
    assertEqual(R.bestStatus({ status: 'copied' }), 'copied', 'events yok');
    assertEqual(R.bestStatus({ status: 'failed', events: [null, { status: 'bilinmeyen' }] }), 'failed', 'tanınmayan olay');
    assertEqual(R.bestStatus(null), undefined, 'kayıt yok');
  });

  test('kayıt: withEvent son olayı status yapar (değişmedi)', function () {
    var r = R.newRecord({ url: 'u', host: 'h', username: 'a', password: 'p', method: 'usb' }, 1, 'i');
    var r2 = R.withEvent(R.withEvent(r, { at: 2, method: 'usb', status: 'sent' }), { at: 3, method: 'usb', status: 'failed' });
    assertEqual(r2.status, 'failed');
    assertEqual(R.bestStatus(r2), 'sent');
  });
})();
