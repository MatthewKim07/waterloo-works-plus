/**
 * Local-only application tracker records (no backend).
 */
(function initApplicationStore(global) {
  const ns = (global.WWP = global.WWP || {});

  const STORAGE_KEY = "wwpApplications";
  const STORE_VERSION = 1;

  const STATUS = {
    APPLIED: "applied",
    INTERVIEW: "interview",
    OFFER: "offer",
    REJECTED: "rejected",
    WITHDRAWN: "withdrawn",
    UNKNOWN: "unknown"
  };

  function getLocalStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function setLocalStorage(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  function normalizeRecord(input) {
    const now = Date.now();
    const allowedStatus = new Set(Object.values(STATUS));
    const rawStatus = String(input.status || "").toLowerCase();
    const status = allowedStatus.has(rawStatus) ? rawStatus : STATUS.UNKNOWN;
    const base = {
      id: String(input.id || `app-${now}`),
      jobKey: String(input.jobKey || ""),
      postingUrl: String(input.postingUrl || ""),
      title: String(input.title || ""),
      employer: String(input.employer || ""),
      status,
      profileId: input.profileId != null ? String(input.profileId) : null,
      events: Array.isArray(input.events) ? input.events : [],
      createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : now,
      updatedAt: Number.isFinite(Number(input.updatedAt)) ? Number(input.updatedAt) : now,
      evidence: typeof input.evidence === "object" && input.evidence ? input.evidence : null
    };
    return base;
  }

  async function getBundle() {
    const raw = await getLocalStorage([STORAGE_KEY]);
    const bundle = raw[STORAGE_KEY];
    if (!bundle || typeof bundle !== "object") {
      return { v: STORE_VERSION, records: {} };
    }
    if (bundle.v !== STORE_VERSION || !bundle.records || typeof bundle.records !== "object") {
      return { v: STORE_VERSION, records: {} };
    }
    return bundle;
  }

  async function saveBundle(bundle) {
    await setLocalStorage({ [STORAGE_KEY]: bundle });
  }

  async function listApplications() {
    const bundle = await getBundle();
    return Object.values(bundle.records || {}).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function getByJobKey(jobKey) {
    const bundle = await getBundle();
    const records = bundle.records || {};
    return Object.values(records).find((r) => r.jobKey === jobKey) || null;
  }

  async function upsertApplication(partial) {
    const bundle = await getBundle();
    const records = { ...bundle.records };
    const existing = partial.id && records[partial.id] ? records[partial.id] : null;
    const merged = normalizeRecord({
      ...existing,
      ...partial,
      events: partial.events != null ? partial.events : existing && existing.events ? existing.events : []
    });
    records[merged.id] = merged;
    await saveBundle({ v: STORE_VERSION, records });
    return merged;
  }

  async function appendEvent(applicationId, event) {
    const bundle = await getBundle();
    const rec = bundle.records[applicationId];
    if (!rec) return null;
    const ev = {
      type: String(event.type || "note"),
      at: Number.isFinite(Number(event.at)) ? Number(event.at) : Date.now(),
      source: String(event.source || "extension")
    };
    const next = {
      ...rec,
      events: [...(rec.events || []), ev],
      updatedAt: Date.now()
    };
    if (event.setStatus) {
      next.status = event.setStatus;
    }
    bundle.records[applicationId] = normalizeRecord(next);
    await saveBundle(bundle);
    return bundle.records[applicationId];
  }

  ns.applicationStore = {
    STORAGE_KEY,
    STATUS,
    listApplications,
    getByJobKey,
    upsertApplication,
    appendEvent,
    normalizeRecord
  };
})(globalThis);
