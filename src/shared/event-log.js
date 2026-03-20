(function initEventLog(global) {
  const ns = (global.WWP = global.WWP || {});
  const KEY = "wwpEventLog";
  const MAX = 400;

  function getLocal(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function setLocal(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, resolve);
    });
  }

  ns.appendWwpEvent = async function appendWwpEvent(type, payload) {
    const row = {
      type: String(type || "event"),
      at: Date.now(),
      payload: payload && typeof payload === "object" ? payload : { value: payload }
    };
    const bag = await getLocal([KEY]);
    const list = Array.isArray(bag[KEY]) ? bag[KEY] : [];
    list.unshift(row);
    await setLocal({ [KEY]: list.slice(0, MAX) });
    return row;
  };

  ns.listWwpEvents = async function listWwpEvents(limit) {
    const bag = await getLocal([KEY]);
    const list = Array.isArray(bag[KEY]) ? bag[KEY] : [];
    const n = Math.min(Number(limit) || 50, 200);
    return list.slice(0, n);
  };
})(globalThis);
