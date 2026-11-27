// MV3 service worker for J.A.R.V.I.S.
//  1. Opens (or focuses) the J.A.R.V.I.S. interface.
//  2. Lets the built-in browser panel embed any website: for sub-frames inside J.A.R.V.I.S. tabs only,
//     the headers that forbid embedding (X-Frame-Options, CSP frame-ancestors) are removed.
//     Normal browsing in all other tabs is not affected.

const APP = chrome.runtime.getURL('index.html');
const FRAME_RULE_ID = 1;
const jarvisTabs = new Set();

async function openJarvis() {
  const [existing] = await chrome.tabs.query({ url: APP });
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: APP });
  }
}

async function syncFramingRule() {
  // Session rules vanish when the browser closes; tabs re-register when J.A.R.V.I.S. loads.
  const addRules = jarvisTabs.size ? [{
    id: FRAME_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'x-frame-options', operation: 'remove' },
        // frame-ancestors lives inside CSP; DNR can only drop the whole header, and only for these frames.
        { header: 'content-security-policy', operation: 'remove' },
        { header: 'content-security-policy-report-only', operation: 'remove' },
      ],
    },
    condition: { resourceTypes: ['sub_frame'], tabIds: [...jarvisTabs] },
  }] : [];
  await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [FRAME_RULE_ID], addRules });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only our own extension page may register a tab (no content scripts exist).
  const fromJarvis = sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL(''));
  if (msg?.type !== 'jarvis:allow-framing' || !fromJarvis || sender.tab?.id == null) return false;
  jarvisTabs.add(sender.tab.id);
  syncFramingRule().then(() => sendResponse({ ok: true }), (e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async response
});

chrome.tabs.onRemoved.addListener((tabId) => { if (jarvisTabs.delete(tabId)) syncFramingRule(); });
chrome.tabs.onUpdated.addListener((tabId, info) => {
  // Tab navigated away from J.A.R.V.I.S. → stop relaxing headers there.
  if (info.url && jarvisTabs.has(tabId) && !info.url.startsWith(chrome.runtime.getURL(''))) {
    jarvisTabs.delete(tabId);
    syncFramingRule();
  }
});

// Report navigations inside the embedded page (top-level frame of the panel) back to J.A.R.V.I.S.
chrome.webNavigation.onCommitted.addListener((d) => {
  if (!jarvisTabs.has(d.tabId) || d.frameId === 0 || d.parentFrameId !== 0 || !/^https?:/.test(d.url)) return;
  chrome.runtime.sendMessage({ type: 'jarvis:frame-url', tabId: d.tabId, url: d.url }).catch(() => undefined);
});

chrome.action.onClicked.addListener(openJarvis);
chrome.commands.onCommand.addListener((cmd) => { if (cmd === 'open-jarvis') openJarvis(); });
