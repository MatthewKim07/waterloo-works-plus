(function initPostingPage(global) {
  const ns = (global.WWP = global.WWP || {});
  if (ns.__WWP_POSTING_RAN) return;
  ns.__WWP_POSTING_RAN = true;

  function estimateTermCompatibilityFromConstraints(constraints, userTerm) {
    const term = Number(userTerm || 1);
    if (!constraints) return 50;

    if (constraints.termRestriction) {
      const matches = (constraints.termRestriction.match(/\d+/g) || []).map(Number);
      if (matches.length && !matches.includes(term)) {
        return 20;
      }
      if (matches.length && matches.includes(term)) {
        return 85;
      }
    }

    if (constraints.firstYearCompletion && term <= 2) return 90;
    if (constraints.firstYearCompletion && term > 2) return 45;

    return 60;
  }

  function collectChips(constraints) {
    const chips = [];
    if (!constraints) return chips;
    if (constraints.workTermLength) chips.push({ text: `${constraints.workTermLength}-month term`, tone: "" });
    if (constraints.eightMonthPreferred) chips.push({ text: "8-month preferred", tone: "warn" });
    if (constraints.coverLetterRequired) chips.push({ text: "Cover letter required", tone: "warn" });
    if (constraints.coverLetterRecommended && !constraints.coverLetterRequired) {
      chips.push({ text: "Cover letter recommended", tone: "" });
    }
    if (constraints.transcriptRequired) chips.push({ text: "Transcript required", tone: "warn" });
    if (constraints.gpaRequirement) chips.push({ text: constraints.gpaRequirement, tone: "danger" });
    if (constraints.firstYearCompletion) chips.push({ text: "First-year completion", tone: "" });
    if (constraints.termRestriction) chips.push({ text: constraints.termRestriction, tone: "danger" });
    return chips;
  }

  function createSkillGapCard(parsed, resumeSkillMap) {
    const card = ns.makeCard("Required Skill Coverage");
    const req = parsed.requiredSkills || [];
    const pref = parsed.preferredSkills || [];

    const matchedRequired = req.filter((skill) => (resumeSkillMap.get(skill) || 0) > 0);
    const missingRequired = req.filter((skill) => (resumeSkillMap.get(skill) || 0) <= 0);

    const list = document.createElement("ul");
    list.className = "wwp-list";

    list.appendChild(Object.assign(document.createElement("li"), {
      textContent: `Matched required: ${matchedRequired.length}/${req.length || 0}`
    }));

    if (missingRequired.length) {
      list.appendChild(Object.assign(document.createElement("li"), {
        textContent: `Missing required: ${missingRequired.slice(0, 6).join(", ")}`
      }));
    }

    if (pref.length) {
      list.appendChild(Object.assign(document.createElement("li"), {
        textContent: `Preferred skills detected: ${pref.slice(0, 6).join(", ")}`
      }));
    }

    if (!req.length && !pref.length) {
      list.appendChild(Object.assign(document.createElement("li"), {
        textContent: "No clear required/preferred skill section was detected in the posting text."
      }));
    }

    card.appendChild(list);
    return card;
  }

  function createConstraintsCard(parsed) {
    const card = ns.makeCard("Detected Constraints");
    const chipsWrap = document.createElement("div");
    chipsWrap.className = "wwp-chip-wrap";
    const chips = collectChips(parsed.constraints);
    if (!chips.length) {
      chipsWrap.appendChild(ns.makeChip("No strong constraints detected", "good"));
    } else {
      chips.forEach((chip) => chipsWrap.appendChild(ns.makeChip(chip.text, chip.tone)));
    }
    card.appendChild(chipsWrap);
    return card;
  }

  async function run() {
    const pageType = ns.detectPageType(document, location);
    if (pageType !== "posting") return;

    const gate = await ns.getSettingsForPage();
    if (gate.disabled) return;

    const parsed = ns.parseJobPosting(document);
    const resumeSkills = ns.getResumeSkillMap(gate.settings);

    const skillMatch = ns.computeSkillMatch(resumeSkills, parsed.requiredSkills, parsed.preferredSkills, parsed.fullText);
    const termCompatibility = estimateTermCompatibilityFromConstraints(parsed.constraints, gate.settings.preferences.workTerm);
    const facultyAlignment = 50;
    const viability = ns.computeViabilityScore(skillMatch, termCompatibility, facultyAlignment, 0);

    const flags = ns.getUserFlagsFromConstraints(parsed.constraints, gate.settings.preferences, { skillMatch });
    const recommendation = ns.recommendAction(viability.score, flags);

    const panel = ns.createShadowPanel({
      id: "wwp-posting-panel",
      title: "WaterlooWorks+ Intelligence",
      subtitle: "Posting-specific extraction and strategy",
      width: 390,
      onDisablePage: () => ns.disableCurrentPage()
    });

    const tabs = ns.createTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "requirements", label: "Requirements" },
        { id: "summary", label: "Summary" },
        { id: "strategy", label: "Strategy" }
      ],
      "overview"
    );
    panel.body.appendChild(tabs.root);

    const scoreCard = ns.makeCard("Scores");
    scoreCard.appendChild(ns.makeProgressMetric("Skill Match", skillMatch));
    scoreCard.appendChild(ns.makeProgressMetric("Viability", viability.score));

    const breakdown = document.createElement("div");
    breakdown.className = "wwp-kv";
    [
      ["Work Term Compatibility", `${viability.breakdown.termCompatibility}%`],
      ["Faculty Alignment", `${viability.breakdown.facultyAlignment}%`],
      ["Selectivity Adj.", `${viability.breakdown.selectivityAdjustment}`]
    ].forEach(([k, v]) => {
      const row = document.createElement("div");
      row.innerHTML = `<span>${k}</span><strong>${v}</strong>`;
      breakdown.appendChild(row);
    });
    scoreCard.appendChild(breakdown);

    const recCard = ns.makeCard("Strategic Recommendation");
    const recTitle = document.createElement("p");
    recTitle.style.margin = "0 0 6px";
    recTitle.style.fontWeight = "700";
    recTitle.textContent = recommendation.label;
    const reasonsList = document.createElement("ul");
    reasonsList.className = "wwp-list";
    recommendation.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      reasonsList.appendChild(li);
    });
    recCard.append(recTitle, reasonsList);

    tabs.appendToTab("overview", scoreCard);
    tabs.appendToTab("overview", recCard);

    const reqCard = ns.makeCard("Required vs Preferred Skills");
    const reqList = document.createElement("ul");
    reqList.className = "wwp-list";

    const requiredLines = parsed.requiredSkills.length
      ? parsed.requiredSkills.map((skill) => `Required: ${skill}`)
      : ["No explicit required-skill pattern detected"];
    const preferredLines = parsed.preferredSkills.slice(0, 8).map((skill) => `Preferred: ${skill}`);

    [...requiredLines.slice(0, 10), ...preferredLines].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      reqList.appendChild(li);
    });
    reqCard.appendChild(reqList);

    tabs.appendToTab("requirements", reqCard);
    tabs.appendToTab("requirements", createConstraintsCard(parsed));
    tabs.appendToTab("requirements", createSkillGapCard(parsed, resumeSkills));

    const summaryCard = ns.makeCard("Rule-Based Summary Bullets");
    const summaryList = document.createElement("ul");
    summaryList.className = "wwp-list";
    (parsed.summaryBullets.length ? parsed.summaryBullets : ["No focused requirement sentences extracted"]).slice(0, 10).forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      summaryList.appendChild(li);
    });
    summaryCard.appendChild(summaryList);

    const extractionCard = ns.makeCard("Extraction Snapshot");
    const extractionList = document.createElement("ul");
    extractionList.className = "wwp-list";
    [
      `Posting text length parsed: ${parsed.fullText.length} characters`,
      `Required skills found: ${parsed.requiredSkills.length}`,
      `Preferred skills found: ${parsed.preferredSkills.length}`,
      `Constraint flags found: ${collectChips(parsed.constraints).length}`
    ].forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      extractionList.appendChild(li);
    });
    extractionCard.appendChild(extractionList);

    tabs.appendToTab("summary", summaryCard);
    tabs.appendToTab("summary", extractionCard);

    const strategyCard = ns.makeCard("Action Plan");
    const strategyList = document.createElement("ul");
    strategyList.className = "wwp-list";

    const missing = (parsed.requiredSkills || []).filter((skill) => (resumeSkills.get(skill) || 0) <= 0);

    [
      recommendation.label,
      missing.length
        ? `Address missing requirements in resume/cover letter: ${missing.slice(0, 5).join(", ")}`
        : "Highlight your matched required skills near the top of your application materials.",
      parsed.constraints.coverLetterRequired
        ? "This posting appears to require a cover letter; tailor one to required skills."
        : "Cover letter is not explicitly required, but adding one may still improve competitiveness.",
      parsed.constraints.transcriptRequired
        ? "Prepare transcript early; posting indicates transcript requirement."
        : "No explicit transcript requirement detected."
    ].forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      strategyList.appendChild(li);
    });

    strategyCard.appendChild(strategyList);
    tabs.appendToTab("strategy", strategyCard);
  }

  run().catch((error) => {
    console.error("WaterlooWorks+ posting script failed", error);
  });
})(globalThis);
