// Küçük test koşucusu: hem macOS `jsc` kabuğunda hem Node.js'te çalışır.
(function (g) {
  var out = typeof print === 'function' ? print : console.log;
  var tests = [];

  g.test = function (name, fn) {
    tests.push({ name: name, fn: fn });
  };

  g.assertEqual = function (actual, expected, label) {
    var a = JSON.stringify(actual);
    var e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error((label ? label + ': ' : '') + 'beklenen ' + e + ', gelen ' + a);
    }
  };

  g.assertTrue = function (value, label) {
    if (!value) throw new Error(label || 'doğru olması bekleniyordu');
  };

  g.runTests = async function () {
    var failed = 0;
    for (var i = 0; i < tests.length; i++) {
      try {
        await tests[i].fn();
        out('ok   ' + tests[i].name);
      } catch (err) {
        failed++;
        out('FAIL ' + tests[i].name + '\n     ' + (err && err.message ? err.message : err));
      }
    }
    out('\n' + (tests.length - failed) + '/' + tests.length + ' test geçti' + (failed ? ' — BAŞARISIZ' : ''));
    if (failed && typeof process !== 'undefined') process.exitCode = 1;
  };
})(globalThis);
