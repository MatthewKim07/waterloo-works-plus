(function initStorage(global) {
  const ns = (global.WWP = global.WWP || {});

  const STORAGE_KEYS = {
    settings: "wwpSettings",
    jobCache: "wwpJobAnalysisCache"
  };
  const JOB_CACHE_SCHEMA_VERSION = 4;

  const DEFAULT_SETTINGS = {
    enabled: true,
    disabledPaths: [],
    resumeRawText: "",
    resumeSkills: {},
    manualSkills: {},
    excludedResumeSkills: [],
    preferences: {
      workTerm: 1,
      faculty: "Engineering",
      targetRole: "",
      industries: [],
      preferredTermLength: "4",
      globalDisableOnUnsupportedPages: false
    }
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function sanitizeSettings(input) {
    const safe = deepClone(DEFAULT_SETTINGS);
    if (!input || typeof input !== "object") {
      return safe;
    }

    safe.enabled = input.enabled !== false;
    safe.disabledPaths = Array.isArray(input.disabledPaths)
      ? input.disabledPaths.filter((x) => typeof x === "string")
      : [];

    safe.resumeRawText = typeof input.resumeRawText === "string" ? input.resumeRawText : "";
    safe.resumeSkills = input.resumeSkills && typeof input.resumeSkills === "object" ? input.resumeSkills : {};
    safe.manualSkills = input.manualSkills && typeof input.manualSkills === "object" ? input.manualSkills : {};
    safe.excludedResumeSkills = Array.isArray(input.excludedResumeSkills)
      ? input.excludedResumeSkills.filter((x) => typeof x === "string" && x.trim())
      : [];

    const pref = input.preferences && typeof input.preferences === "object" ? input.preferences : {};
    safe.preferences.workTerm = Number.isFinite(Number(pref.workTerm))
      ? Math.min(6, Math.max(1, Number(pref.workTerm)))
      : 1;
    safe.preferences.faculty = typeof pref.faculty === "string" ? pref.faculty : "Engineering";
    safe.preferences.targetRole = typeof pref.targetRole === "string" ? pref.targetRole : "";
    safe.preferences.industries = Array.isArray(pref.industries)
      ? pref.industries.filter((x) => typeof x === "string" && x.trim())
      : [];
    safe.preferences.preferredTermLength = ["4", "8", "either"].includes(pref.preferredTermLength)
      ? pref.preferredTermLength
      : "4";
    safe.preferences.globalDisableOnUnsupportedPages = !!pref.globalDisableOnUnsupportedPages;

    return safe;
  }

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

  ns.STORAGE_KEYS = STORAGE_KEYS;
  ns.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  ns.getSettings = async function getSettings() {
    const result = await getLocalStorage([STORAGE_KEYS.settings]);
    const settings = sanitizeSettings(result[STORAGE_KEYS.settings]);
    return settings;
  };

  ns.saveSettings = async function saveSettings(settings) {
    const safe = sanitizeSettings(settings);
    await setLocalStorage({ [STORAGE_KEYS.settings]: safe });
    return safe;
  };

  ns.updateSettings = async function updateSettings(partial) {
    const current = await ns.getSettings();
    const merged = {
      ...current,
      ...partial,
      preferences: {
        ...current.preferences,
        ...(partial && partial.preferences ? partial.preferences : {})
      }
    };
    return ns.saveSettings(merged);
  };

  ns.isPageDisabled = async function isPageDisabled(pathname) {
    const settings = await ns.getSettings();
    const disabled = settings.disabledPaths.includes(pathname);
    return !settings.enabled || disabled;
  };

  ns.togglePageDisabled = async function togglePageDisabled(pathname) {
    const settings = await ns.getSettings();
    const next = new Set(settings.disabledPaths);
    if (next.has(pathname)) {
      next.delete(pathname);
    } else {
      next.add(pathname);
    }
    settings.disabledPaths = Array.from(next);
    await ns.saveSettings(settings);
    return settings.disabledPaths.includes(pathname);
  };

  ns.getResumeSkillMap = function getResumeSkillMap(settings) {
    const parsedData = settings && settings.resumeSkills ? settings.resumeSkills : {};
    const manualData = settings && settings.manualSkills ? settings.manualSkills : {};
    const excludedSet = new Set(
      Array.isArray(settings && settings.excludedResumeSkills)
        ? settings.excludedResumeSkills.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean)
        : []
    );
    const map = new Map();

    for (const [key, value] of Object.entries(parsedData)) {
      const skill = typeof key === "string" ? key.trim() : "";
      if (!skill || excludedSet.has(skill.toLowerCase())) continue;
      if (Number.isFinite(Number(value)) && Number(value) > 0) {
        map.set(skill, 1);
      }
    }

    for (const [key, value] of Object.entries(manualData)) {
      const skill = typeof key === "string" ? key.trim() : "";
      if (!skill) continue;
      const manualWeight = Number(value);
      if (!Number.isFinite(manualWeight) || manualWeight <= 0) continue;
      map.set(skill, 1);
      if (excludedSet.has(skill.toLowerCase())) {
        excludedSet.delete(skill.toLowerCase());
      }
    }
    return map;
  };

  ns.mapToObject = function mapToObject(map) {
    const out = {};
    if (!map || typeof map.forEach !== "function") {
      return out;
    }
    map.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  };

  ns.getCachedJobAnalysis = async function getCachedJobAnalysis(url, maxAgeMs) {
    const limit = Number.isFinite(maxAgeMs) ? maxAgeMs : 7 * 24 * 60 * 60 * 1000;
    const result = await getLocalStorage([STORAGE_KEYS.jobCache]);
    const cache = result[STORAGE_KEYS.jobCache] || {};
    const item = cache[url];
    if (!item || !item.timestamp || item.version !== JOB_CACHE_SCHEMA_VERSION) {
      return null;
    }
    if (Date.now() - item.timestamp > limit) {
      return null;
    }
    return item.data || null;
  };

  ns.setCachedJobAnalysis = async function setCachedJobAnalysis(url, data) {
    const result = await getLocalStorage([STORAGE_KEYS.jobCache]);
    const cache = result[STORAGE_KEYS.jobCache] || {};
    cache[url] = {
      version: JOB_CACHE_SCHEMA_VERSION,
      timestamp: Date.now(),
      data
    };

    const keys = Object.keys(cache);
    if (keys.length > 200) {
      keys
        .sort((a, b) => (cache[a].timestamp || 0) - (cache[b].timestamp || 0))
        .slice(0, keys.length - 200)
        .forEach((key) => delete cache[key]);
    }

    await setLocalStorage({ [STORAGE_KEYS.jobCache]: cache });
  };
})(globalThis);
