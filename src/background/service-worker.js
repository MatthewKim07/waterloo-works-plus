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
    const method = String(message.method || "GET").toUpperCase();
    const headers = message.headers && typeof message.headers === "object" ? { ...message.headers } : {};
    const body = typeof message.body === "string" ? message.body : undefined;
    (async () => {
      try {
        const parsed = new URL(String(url || ""));
        if (!/(^|\.)waterlooworks\.uwaterloo\.ca$/i.test(parsed.hostname)) {
          sendResponse({ ok: false, error: "Blocked non-WaterlooWorks URL" });
          return;
        }
        const response = await fetch(url, {
          method,
          headers,
          body,
          credentials: "include",
          redirect: "follow"
        });
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

  if (message.type === "wwp:probeJobPostingInBackground") {
    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
    const sourcePageUrl = String(payload.pageUrl || "");
    const jobId = String(payload.jobId || "").trim();
    const title = String(payload.title || "").trim();

    const waitForTabLoad = (tabId, timeoutMs) =>
      new Promise((resolve, reject) => {
        const started = Date.now();
        const onUpdated = (updatedTabId, changeInfo) => {
          if (updatedTabId !== tabId) return;
          if (changeInfo.status !== "complete") return;
          cleanup();
          resolve(true);
        };
        const timer = setInterval(async () => {
          if (Date.now() - started > timeoutMs) {
            cleanup();
            reject(new Error("Probe tab load timeout"));
            return;
          }
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab && tab.status === "complete") {
              cleanup();
              resolve(true);
            }
          } catch (_error) {}
        }, 220);
        const cleanup = () => {
          clearInterval(timer);
          chrome.tabs.onUpdated.removeListener(onUpdated);
        };
        chrome.tabs.onUpdated.addListener(onUpdated);
      });

    const sendProbeMessage = (tabId, probePayload, timeoutMs) =>
      new Promise((resolve, reject) => {
        const started = Date.now();
        let done = false;

        const trySend = () => {
          if (done) return;
          if (Date.now() - started > timeoutMs) {
            done = true;
            reject(new Error("Probe message timeout"));
            return;
          }
          chrome.tabs.sendMessage(tabId, { type: "wwp:probeExtractByJob", payload: probePayload }, (response) => {
            if (done) return;
            const lastError = chrome.runtime.lastError;
            if (lastError || !response) {
              setTimeout(trySend, 260);
              return;
            }
            done = true;
            resolve(response);
          });
        };

        trySend();
      });

    (async () => {
      let probeTabId = null;
      let probeWindowId = null;
      try {
        if (!/(^|\.)waterlooworks\.uwaterloo\.ca$/i.test(new URL(sourcePageUrl).hostname)) {
          sendResponse({ ok: false, error: "Invalid probe page URL" });
          return;
        }

        const probeUrl = new URL(sourcePageUrl);
        probeUrl.searchParams.set("wwp_probe", "1");
        probeUrl.hash = "";

        try {
          // Keep probe execution out of the user's active tab strip.
          const probeWindow = await chrome.windows.create({
            url: probeUrl.href,
            focused: false,
            state: "minimized"
          });
          probeWindowId = probeWindow && probeWindow.id ? probeWindow.id : null;
          const probeTab =
            probeWindow && Array.isArray(probeWindow.tabs) && probeWindow.tabs.length ? probeWindow.tabs[0] : null;
          probeTabId = probeTab && probeTab.id ? probeTab.id : null;
        } catch (_windowError) {
          const tab = await chrome.tabs.create({
            url: probeUrl.href,
            active: false
          });
          probeTabId = tab && tab.id;
        }

        if (!probeTabId) {
          sendResponse({ ok: false, error: "Failed to create probe tab" });
          return;
        }

        await waitForTabLoad(probeTabId, 12000);
        const result = await sendProbeMessage(
          probeTabId,
          {
            jobId,
            title
          },
          12000
        );

        if (!result || !result.ok) {
          sendResponse({ ok: false, error: (result && result.error) || "Probe content script failed" });
          return;
        }

        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      } finally {
        if (probeWindowId != null) {
          try {
            await chrome.windows.remove(probeWindowId);
            probeWindowId = null;
            probeTabId = null;
          } catch (_error) {}
        }
        if (probeTabId != null) {
          try {
            await chrome.tabs.remove(probeTabId);
          } catch (_error) {}
        }
      }
    })();
    return true;
  }
});
