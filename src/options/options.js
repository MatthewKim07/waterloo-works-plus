(function initOptionsPage(global) {
  const ns = (global.WWP = global.WWP || {});
  const FACULTY_OPTIONS = ["Engineering", "Mathematics", "Science", "Arts", "Environment", "Health"];
  const MANUAL_SKILL_DEFAULT_WEIGHT = 1;
  let selectedResumeFile = null;
  let isParsingUpload = false;
  let skillIndexCache = null;
  let skillAutocompleteController = null;
  let facultyAutocompleteController = null;

  const FACULTY_ALIASES = {
    Engineering: ["eng", "engineering"],
    Mathematics: ["math", "mathematics", "computer science", "cs"],
    Science: ["science", "sci"],
    Arts: ["arts", "humanities", "social sciences"],
    Environment: ["environment", "env", "geography", "planning"],
    Health: ["health", "kinesiology", "public health"]
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function normalizeWorkTerm(value) {
    const term = Number(value);
    if (!Number.isFinite(term) || term < 1) return 1;
    return Math.min(6, Math.round(term));
  }

  function normalizeFaculty(value) {
    const raw = String(value || "").trim();
    if (!raw) return "Engineering";

    const direct = FACULTY_OPTIONS.find((item) => item.toLowerCase() === raw.toLowerCase());
    if (direct) return direct;

    const low = raw.toLowerCase();
    if (/eng/.test(low)) return "Engineering";
    if (/math/.test(low)) return "Mathematics";
    if (/sci/.test(low)) return "Science";
    if (/art|human|soc/.test(low)) return "Arts";
    if (/env|geo|plan/.test(low)) return "Environment";
    if (/health|ahs|kines|public health/.test(low)) return "Health";

    return "Engineering";
  }

  function setStatus(id, text, isError) {
    const node = byId(id);
    if (!node) return;
    node.textContent = text;
    node.style.color = isError ? "#b91c1c" : "#475569";
  }

  function setDebugOutput(id, text) {
    const node = byId(id);
    if (!node) return;
    node.textContent = String(text || "");
  }

  function setResumeFileNameLabel(name) {
    const label = byId("resumeFileName");
    if (!label) return;
    label.textContent = name || "No file selected";
  }

  async function persistResumeSlice(settings) {
    await ns.saveSettings(settings);
    if (!ns.profileStore || typeof ns.profileStore.getActiveProfile !== "function") return;
    const active = await ns.profileStore.getActiveProfile();
    if (!active) return;
    await ns.profileStore.saveProfile({
      ...active,
      resumeRawText: settings.resumeRawText,
      resumeSkills: settings.resumeSkills,
      manualSkills: settings.manualSkills,
      excludedResumeSkills: settings.excludedResumeSkills
    });
  }

  async function migrateDefaultProfileFromSettings(settings) {
    if (!ns.profileStore) return;
    const profiles = await ns.profileStore.listProfiles();
    const def = profiles.find((p) => p.id === "default");
    if (!def) return;
    const profileEmpty =
      !String(def.resumeRawText || "").trim() && !Object.keys(def.resumeSkills || {}).length;
    const settingsHas =
      !!(settings.resumeRawText && String(settings.resumeRawText).trim()) ||
      Object.keys(settings.resumeSkills || {}).length > 0;
    if (profileEmpty && settingsHas) {
      await ns.profileStore.saveProfile({
        ...def,
        resumeRawText: settings.resumeRawText || "",
        resumeSkills: settings.resumeSkills || {},
        manualSkills: settings.manualSkills || {},
        excludedResumeSkills: settings.excludedResumeSkills || []
      });
    }
  }

  async function syncActiveProfileIntoSettings() {
    const settings = await ns.getSettings();
    if (!ns.profileStore) return settings;
    const p = await ns.profileStore.getActiveProfile();
    if (!p) return settings;
    settings.resumeRawText = p.resumeRawText || "";
    settings.resumeSkills = p.resumeSkills && typeof p.resumeSkills === "object" ? p.resumeSkills : {};
    settings.manualSkills = p.manualSkills && typeof p.manualSkills === "object" ? p.manualSkills : {};
    settings.excludedResumeSkills = Array.isArray(p.excludedResumeSkills) ? p.excludedResumeSkills : [];
    await ns.saveSettings(settings);
    return settings;
  }

  async function refreshProfileSelect() {
    const sel = byId("profileSelect");
    if (!sel || !ns.profileStore) return;
    const profiles = await ns.profileStore.listProfiles();
    const active = await ns.profileStore.getActiveProfile();
    const activeId = active && active.id ? active.id : "default";
    sel.innerHTML = "";
    profiles.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name || p.id;
      sel.appendChild(opt);
    });
    if ([...sel.options].some((o) => o.value === activeId)) {
      sel.value = activeId;
    }
  }

  function getSelectedResumeFile() {
    const input = byId("resumeUpload");
    if (selectedResumeFile) return selectedResumeFile;
    return input && input.files && input.files[0] ? input.files[0] : null;
  }

  function getExcludedSet(settings) {
    const raw = Array.isArray(settings && settings.excludedResumeSkills) ? settings.excludedResumeSkills : [];
    return new Set(raw.map((x) => String(x || "").trim().toLowerCase()).filter(Boolean));
  }

  function parseSkillObject(input) {
    const obj = input && typeof input === "object" ? input : {};
    const map = new Map();
    for (const [key, value] of Object.entries(obj)) {
      const skill = String(key || "").trim();
      const weight = Number(value);
      if (!skill || !Number.isFinite(weight) || weight <= 0) continue;
      map.set(skill, 1);
    }
    return map;
  }

  function buildSkillIndex() {
    if (skillIndexCache) return skillIndexCache;

    const aliasToKey = new Map();
    const keyToAliases = new Map();

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const key = String(entry && entry.key ? entry.key : "").trim();
      if (!key) continue;

      if (!keyToAliases.has(key)) keyToAliases.set(key, new Set());
      const keyNormalized = ns.normalizeToken(key);
      if (keyNormalized && !aliasToKey.has(keyNormalized)) {
        aliasToKey.set(keyNormalized, key);
      }
      if (keyNormalized) keyToAliases.get(key).add(keyNormalized);

      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      for (const alias of aliases) {
        const normalized = ns.normalizeToken(alias);
        if (!normalized) continue;
        if (!aliasToKey.has(normalized)) {
          aliasToKey.set(normalized, key);
        }
        keyToAliases.get(key).add(normalized);
      }
    }

    skillIndexCache = {
      aliasToKey,
      keyToAliases,
      suggestions: Array.from(keyToAliases.keys()).sort((a, b) => a.localeCompare(b))
    };
    return skillIndexCache;
  }

  function scoreAliasMatch(query, alias, canonical) {
    if (!query || !alias) return Number.POSITIVE_INFINITY;
    if (alias === query) return 0;
    if (canonical === query) return 0.25;
    if (alias.startsWith(query)) return 1;
    if (canonical.startsWith(query)) return 1.5;
    if (alias.includes(query)) return 2;
    return Number.POSITIVE_INFINITY;
  }

  function getSkillSuggestionItems(query) {
    const q = ns.normalizeToken(query);
    if (!q || q.length < 1) return [];

    const index = buildSkillIndex();
    const matched = new Map();

    for (const [alias, key] of index.aliasToKey.entries()) {
      const canonical = ns.normalizeToken(key);
      const score = scoreAliasMatch(q, alias, canonical);
      if (!Number.isFinite(score)) continue;

      const previous = matched.get(key);
      if (!previous || score < previous.score || (score === previous.score && alias.length < previous.alias.length)) {
        matched.set(key, { score, alias });
      }
    }

    return Array.from(matched.entries())
      .sort((a, b) => (a[1].score !== b[1].score ? a[1].score - b[1].score : a[0].localeCompare(b[0])))
      .slice(0, 12)
      .map(([key, data]) => ({
        value: key,
        subtitle: data.alias && data.alias !== ns.normalizeToken(key) ? `alias: ${data.alias}` : ""
      }));
  }

  function getFacultySuggestionItems(query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];

    const rows = [];
    for (const faculty of FACULTY_OPTIONS) {
      const name = faculty.toLowerCase();
      const aliases = FACULTY_ALIASES[faculty] || [];
      let bestScore = Number.POSITIVE_INFINITY;
      let matchFrom = "";

      if (name === q) {
        bestScore = 0;
        matchFrom = name;
      } else if (name.startsWith(q)) {
        bestScore = 1;
        matchFrom = name;
      } else if (name.includes(q)) {
        bestScore = 2;
        matchFrom = name;
      }

      for (const alias of aliases) {
        const low = String(alias || "").toLowerCase();
        if (!low) continue;
        let aliasScore = Number.POSITIVE_INFINITY;
        if (low === q) aliasScore = 0.5;
        else if (low.startsWith(q)) aliasScore = 1.2;
        else if (low.includes(q)) aliasScore = 2.2;

        if (aliasScore < bestScore) {
          bestScore = aliasScore;
          matchFrom = low;
        }
      }

      if (Number.isFinite(bestScore)) {
        rows.push({
          value: faculty,
          score: bestScore,
          subtitle: matchFrom && matchFrom !== name ? `matched: ${matchFrom}` : ""
        });
      }
    }

    return rows
      .sort((a, b) => (a.score !== b.score ? a.score - b.score : a.value.localeCompare(b.value)))
      .slice(0, 6)
      .map(({ value, subtitle }) => ({ value, subtitle }));
  }

  function createAutocompleteController(inputId, listId, resolver, onPick) {
    const input = byId(inputId);
    const list = byId(listId);
    if (!input || !list) return null;

    let items = [];
    let activeIndex = -1;

    function hide() {
      items = [];
      activeIndex = -1;
      list.hidden = true;
      list.innerHTML = "";
    }

    function applyIndex(index) {
      const item = items[index];
      if (!item) return false;
      input.value = item.value;
      hide();
      if (typeof onPick === "function") onPick(item.value, item);
      return true;
    }

    function render() {
      const query = input.value;
      const nextItems = Array.isArray(resolver(query)) ? resolver(query) : [];
      if (!String(query || "").trim() || !nextItems.length) {
        hide();
        return;
      }

      items = nextItems;
      if (activeIndex < 0 || activeIndex >= items.length) activeIndex = 0;
      list.innerHTML = "";

      items.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `autocomplete-item${index === activeIndex ? " active" : ""}`;
        button.dataset.index = String(index);

        const label = document.createElement("span");
        label.textContent = item.value;
        button.appendChild(label);

        if (item.subtitle) {
          const sub = document.createElement("small");
          sub.textContent = item.subtitle;
          button.appendChild(sub);
        }

        const hint = document.createElement("span");
        hint.className = "autocomplete-hint";
        hint.setAttribute("aria-hidden", "true");
        hint.textContent = "click to add";
        button.appendChild(hint);

        list.appendChild(button);
      });
      list.hidden = false;
    }

    function move(delta) {
      if (!items.length) return;
      activeIndex = (activeIndex + delta + items.length) % items.length;
      render();
    }

    input.addEventListener("input", () => {
      activeIndex = 0;
      render();
    });

    input.addEventListener("focus", () => {
      if (String(input.value || "").trim()) {
        activeIndex = 0;
        render();
      }
    });

    input.addEventListener("keydown", (event) => {
      if (list.hidden || !items.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        applyIndex(activeIndex >= 0 ? activeIndex : 0);
      } else if (event.key === "Escape") {
        event.preventDefault();
        hide();
      }
    });

    list.addEventListener("mouseenter", () => {
      list.querySelectorAll(".autocomplete-item.active").forEach(el => el.classList.remove("active"));
    });

    list.addEventListener("mouseleave", () => {
      if (activeIndex >= 0 && list.children[activeIndex]) {
        list.children[activeIndex].classList.add("active");
      }
    });

    list.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    list.addEventListener("click", (event) => {
      const button = event.target.closest("button.autocomplete-item");
      if (!button) return;
      const index = Number(button.dataset.index);
      if (Number.isFinite(index)) {
        applyIndex(index);
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(hide, 120);
    });

    return {
      hide,
      selectIfOpen() {
        if (list.hidden || !items.length) return false;
        return applyIndex(activeIndex >= 0 ? activeIndex : 0);
      }
    };
  }

  function canonicalizeSkill(raw) {
    const normalized = ns.normalizeToken(String(raw || "").trim());
    if (!normalized) return "";

    const index = buildSkillIndex();
    if (index.aliasToKey.has(normalized)) {
      return index.aliasToKey.get(normalized);
    }

    if (normalized.length < 2) return "";
    return normalized;
  }

  function makeSkillChip(skill, value, options) {
    const opts = options || {};
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip chip-editable";

    if (opts.variant === "removed") {
      chip.classList.add("chip-removed");
    } else if (opts.variant === "parsed") {
      chip.classList.add("chip-parsed");
    } else if (opts.variant === "manual") {
      chip.classList.add("chip-manual");
    }

    if (opts.action === "toggleExclude") {
      chip.dataset.action = "toggleExclude";
      chip.dataset.skill = skill;
    }

    if (opts.action === "removeManual") {
      chip.dataset.action = "removeManual";
      chip.dataset.skill = skill;
    }

    const suffix = opts.suffix ? ` ${opts.suffix}` : "";
    const labelSpan = document.createElement("span");
    labelSpan.textContent = `${skill}${suffix}`;
    chip.appendChild(labelSpan);
    if (opts.action === "toggleExclude" || opts.action === "removeManual") {
      const xSpan = document.createElement("span");
      xSpan.className = "chip-x";
      xSpan.setAttribute("aria-hidden", "true");
      xSpan.textContent = "×";
      chip.appendChild(xSpan);
    }
    if (opts.ariaLabel) {
      chip.setAttribute("aria-label", opts.ariaLabel);
      chip.title = opts.ariaLabel;
    }
    return chip;
  }

  function renderSkillsPreview(settings) {
    const container = byId("skillsPreview");
    if (!container) return;

    container.innerHTML = "";
    const parsedMap = parseSkillObject(settings && settings.resumeSkills);
    const manualMap = parseSkillObject(settings && settings.manualSkills);
    const activeMap = ns.getResumeSkillMap(settings);
    const excluded = getExcludedSet(settings);
    const entries = Array.from(activeMap.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .slice(0, 120);

    if (!entries.length) {
      container.innerHTML = '<span class="status">No active skills yet. Parse a resume or add a manual skill.</span>';
      return;
    }

    entries.forEach(([skill, value]) => {
      const lowerSkill = String(skill || "").toLowerCase();
      const hasManual = manualMap.has(skill);
      const hasParsed = parsedMap.has(skill) && !excluded.has(lowerSkill);
      let chip;

      if (hasManual) {
        const sourceLabel = hasParsed ? "manual and parsed source" : "manual source";
        chip = makeSkillChip(skill, value, {
          action: "removeManual",
          variant: "manual",
          ariaLabel: `${skill}, ${sourceLabel}, click to remove manual skill`
        });
      } else {
        chip = makeSkillChip(skill, value, {
          action: "toggleExclude",
          variant: "parsed",
          ariaLabel: `${skill}, parsed source, click to hide from matching`
        });
      }
      container.appendChild(chip);
    });
  }

  function renderHiddenParsedSkills(settings) {
    const container = byId("hiddenParsedSkillsPreview");
    if (!container) return;

    container.innerHTML = "";
    const parsedMap = parseSkillObject(settings && settings.resumeSkills);
    const excluded = getExcludedSet(settings);
    const entries = Array.from(parsedMap.entries())
      .filter(([skill]) => excluded.has(String(skill || "").toLowerCase()))
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    if (!entries.length) {
      container.innerHTML = '<span class="status">No hidden parsed skills.</span>';
      return;
    }

    entries.forEach(([skill, value]) => {
      container.appendChild(
        makeSkillChip(skill, value, {
          action: "toggleExclude",
          variant: "removed",
          ariaLabel: `${skill}, hidden parsed skill, click to restore for matching`
        })
      );
    });
  }

  function renderSkillInventory(settings) {
    const active = ns.getResumeSkillMap(settings);
    const parsedMap = parseSkillObject(settings && settings.resumeSkills);
    const manualMap = parseSkillObject(settings && settings.manualSkills);
    const excluded = getExcludedSet(settings);
    let parsedActiveCount = 0;
    for (const [skill] of parsedMap.entries()) {
      if (!excluded.has(String(skill || "").toLowerCase())) parsedActiveCount += 1;
    }

    renderSkillsPreview(settings);
    renderHiddenParsedSkills(settings);

    const summary = byId("skillsSummary");
    if (summary) {
      summary.textContent = `Active ${active.size} | Parsed active ${parsedActiveCount} | Manual ${manualMap.size} | Hidden parsed ${excluded.size}`;
    }
  }

  function initAutocompleteControllers() {
    if (!skillAutocompleteController) {
      skillAutocompleteController = createAutocompleteController("skillInput", "skillAutocomplete", getSkillSuggestionItems, () => addManualSkillFromInput());
    }
    if (!facultyAutocompleteController) {
      facultyAutocompleteController = createAutocompleteController("faculty", "facultyAutocomplete", getFacultySuggestionItems);
    }
  }

  function getSelectedTermLength() {
    const checked = document.querySelector("input[name='termLength']:checked");
    return checked ? checked.value : "4";
  }

  function setSelectedTermLength(value) {
    const target = document.querySelector(`input[name='termLength'][value='${value}']`) || document.querySelector("input[name='termLength'][value='4']");
    if (target) target.checked = true;
  }

  async function parseAndPersistResume(resumeText) {
    const parsed = ns.parseResume(resumeText);
    const settings = await ns.getSettings();
    settings.resumeRawText = parsed.rawText;
    settings.resumeSkills = ns.mapToObject(parsed.skills);

    const validParsedSkills = new Set(Array.from(parsed.skills.keys()).map((k) => String(k).toLowerCase()));
    settings.excludedResumeSkills = (Array.isArray(settings.excludedResumeSkills) ? settings.excludedResumeSkills : []).filter((k) =>
      validParsedSkills.has(String(k || "").toLowerCase())
    );

    await persistResumeSlice(settings);

    renderSkillInventory(settings);
    setStatus("resumeStatus", `Resume parsed. Extracted ${parsed.skills.size} parsed skills.`, false);
    setStatus("skillEditStatus", "", false);
  }

  async function addManualSkillFromInput() {
    const input = byId("skillInput");
    if (!input) return;

    const skill = canonicalizeSkill(input.value);
    if (!skill) {
      setStatus("skillEditStatus", "Enter a valid skill to add.", true);
      return;
    }

    const settings = await ns.getSettings();
    settings.manualSkills = settings.manualSkills && typeof settings.manualSkills === "object" ? settings.manualSkills : {};

    const existing = Number(settings.manualSkills[skill]);
    settings.manualSkills[skill] = Number.isFinite(existing) && existing > 0 ? 1 : MANUAL_SKILL_DEFAULT_WEIGHT;

    const excluded = getExcludedSet(settings);
    if (excluded.has(skill.toLowerCase())) {
      excluded.delete(skill.toLowerCase());
      settings.excludedResumeSkills = Array.from(excluded);
    }

    await persistResumeSlice(settings);
    input.value = "";
    renderSkillInventory(settings);
    setStatus("skillEditStatus", `Added manual skill: ${skill}`, false);
  }

  async function loadForm() {
    let settings = await ns.getSettings();
    await migrateDefaultProfileFromSettings(settings);
    settings = await syncActiveProfileIntoSettings();
    await refreshProfileSelect();

    const enabledToggle = byId("enabledToggle");
    if (enabledToggle) enabledToggle.checked = settings.enabled;

    const flagAutofill = byId("flagAutofill");
    if (flagAutofill) flagAutofill.checked = !!(settings.featureFlags && settings.featureFlags.autofill);
    const flagTracker = byId("flagTracker");
    if (flagTracker) flagTracker.checked = !!(settings.featureFlags && settings.featureFlags.applicationTracker);
    const flagLocalSemanticAI = byId("flagLocalSemanticAI");
    if (flagLocalSemanticAI) flagLocalSemanticAI.checked = !!(settings.featureFlags && settings.featureFlags.localSemanticAI);

    const resumeText = byId("resumeText");
    if (resumeText) resumeText.value = settings.resumeRawText || "";

    const aiSmokeText = byId("aiSmokeText");
    if (aiSmokeText && !String(aiSmokeText.value || "").trim()) {
      aiSmokeText.value = String(settings.resumeRawText || "").trim().slice(0, 1600);
    }

    const workTerm = byId("workTerm");
    if (workTerm) workTerm.value = String(normalizeWorkTerm(settings.preferences.workTerm || 1));

    const faculty = byId("faculty");
    if (faculty) faculty.value = normalizeFaculty(settings.preferences.faculty || "");

    const targetRole = byId("targetRole");
    if (targetRole) targetRole.value = settings.preferences.targetRole || "";

    const industries = byId("industries");
    if (industries) industries.value = (settings.preferences.industries || []).join(", ");

    setSelectedTermLength(settings.preferences.preferredTermLength || "4");

    setResumeFileNameLabel("");
    renderSkillInventory(settings);

    const trackerMount = byId("trackerMount");
    if (trackerMount && ns.renderTrackerDashboard) {
      const tstat = byId("trackerStatus");
      ns.renderTrackerDashboard(trackerMount, tstat).catch(() => {});
    }
  }

  async function runAiSmokeTest() {
    const statusId = "aiStatus";
    const outputId = "aiOutput";
    const input = byId("aiSmokeText");
    if (!input) return;
    if (!ns.aiClient || typeof ns.aiClient.runEmbeddingSmokeTest !== "function") {
      setStatus(statusId, "AI client is unavailable on this page.", true);
      return;
    }

    const raw = String(input.value || "").trim();
    if (!raw) {
      setStatus(statusId, "Paste some text before running the AI smoke test.", true);
      return;
    }

    setStatus(statusId, "Running local embedding smoke test. First run may take a while while the model downloads.", false);
    setDebugOutput(outputId, "Waiting for AI runtime...");

    try {
      const result = await ns.aiClient.runEmbeddingSmokeTest(raw.slice(0, 4000));
      const lines = [
        `Model: ${result.modelId}`,
        `Backend: ${result.backend}`,
        `DType: ${result.dtype}`,
        `Dimensions: ${result.dimensions}`,
        `Input chars: ${result.inputChars}`,
        `Duration: ${result.durationMs} ms`,
        `Preview: [${(result.preview || []).join(", ")}]`
      ];
      setDebugOutput(outputId, lines.join("\n"));
      setStatus(statusId, "AI smoke test completed.", false);
    } catch (error) {
      setDebugOutput(outputId, `Smoke test failed.\n\n${String(error && error.message ? error.message : error)}`);
      setStatus(statusId, "AI smoke test failed.", true);
    }
  }

  async function savePreferences() {
    const settings = await ns.getSettings();

    const enabledToggle = byId("enabledToggle");
    if (enabledToggle) settings.enabled = enabledToggle.checked;

    const flagAutofill = byId("flagAutofill");
    const flagTracker = byId("flagTracker");
    const flagLocalSemanticAI = byId("flagLocalSemanticAI");
    const prev = settings.featureFlags || {};
    settings.featureFlags = {
      smartOverlay: prev.smartOverlay !== false,
      autofill: flagAutofill ? !!flagAutofill.checked : prev.autofill === true,
      applicationTracker: flagTracker ? !!flagTracker.checked : prev.applicationTracker === true,
      localSemanticAI: flagLocalSemanticAI ? !!flagLocalSemanticAI.checked : prev.localSemanticAI === true
    };

    const workTerm = byId("workTerm");
    if (workTerm) settings.preferences.workTerm = normalizeWorkTerm(workTerm.value);

    const faculty = byId("faculty");
    if (faculty) settings.preferences.faculty = normalizeFaculty(faculty.value);

    const targetRole = byId("targetRole");
    if (targetRole) settings.preferences.targetRole = targetRole.value.trim();

    const industries = byId("industries");
    if (industries) settings.preferences.industries = ns.csvToArray(industries.value);

    settings.preferences.preferredTermLength = getSelectedTermLength();

    await ns.saveSettings(settings);
    setStatus("prefsStatus", "Preferences saved.", false);
  }

  async function handleResumeUpload(file) {
    if (!file) {
      return { ok: false, error: new Error("No file selected"), text: "" };
    }
    selectedResumeFile = file;
    isParsingUpload = true;

    try {
      setStatus("resumeStatus", "Extracting text from uploaded resume...", false);
      const text = await ns.extractTextFromResumeFile(file);
      if (!String(text || "").trim()) {
        throw new Error("Uploaded file had no extractable text");
      }
      const resumeText = byId("resumeText");
      if (resumeText) resumeText.value = text;
      await parseAndPersistResume(text);
      return { ok: true, text, error: null };
    } catch (error) {
      console.warn("WaterlooWorks+ resume extraction failed", error);
      setStatus(
        "resumeStatus",
        `Could not extract this file automatically (${error.message || error}). Paste text manually.`,
        true
      );
      return { ok: false, error, text: "" };
    } finally {
      isParsingUpload = false;
    }
  }

  function wireEvents() {
    const upload = byId("resumeUpload");
    if (upload) {
      upload.addEventListener("change", async (event) => {
        const file = event.target.files && event.target.files[0];
        selectedResumeFile = file || null;
        setResumeFileNameLabel(file ? file.name : "");
        await handleResumeUpload(file);
      });
    }

    const parseBtn = byId("parseResumeBtn");
    if (parseBtn) {
      parseBtn.addEventListener("click", async () => {
        if (isParsingUpload) {
          setStatus("resumeStatus", "Resume extraction is in progress. Please wait...", false);
          return;
        }

        const resumeTextNode = byId("resumeText");
        let text = resumeTextNode ? resumeTextNode.value.trim() : "";

        if (!text) {
          const file = getSelectedResumeFile();
          if (file) {
            const result = await handleResumeUpload(file);
            if (!result.ok) {
              return;
            }
            text = result.text.trim() || (resumeTextNode ? resumeTextNode.value.trim() : "");
          }
        }

        if (!text) {
          setStatus("resumeStatus", "Paste resume text or upload a resume first.", true);
          return;
        }
        await parseAndPersistResume(text);
      });
    }

    const clearBtn = byId("clearResumeBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        const settings = await ns.getSettings();
        settings.resumeRawText = "";
        settings.resumeSkills = {};
        settings.excludedResumeSkills = [];
        await persistResumeSlice(settings);

        const resumeText = byId("resumeText");
        if (resumeText) resumeText.value = "";
        if (upload) upload.value = "";
        selectedResumeFile = null;
        setResumeFileNameLabel("");
        renderSkillInventory(settings);
        setStatus("resumeStatus", "Stored parsed resume data cleared. Manual skills kept.", false);
      });
    }

    const addSkillBtn = byId("addSkillBtn");
    if (addSkillBtn) {
      addSkillBtn.addEventListener("click", addManualSkillFromInput);
    }

    const skillInput = byId("skillInput");
    if (skillInput) {
      skillInput.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          if (skillAutocompleteController && skillAutocompleteController.selectIfOpen()) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          await addManualSkillFromInput();
        }
      });
    }

    const activePreview = byId("skillsPreview");
    if (activePreview) {
      activePreview.addEventListener("click", async (event) => {
        const target = event.target.closest("button[data-action]");
        if (!target) return;

        const action = String(target.dataset.action || "");
        const skill = String(target.dataset.skill || "").trim();
        if (!skill) return;

        if (action === "removeManual") {
          const settings = await ns.getSettings();
          const manualSkills = settings.manualSkills && typeof settings.manualSkills === "object" ? settings.manualSkills : {};
          delete manualSkills[skill];
          settings.manualSkills = manualSkills;
          await persistResumeSlice(settings);
          renderSkillInventory(settings);
          setStatus("skillEditStatus", `Removed manual skill: ${skill}`, false);
          return;
        }

        if (action === "toggleExclude") {
          const settings = await ns.getSettings();
          const excluded = getExcludedSet(settings);
          const key = skill.toLowerCase();
          excluded.add(key);
          settings.excludedResumeSkills = Array.from(excluded);
          await persistResumeSlice(settings);
          renderSkillInventory(settings);
          setStatus("skillEditStatus", `Hidden parsed skill: ${skill}`, false);
        }
      });
    }

    const hiddenParsedPreview = byId("hiddenParsedSkillsPreview");
    if (hiddenParsedPreview) {
      hiddenParsedPreview.addEventListener("click", async (event) => {
        const target = event.target.closest("button[data-action='toggleExclude']");
        if (!target) return;
        const skill = String(target.dataset.skill || "").trim();
        if (!skill) return;

        const settings = await ns.getSettings();
        const excluded = getExcludedSet(settings);
        const key = skill.toLowerCase();
        const wasHidden = excluded.has(key);
        if (wasHidden) excluded.delete(key);
        settings.excludedResumeSkills = Array.from(excluded);
        await persistResumeSlice(settings);
        renderSkillInventory(settings);
        setStatus("skillEditStatus", `Restored parsed skill: ${skill}`, false);
      });
    }

    const enabledToggle = byId("enabledToggle");
    if (enabledToggle) {
      enabledToggle.addEventListener("change", async (event) => {
        const settings = await ns.getSettings();
        settings.enabled = !!event.target.checked;
        await ns.saveSettings(settings);
      });
    }

    const savePrefsBtn = byId("savePrefsBtn");
    if (savePrefsBtn) {
      savePrefsBtn.addEventListener("click", savePreferences);
    }

    const runAiSmokeTestBtn = byId("runAiSmokeTestBtn");
    if (runAiSmokeTestBtn) {
      runAiSmokeTestBtn.addEventListener("click", runAiSmokeTest);
    }

    const profileSelect = byId("profileSelect");
    if (profileSelect) {
      profileSelect.addEventListener("change", async () => {
        const id = profileSelect.value;
        if (ns.profileStore && typeof ns.profileStore.setActiveProfileId === "function") {
          await ns.profileStore.setActiveProfileId(id);
        }
        await loadForm();
      });
    }

    const newProfileBtn = byId("newProfileBtn");
    if (newProfileBtn && ns.profileStore) {
      newProfileBtn.addEventListener("click", async () => {
        const name = window.prompt("Name this resume profile (e.g. ML intern, return offer):");
        if (!name || !String(name).trim()) return;
        const created = await ns.profileStore.createProfile(String(name).trim());
        await ns.profileStore.setActiveProfileId(created.id);
        await syncActiveProfileIntoSettings();
        await refreshProfileSelect();
        const resumeText = byId("resumeText");
        if (resumeText) resumeText.value = "";
        renderSkillInventory(await ns.getSettings());
        setStatus("resumeStatus", `Switched to new profile "${created.name}". Paste or upload a resume for it.`, false);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    initAutocompleteControllers();
    await loadForm();
    wireEvents();
  });
})(globalThis);
