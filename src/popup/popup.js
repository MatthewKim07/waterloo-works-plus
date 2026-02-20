(function initPopup(global) {
  const ns = (global.WWP = global.WWP || {});

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text, isError) {
    const node = byId("status");
    node.textContent = text;
    node.style.color = isError ? "#b91c1c" : "#475569";
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs && tabs[0] ? tabs[0] : null);
      });
    });
  }

  function getPathFromUrl(url) {
    try {
      return new URL(url).pathname;
    } catch (_error) {
      return null;
    }
  }

  async function refreshPageToggleText() {
    const tab = await getActiveTab();
    const btn = byId("togglePageBtn");

    if (!tab || !tab.url || !/waterlooworks/i.test(tab.url)) {
      btn.disabled = true;
      btn.textContent = "Not on WaterlooWorks";
      return;
    }

    const path = getPathFromUrl(tab.url);
    const settings = await ns.getSettings();
    const disabled = settings.disabledPaths.includes(path);

    btn.disabled = false;
    btn.textContent = disabled ? "Enable on this page" : "Disable on this page";
  }

  async function wire() {
    const settings = await ns.getSettings();
    byId("globalToggle").checked = settings.enabled;

    byId("globalToggle").addEventListener("change", async (event) => {
      const current = await ns.getSettings();
      current.enabled = !!event.target.checked;
      await ns.saveSettings(current);
      setStatus(current.enabled ? "Extension enabled globally." : "Extension disabled globally.");
    });

    byId("togglePageBtn").addEventListener("click", async () => {
      const tab = await getActiveTab();
      if (!tab || !tab.url) {
        setStatus("Could not read current tab.", true);
        return;
      }
      const path = getPathFromUrl(tab.url);
      if (!path) {
        setStatus("Could not parse page URL.", true);
        return;
      }

      const disabled = await ns.togglePageDisabled(path);
      await refreshPageToggleText();
      setStatus(disabled ? `Disabled on ${path}` : `Enabled on ${path}`);
    });

    byId("openAppBtn").addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/app/app.html") });
    });

    await refreshPageToggleText();
  }

  document.addEventListener("DOMContentLoaded", wire);
})(globalThis);
