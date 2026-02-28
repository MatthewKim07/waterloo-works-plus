(function initPopup(global) {
  const ns = (global.WWP = global.WWP || {});

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text, isError) {
    const node = byId("status");
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? "#fca5a5" : "#9fb9ea";
  }

  function setToggleButtonLabel(enabled) {
    const btn = byId("toggleExtensionBtn");
    if (!btn) return;
    btn.textContent = enabled ? "Disable extension" : "Enable extension";
  }

  async function wire() {
    const settings = await ns.getSettings();
    const enabled = !!settings.enabled;
    setToggleButtonLabel(enabled);
    setStatus(enabled ? "Extension enabled." : "Extension disabled.", false);

    const toggleBtn = byId("toggleExtensionBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", async () => {
        const current = await ns.getSettings();
        current.enabled = !current.enabled;
        await ns.saveSettings(current);
        setToggleButtonLabel(current.enabled);
        setStatus(current.enabled ? "Extension enabled." : "Extension disabled.");
      });
    }

    const appBtn = byId("openAppBtn");
    if (appBtn) {
      appBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("src/app/app.html") });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", wire);
})(globalThis);
