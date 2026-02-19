const STORAGE_KEY_SETTINGS = "wwpSettings";

const DEFAULT_SETTINGS = {
  enabled: true,
  disabledPaths: [],
  resumeRawText: "",
  resumeSkills: {},
  preferences: {
    workTerm: 1,
    faculty: "Engineering",
    targetRole: "",
    industries: [],
    preferredTermLength: "4",
    globalDisableOnUnsupportedPages: false
  }
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get([STORAGE_KEY_SETTINGS]);
  if (!current[STORAGE_KEY_SETTINGS]) {
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: DEFAULT_SETTINGS });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "wwp:fetchJobHtml") {
    const url = message.url;
    (async () => {
      try {
        const parsed = new URL(String(url || ""));
        if (!/(^|\.)waterlooworks\.uwaterloo\.ca$/i.test(parsed.hostname)) {
          sendResponse({ ok: false, error: "Blocked non-WaterlooWorks URL" });
          return;
        }
        const response = await fetch(url, { credentials: "include" });
        const text = await response.text();
        sendResponse({ ok: response.ok, status: response.status, text });
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
    return true;
  }

  if (message.type === "wwp:getSettings") {
    chrome.storage.local.get([STORAGE_KEY_SETTINGS], (result) => {
      sendResponse({ settings: result[STORAGE_KEY_SETTINGS] || DEFAULT_SETTINGS });
    });
    return true;
  }
});
