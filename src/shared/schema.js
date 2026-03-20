/**
 * Central schema versions and settings migrations for WaterlooWorks+.
 * Must load before storage.js (content scripts) or be importScripts'd first in the service worker.
 */
(function initSchema(global) {
  const ns = (global.WWP = global.WWP || {});

  ns.SCHEMA = {
    /** Increment when persisted settings shape or semantics require migration. */
    SETTINGS_VERSION: 1,
    /** Stored on each job cache entry; must stay in sync with cache readers in storage.js */
    JOB_CACHE_ENTRY_VERSION: 4
  };

  const DEFAULT_SMART_OVERLAY = true;
  const DEFAULT_AUTOFILL = false;
  const DEFAULT_APPLICATION_TRACKER = false;

  ns.getDefaultFeatureFlags = function getDefaultFeatureFlags() {
    return {
      smartOverlay: DEFAULT_SMART_OVERLAY,
      autofill: DEFAULT_AUTOFILL,
      applicationTracker: DEFAULT_APPLICATION_TRACKER
    };
  };

  /**
   * Canonical default settings object (before strict type coercion in storage.js).
   */
  ns.getDefaultSettingsShape = function getDefaultSettingsShape() {
    return {
      _schemaVersion: ns.SCHEMA.SETTINGS_VERSION,
      enabled: true,
      featureFlags: ns.getDefaultFeatureFlags(),
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
  };

  /**
   * Upgrade a previously stored settings object toward the current schema.
   * Does not enforce types; storage.js sanitizeSettings performs that step.
   *
   * @param {object|null|undefined} raw
   * @returns {object}
   */
  ns.migrateSettings = function migrateSettings(raw) {
    const defaults = ns.getDefaultSettingsShape();
    if (!raw || typeof raw !== "object") {
      return { ...defaults };
    }

    const out = {
      ...defaults,
      ...raw,
      preferences: {
        ...defaults.preferences,
        ...(raw.preferences && typeof raw.preferences === "object" ? raw.preferences : {})
      },
      featureFlags: {
        ...defaults.featureFlags,
        ...(raw.featureFlags && typeof raw.featureFlags === "object" ? raw.featureFlags : {})
      }
    };

    out._schemaVersion = ns.SCHEMA.SETTINGS_VERSION;
    return out;
  };

  /**
   * @param {object} raw settings as returned from chrome.storage.local (pre-sanitize)
   * @param {object} sanitized settings after sanitizeSettings
   * @returns {boolean}
   */
  ns.shouldPersistSettingsMigration = function shouldPersistSettingsMigration(raw, sanitized) {
    if (!sanitized || typeof sanitized !== "object") return false;
    if (!raw || typeof raw !== "object") return true;
    if (raw._schemaVersion !== ns.SCHEMA.SETTINGS_VERSION) return true;
    if (!raw.featureFlags || typeof raw.featureFlags !== "object") return true;
    try {
      if (JSON.stringify(raw.featureFlags) !== JSON.stringify(sanitized.featureFlags)) {
        return true;
      }
    } catch (_e) {
      return true;
    }
    return false;
  };
})(globalThis);
