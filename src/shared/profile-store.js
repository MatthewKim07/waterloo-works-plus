/**
 * Named resume/application profiles (parallel to single-resume fields in wwpSettings until migrated in UI).
 */
(function initProfileStore(global) {
  const ns = (global.WWP = global.WWP || {});

  const STORAGE_KEY = "wwpProfiles";
  const STORE_VERSION = 1;

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

  async function getBundle() {
    const raw = await getLocalStorage([STORAGE_KEY]);
    const bundle = raw[STORAGE_KEY];
    if (!bundle || typeof bundle !== "object" || bundle.v !== STORE_VERSION) {
      return {
        v: STORE_VERSION,
        activeProfileId: "default",
        profiles: {
          default: {
            id: "default",
            name: "Default",
            resumeRawText: "",
            resumeSkills: {},
            manualSkills: {},
            excludedResumeSkills: [],
            snippets: {}
          }
        }
      };
    }
    return bundle;
  }

  async function listProfiles() {
    const bundle = await getBundle();
    return Object.values(bundle.profiles || {});
  }

  async function getActiveProfile() {
    const bundle = await getBundle();
    const id = bundle.activeProfileId || "default";
    return bundle.profiles[id] || bundle.profiles.default || null;
  }

  async function setActiveProfileId(profileId) {
    const bundle = await getBundle();
    if (!bundle.profiles[profileId]) return null;
    bundle.activeProfileId = profileId;
    await setLocalStorage({ [STORAGE_KEY]: bundle });
    return bundle;
  }

  async function saveProfile(profile) {
    const bundle = await getBundle();
    const id = String(profile.id || "").trim() || "default";
    bundle.profiles[id] = {
      id,
      name: String(profile.name || id),
      resumeRawText: typeof profile.resumeRawText === "string" ? profile.resumeRawText : "",
      resumeSkills: profile.resumeSkills && typeof profile.resumeSkills === "object" ? profile.resumeSkills : {},
      manualSkills: profile.manualSkills && typeof profile.manualSkills === "object" ? profile.manualSkills : {},
      excludedResumeSkills: Array.isArray(profile.excludedResumeSkills) ? profile.excludedResumeSkills : [],
      snippets: profile.snippets && typeof profile.snippets === "object" ? profile.snippets : {}
    };
    await setLocalStorage({ [STORAGE_KEY]: bundle });
    return bundle.profiles[id];
  }

  ns.profileStore = {
    STORAGE_KEY,
    listProfiles,
    getActiveProfile,
    setActiveProfileId,
    saveProfile
  };
})(globalThis);
