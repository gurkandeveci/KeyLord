(function () {
  var F = globalThis.KeyLordFieldFill;

  function f(o) {
    return Object.assign({ isPassword: true, empty: true, visible: true, editable: true }, o || {});
  }
  var user = f({ isPassword: false });

  test('alan doldurma: odak yeni şifrede -> [yeni, tekrar]', function () {
    var fields = [user, f(), f()];
    assertEqual(F.pickTargets(fields, 1), [1, 2]);
  });

  test('alan doldurma: odak tekrar alanında -> yalnızca o', function () {
    assertEqual(F.pickTargets([user, f(), f()], 2), [2]);
  });

  test('alan doldurma: odak kullanıcı adında -> tüm boş şifre alanları', function () {
    assertEqual(F.pickTargets([user, f(), f()], 0), [1, 2]);
  });

  test('alan doldurma: odak yok (-1/undefined/null) -> tüm uygunlar', function () {
    var fields = [user, f(), f()];
    assertEqual(F.pickTargets(fields, -1), [1, 2]);
    assertEqual(F.pickTargets(fields, undefined), [1, 2]);
    assertEqual(F.pickTargets(fields, null), [1, 2]);
  });

  test('alan doldurma: kullanıcı adı + dolu şifre -> []', function () {
    assertEqual(F.pickTargets([user, f({ empty: false })], -1), []);
    assertEqual(F.pickTargets([user, f({ empty: false })], 1), []);
  });

  test('alan doldurma: değiştirme formu dolu mevcut şifreyi atlar', function () {
    var fields = [user, f({ empty: false }), f(), f()];
    assertEqual(F.pickTargets(fields, 2), [2, 3]);
    assertEqual(F.pickTargets(fields, -1), [2, 3]);
  });

  test('alan doldurma: gizli alan atlanır', function () {
    assertEqual(F.pickTargets([f({ visible: false }), f(), f()], -1), [1, 2]);
  });

  test('alan doldurma: readonly/disabled alan atlanır', function () {
    assertEqual(F.pickTargets([f({ editable: false }), f()], -1), [1]);
  });

  test('alan doldurma: odaklı alan uygun değilse tüm uygunlar', function () {
    assertEqual(F.pickTargets([f({ empty: false }), f(), f()], 0), [1, 2]);
  });

  test('alan doldurma: odaklıdan sonra uygun yoksa yalnızca odaklı', function () {
    assertEqual(F.pickTargets([f(), f({ visible: false })], 0), [0]);
  });

  test('alan doldurma: boş liste -> []', function () {
    assertEqual(F.pickTargets([], -1), []);
  });
})();
