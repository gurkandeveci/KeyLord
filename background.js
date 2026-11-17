// Araç çubuğu düğmesine (veya Alt+Shift+K kısayoluna) basılınca etkin sekmeye "KeyLord"
// kutusunu ekler. Yalnızca activeTab izni kullanılır: eklenti, siz düğmeye basmadıkça hiçbir sayfaya erişmez.

const ENGINE_FILE = 'src/engine.js';
const DIALOG_FILES = ['src/layouts.js', 'src/dialog.js'];

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  const tabId = tab.id;
  try {
    const frameId = await injectEngineAndPickFrame(tabId);
    const target = { tabId, frameIds: [frameId] };
    await chrome.scripting.executeScript({ target, files: DIALOG_FILES });
    await chrome.scripting.executeScript({ target, func: () => window.__keyLordDialog.toggle() });
    await chrome.action.setBadgeText({ tabId, text: '' });
  } catch (err) {
    // chrome:// sayfaları, Chrome Web Mağazası gibi yerlere eklentiler erişemez.
    await chrome.action.setBadgeBackgroundColor({ tabId, color: '#c62828' });
    await chrome.action.setBadgeText({ tabId, text: '!' });
    await chrome.action.setTitle({ tabId, title: 'KeyLord bu sayfada çalışamaz' });
  }
});

// Motoru sayfanın kendi JavaScript dünyasına ekler ve kutunun açılacağı çerçeveyi seçer:
// konsol bir iç çerçevedeyse o çerçeve, değilse üst sayfa.
async function injectEngineAndPickFrame(tabId) {
  let counts;
  try {
    const all = { tabId, allFrames: true };
    await chrome.scripting.executeScript({ target: all, world: 'MAIN', files: [ENGINE_FILE] });
    counts = await chrome.scripting.executeScript({
      target: all,
      world: 'MAIN',
      func: () => (window.KeyLordEngine && window.KeyLordEngine.consoleCount ? window.KeyLordEngine.consoleCount() : 0)
    });
  } catch (err) {
    // İç çerçevelerden birine erişilemediyse yalnızca üst sayfayla devam et.
    await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', files: [ENGINE_FILE] });
    return 0;
  }
  const withConsole = counts.find((entry) => entry.result > 0);
  return withConsole ? withConsole.frameId : 0;
}
