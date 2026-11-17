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
loadFile('tests/layouts.test.js');
loadFile('tests/engine.test.js');

runTests();
