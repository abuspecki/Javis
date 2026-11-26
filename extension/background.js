// MV3 service worker: opens (or focuses) the J.A.R.V.I.S. interface.
const APP = chrome.runtime.getURL('index.html');

async function openJarvis() {
  const [existing] = await chrome.tabs.query({ url: APP });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP });
  }
}

chrome.action.onClicked.addListener(openJarvis);
chrome.commands.onCommand.addListener((cmd) => { if (cmd === 'open-jarvis') openJarvis(); });
