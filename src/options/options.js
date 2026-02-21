(function initOptionsPage(global) {
  const ns = (global.WWP = global.WWP || {});
  const FACULTY_OPTIONS = ["Engineering", "Mathematics", "Science", "Arts", "Environment", "Health"];
  let selectedResumeFile = null;
  let isParsingUpload = false;

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

  function setResumeFileNameLabel(name) {
    const label = byId("resumeFileName");
    if (!label) return;
    label.textContent = name || "No file selected";
  }

  function getSelectedResumeFile() {
    const input = byId("resumeUpload");
    if (selectedResumeFile) return selectedResumeFile;
    return input && input.files && input.files[0] ? input.files[0] : null;
  }

  function renderSkillsPreview(skillsMap) {
    const container = byId("skillsPreview");
    container.innerHTML = "";

    const entries = Array.from((skillsMap || new Map()).entries()).sort((a, b) => b[1] - a[1]).slice(0, 28);
    if (!entries.length) {
      container.innerHTML = '<span class="status">No skills extracted yet.</span>';
      return;
    }

    entries.forEach(([skill, value]) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = `${skill} (${Math.round(value * 10) / 10})`;
      container.appendChild(chip);
    });
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
    await ns.saveSettings(settings);

    renderSkillsPreview(parsed.skills);
    setStatus("resumeStatus", `Resume parsed. Extracted ${parsed.skills.size} skills.`, false);
  }

  async function loadForm() {
    const settings = await ns.getSettings();

    byId("enabledToggle").checked = settings.enabled;
    byId("resumeText").value = settings.resumeRawText || "";

    byId("workTerm").value = String(normalizeWorkTerm(settings.preferences.workTerm || 1));
    byId("faculty").value = normalizeFaculty(settings.preferences.faculty || "");
    byId("targetRole").value = settings.preferences.targetRole || "";
    byId("industries").value = (settings.preferences.industries || []).join(", ");
    setSelectedTermLength(settings.preferences.preferredTermLength || "4");

    setResumeFileNameLabel("");
    renderSkillsPreview(ns.getResumeSkillMap(settings));
  }

  async function savePreferences() {
    const settings = await ns.getSettings();
    settings.enabled = byId("enabledToggle").checked;
    settings.preferences.workTerm = normalizeWorkTerm(byId("workTerm").value);
    settings.preferences.faculty = normalizeFaculty(byId("faculty").value);
    settings.preferences.targetRole = byId("targetRole").value.trim();
    settings.preferences.industries = ns.csvToArray(byId("industries").value);
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
      byId("resumeText").value = text;
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
    byId("resumeUpload").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      selectedResumeFile = file || null;
      setResumeFileNameLabel(file ? file.name : "");
      await handleResumeUpload(file);
    });

    byId("parseResumeBtn").addEventListener("click", async () => {
      if (isParsingUpload) {
        setStatus("resumeStatus", "Resume extraction is in progress. Please wait...", false);
        return;
      }

      let text = byId("resumeText").value.trim();

      // Fallback: if textarea is empty but a file is selected, parse it now.
      if (!text) {
        const file = getSelectedResumeFile();
        if (file) {
          const result = await handleResumeUpload(file);
          if (!result.ok) {
            // Preserve the specific extraction error shown by handleResumeUpload.
            return;
          }
          text = result.text.trim() || byId("resumeText").value.trim();
        }
      }

      if (!text) {
        setStatus("resumeStatus", "Paste resume text or upload a resume first.", true);
        return;
      }
      await parseAndPersistResume(text);
    });

    byId("clearResumeBtn").addEventListener("click", async () => {
      const settings = await ns.getSettings();
      settings.resumeRawText = "";
      settings.resumeSkills = {};
      await ns.saveSettings(settings);

      byId("resumeText").value = "";
      byId("resumeUpload").value = "";
      selectedResumeFile = null;
      setResumeFileNameLabel("");
      renderSkillsPreview(new Map());
      setStatus("resumeStatus", "Stored resume data cleared.", false);
    });

    byId("enabledToggle").addEventListener("change", async (event) => {
      const settings = await ns.getSettings();
      settings.enabled = !!event.target.checked;
      await ns.saveSettings(settings);
    });

    byId("savePrefsBtn").addEventListener("click", savePreferences);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadForm();
    wireEvents();
  });
})(globalThis);
