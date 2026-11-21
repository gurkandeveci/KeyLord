// Proje kökünden çalıştırın:
//   macOS : /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc tests/run.js
//   Node  : node tests/run.js
var loadFile =
  typeof load === 'function'
    ? load
    : function (path) {
        require('vm').runInThisContext(require('fs').readFileSync(path, 'utf8'), path);
      };

loadFile('tests/harness.js');
loadFile('src/layouts.js');
loadFile('src/engine.js');
loadFile('src/generator.js');
loadFile('src/vault-crypto.js');
loadFile('src/vault-session.js');
loadFile('src/records.js');
loadFile('src/store.js');
loadFile('src/backup.js');
loadFile('tests/layouts.test.js');
loadFile('tests/engine.test.js');
loadFile('tests/generator.test.js');
loadFile('tests/records.test.js');
loadFile('tests/store.test.js');
// WebCrypto gerektiren testler yalnızca crypto.subtle varsa (jsc'de atlanır).
if (globalThis.crypto && globalThis.crypto.subtle) {
  loadFile('tests/vault-crypto.test.js');
  loadFile('tests/vault-session.test.js');
  loadFile('tests/backup.test.js');
}

runTests();
