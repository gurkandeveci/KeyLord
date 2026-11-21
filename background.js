importScripts('src/vault-crypto.js', 'src/store.js');

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

// ---- Kasa mesajları (sayfa içi kutu -> service worker) ----
// Kayıtlar kasanın açık anahtarıyla şifrelenip depolanır; düz metin parola burada saklanmaz ve günlüğe yazılmaz.
const store = KeyLordStore.createStore({ sync: chrome.storage.sync, local: chrome.storage.local });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Yalnızca bu eklentinin kendi bağlamlarından gelen mesajlar işlenir.
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (!msg || typeof msg.type !== 'string') {
    sendResponse({ ok: false, error: 'unknown' });
    return false;
  }
  let task;
  switch (msg.type) {
    case 'vault:exists': task = handleExists(); break;
    case 'record:put': task = handleRecordPut(msg); break;
    case 'shot:capture': task = handleShot(msg, sender); break;
    case 'vault:open': task = handleOpen(); break;
    default:
      sendResponse({ ok: false, error: 'unknown' });
      return false;
  }
  task.then(sendResponse, (err) => sendResponse({ ok: false, error: errCode(err) }));
  return true; // yanıt eşzamansız
});

function errCode(err) {
  return (err && err.message ? String(err.message) : 'error').slice(0, 80);
}

async function handleExists() {
  return { exists: !!(await store.getHeader()) };
}

async function handleRecordPut(msg) {
  if (typeof msg.id !== 'string' || !msg.id || !msg.record || typeof msg.record !== 'object') {
    return { ok: false, error: 'bad-request' };
  }
  const header = await store.getHeader();
  if (!header) return { ok: false, error: 'no-vault' };
  const env = await KeyLordVaultCrypto.encryptJson(header, msg.record);
  const res = await store.putRecord(msg.id, env);
  try { await store.retryPending(); } catch (e) { /* bekleyenler sonra yeniden denenir */ }
  return { ok: true, synced: res.synced };
}

async function handleShot(msg, sender) {
  try {
    if (!sender.tab || typeof msg.id !== 'string' || !msg.id) throw new Error('bad-request');
    const header = await store.getHeader();
    if (!header) return { ok: false, error: 'no-vault' };
    const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 70 });
    const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const env = await KeyLordVaultCrypto.encryptBytes(header, bytes);
    await store.putShot(msg.id, env);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'capture-failed' };
  }
}

async function handleOpen() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('vault.html') });
  return { ok: true };
}
