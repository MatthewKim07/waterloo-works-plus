importScripts("../shared/schema.js");
importScripts("../shared/storage.js");

const OFFSCREEN_AI_PATH = "src/offscreen/ai.html";
let creatingAiDocument = null;
const AI_RUNTIME_READY_TIMEOUT_MS = 15000;
const aiRuntimeState = {
  ready: false,
  lastError: "",
  lastReadyAt: 0
};

async function hasOffscreenDocument(path) {
  const documentUrl = chrome.runtime.getURL(path);
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [documentUrl]
    });
    return contexts.length > 0;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => client.url === documentUrl);
}

async function ensureAiOffscreenDocument() {
  if (await hasOffscreenDocument(OFFSCREEN_AI_PATH)) return;
  if (creatingAiDocument) {
    await creatingAiDocument;
    return;
  }

  const reasons = [];
  if (chrome.offscreen && chrome.offscreen.Reason) {
    if (chrome.offscreen.Reason.WORKERS) reasons.push(chrome.offscreen.Reason.WORKERS);
    if (!reasons.length && chrome.offscreen.Reason.DOM_PARSER) reasons.push(chrome.offscreen.Reason.DOM_PARSER);
  }
  if (!reasons.length) reasons.push("WORKERS");

  creatingAiDocument = chrome.offscreen.createDocument({
    url: OFFSCREEN_AI_PATH,
    reasons,
    justification: "Run the local WaterlooWorks+ embedding runtime in a hidden document"
  });

  try {
    await creatingAiDocument;
  } finally {
    creatingAiDocument = null;
  }
}

async function waitForAiRuntimeReady(timeoutMs) {
  const deadline = Date.now() + (Number.isFinite(timeoutMs) ? timeoutMs : AI_RUNTIME_READY_TIMEOUT_MS);
  while (Date.now() < deadline) {
    if (aiRuntimeState.ready) return;
    if (aiRuntimeState.lastError) {
      throw new Error(aiRuntimeState.lastError);
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("AI runtime did not become ready in time");
}

function sendMessageToOffscreen(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message || "Offscreen runtime message failed"));
        return;
      }
      if (!response) {
        reject(new Error("Offscreen runtime did not respond"));
        return;
      }
      resolve(response);
    });
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  const key = globalThis.WWP.STORAGE_KEYS.settings;
  const current = await chrome.storage.local.get([key]);
  if (!current[key]) {
    await chrome.storage.local.set({ [key]: globalThis.WWP.getDefaultSettingsShape() });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "wwp:aiRuntimeReady") {
    aiRuntimeState.ready = true;
    aiRuntimeState.lastError = "";
    aiRuntimeState.lastReadyAt = Date.now();
    return;
  }

  if (message.type === "wwp:aiRuntimeBootError") {
    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
    aiRuntimeState.ready = false;
    aiRuntimeState.lastError = String(payload.error || "AI runtime failed to boot");
    return;
  }

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
    (async () => {
      try {
        const settings = await globalThis.WWP.getSettings();
        sendResponse({ settings });
      } catch (_error) {
        sendResponse({ settings: globalThis.WWP.getDefaultSettingsShape() });
      }
    })();
    return true;
  }

  if (message.type === "wwp:aiEmbeddingSmokeTest") {
    const payload = message.payload && typeof message.payload === "object" ? message.payload : {};
    (async () => {
      try {
        const hadDocument = await hasOffscreenDocument(OFFSCREEN_AI_PATH);
        if (!hadDocument) {
          aiRuntimeState.lastError = "";
          aiRuntimeState.ready = false;
        }
        await ensureAiOffscreenDocument();
        await waitForAiRuntimeReady(AI_RUNTIME_READY_TIMEOUT_MS);
        const result = await sendMessageToOffscreen({
          target: "offscreen-ai",
          type: "wwp:aiEmbeddingSmokeTest",
          payload: {
            text: typeof payload.text === "string" ? payload.text : ""
          }
        });
        sendResponse(result);
      } catch (error) {
        sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
      }
    })();
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
