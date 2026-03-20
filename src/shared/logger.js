/**
 * Flip debug on from the console: chrome.storage.local.set({ wwpDebug: true })
 */
(function initLogger(global) {
  const ns = (global.WWP = global.WWP || {});
  let memDebug = false;

  ns.logger = {
    setDebug(on) {
      memDebug = !!on;
    },
    async refreshDebugFromStorage() {
      if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
      return new Promise((resolve) => {
        chrome.storage.local.get(["wwpDebug"], (r) => {
          memDebug = !!r.wwpDebug;
          resolve(memDebug);
        });
      });
    },
    info(...args) {
      if (!memDebug) return;
      const log = global.console && global.console.log ? global.console.log.bind(global.console) : () => {};
      log("[WaterlooWorks+]", ...args);
    }
  };
})(globalThis);
