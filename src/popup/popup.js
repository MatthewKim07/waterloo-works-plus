(function initPopup(global) {
  const ns = (global.WWP = global.WWP || {});

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(text, isError) {
    const node = byId("status");
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? "#b91c1c" : "#475569";
  }

  function setToggleButtonLabel(enabled) {
    const btn = byId("toggleExtensionBtn");
    if (!btn) return;
    btn.textContent = enabled ? "Disable extension" : "Enable extension";
  }

  async function wire() {
    const settings = await ns.getSettings();
    const enabled = !!settings.enabled;
    const enabledToggle = byId("enabledToggle");
    if (enabledToggle) {
      enabledToggle.checked = enabled;
    }
    setToggleButtonLabel(enabled);

    if (enabledToggle) {
      enabledToggle.addEventListener("change", async (event) => {
        const current = await ns.getSettings();
        current.enabled = !!event.target.checked;
        await ns.saveSettings(current);
        setToggleButtonLabel(current.enabled);
        setStatus(current.enabled ? "Extension enabled." : "Extension disabled.");
      });
    }

    const toggleBtn = byId("toggleExtensionBtn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", async () => {
        const current = await ns.getSettings();
        current.enabled = !current.enabled;
        await ns.saveSettings(current);
        if (enabledToggle) enabledToggle.checked = current.enabled;
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
