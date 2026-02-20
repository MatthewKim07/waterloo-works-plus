(function initOptionsPage(global) {
  const ns = (global.WWP = global.WWP || {});

  function byId(id) {
    return document.getElementById(id);
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

    byId("workTerm").value = settings.preferences.workTerm || 1;
    byId("faculty").value = settings.preferences.faculty || "";
    byId("targetRole").value = settings.preferences.targetRole || "";
    byId("industries").value = (settings.preferences.industries || []).join(", ");
    setSelectedTermLength(settings.preferences.preferredTermLength || "4");

    setResumeFileNameLabel("");
    renderSkillsPreview(ns.getResumeSkillMap(settings));
  }

  async function savePreferences() {
    const settings = await ns.getSettings();
    settings.enabled = byId("enabledToggle").checked;
    settings.preferences.workTerm = Math.max(1, Number(byId("workTerm").value || 1));
    settings.preferences.faculty = byId("faculty").value.trim() || "Engineering";
    settings.preferences.targetRole = byId("targetRole").value.trim();
    settings.preferences.industries = ns.csvToArray(byId("industries").value);
    settings.preferences.preferredTermLength = getSelectedTermLength();

    await ns.saveSettings(settings);
    setStatus("prefsStatus", "Preferences saved.", false);
  }

  async function handleResumeUpload(file) {
    if (!file) return;

    try {
      setStatus("resumeStatus", "Extracting text from uploaded resume...", false);
      const text = await ns.extractTextFromResumeFile(file);
      byId("resumeText").value = text;
      await parseAndPersistResume(text);
    } catch (error) {
      setStatus(
        "resumeStatus",
        `Could not extract this file automatically (${error.message || error}). Paste text manually.`,
        true
      );
    }
  }

  function wireEvents() {
    byId("resumeUpload").addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      setResumeFileNameLabel(file ? file.name : "");
      await handleResumeUpload(file);
    });

    byId("parseResumeBtn").addEventListener("click", async () => {
      const text = byId("resumeText").value.trim();
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
