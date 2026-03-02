(function initScoring(global) {
  const ns = (global.WWP = global.WWP || {});

  function asSkillMap(skills) {
    if (skills instanceof Map) return skills;
    const map = new Map();
    if (skills && typeof skills === "object") {
      for (const [k, v] of Object.entries(skills)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) map.set(k, 1);
      }
    }
    return map;
  }

  function findSkillEntryByKey(key) {
    return (ns.SKILLS_DICTIONARY || []).find((item) => item.key === key) || null;
  }

  function countAliasHits(text, aliases) {
    let hits = 0;
    const lower = String(text || "").toLowerCase();
    for (const alias of aliases || []) {
      const token = ns.normalizeToken(alias);
      if (!token) continue;
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = lower.match(new RegExp(`\\b${escaped}\\b`, "g"));
      hits += match ? match.length : 0;
    }
    return hits;
  }

  function getCategoryMultiplier(entry) {
    const category = String((entry && entry.category) || "").toLowerCase();
    if (!category) return 1;
    if (category === "soft-skill") return 0.55;
    if (category === "process") return 0.5;
    if (category === "domain") return 0.75;
    return 1;
  }

  function deriveMentionWeightsFromText(text) {
    const lower = String(text || "").toLowerCase();
    const mentionWeights = new Map();
    if (!lower.trim()) return mentionWeights;

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const key = String(entry && entry.key ? entry.key : "").trim();
      if (!key) continue;

      const aliases = ns.unique([key, ...((entry && entry.aliases) || [])]);
      const hits = countAliasHits(lower, aliases);
      if (hits <= 0) continue;

      const baseWeight = Number(entry.baseWeight || 1);
      const categoryFactor = getCategoryMultiplier(entry);
      const mentionWeight = (0.75 + Math.min(2.4, hits * 0.42)) * baseWeight * categoryFactor;
      mentionWeights.set(key, Number(mentionWeight.toFixed(3)));
    }

    return mentionWeights;
  }

  function isTechnicalRequiredSkill(skillKey) {
    const entry = findSkillEntryByKey(skillKey);
    const category = String((entry && entry.category) || "").toLowerCase();
    return category !== "soft-skill" && category !== "process";
  }

  ns.computeSkillMatch = function computeSkillMatch(resumeSkills, jobRequired, jobPreferred, fullText) {
    const resumeMap = asSkillMap(resumeSkills);
    const required = ns.unique(jobRequired || []);
    const preferred = ns.unique(jobPreferred || []);
    const fullTextValue = String(fullText || "");

    const jobWeights = new Map();

    for (const key of required) {
      const entry = findSkillEntryByKey(key);
      const categoryFactor = getCategoryMultiplier(entry);
      jobWeights.set(key, (jobWeights.get(key) || 0) + 4.2 * categoryFactor);
    }

    for (const key of preferred) {
      const entry = findSkillEntryByKey(key);
      const categoryFactor = getCategoryMultiplier(entry);
      jobWeights.set(key, (jobWeights.get(key) || 0) + 2.0 * categoryFactor);
    }

    const mentionWeights = deriveMentionWeightsFromText(fullTextValue);

    for (const [key, weight] of Array.from(jobWeights.entries())) {
      const entry = findSkillEntryByKey(key);
      if (!entry) continue;
      const aliases = ns.unique([key, ...((entry && entry.aliases) || [])]);
      const hits = countAliasHits(fullTextValue, aliases);
      jobWeights.set(key, weight + Math.min(2.4, hits * 0.28));
    }

    for (const [key, mentionWeight] of mentionWeights.entries()) {
      const existing = jobWeights.get(key) || 0;
      if (existing > 0) {
        jobWeights.set(key, existing + Math.min(1.6, mentionWeight * 0.35));
      } else {
        // Keep full-text inferred skills lighter than explicit required/preferred tags.
        jobWeights.set(key, Math.min(2.6, mentionWeight));
      }
    }

    if (jobWeights.size === 0) {
      let overlap = 0;
      for (const [skill] of resumeMap.entries()) {
        if (fullTextValue.toLowerCase().includes(skill.toLowerCase())) {
          overlap += 1;
        }
      }
      return ns.clamp(Math.round(Math.min(100, overlap * 8)), 0, 100);
    }

    let achieved = 0;
    let total = 0;

    for (const [skill, weight] of jobWeights.entries()) {
      total += weight;
      if ((resumeMap.get(skill) || 0) > 0) {
        achieved += weight;
      }
    }

    if (total <= 0) return 0;
    let score = (achieved / total) * 100;

    // When explicit technical required skills are present, coverage should drive score more strongly.
    const technicalRequired = required.filter((skill) => isTechnicalRequiredSkill(skill));
    if (technicalRequired.length >= 3) {
      const matchedRequired = technicalRequired.filter((skill) => (resumeMap.get(skill) || 0) > 0).length;
      const requiredCoverage = matchedRequired / technicalRequired.length;
      if (requiredCoverage >= 0.75) {
        score = Math.max(score, 42 + requiredCoverage * 52);
      } else if (requiredCoverage >= 0.55) {
        score = Math.max(score, 30 + requiredCoverage * 46);
      }
    }

    return ns.clamp(Math.round(score), 0, 100);
  };

  function parseTermFromLabel(label) {
    const text = String(label || "").toLowerCase();
    const match = text.match(/(?:work\s*term|term|wt)?\s*([1-9])/i);
    return match ? Number(match[1]) : null;
  }

  ns.computeTermCompatibility = function computeTermCompatibility(userTerm, termDist) {
    const term = Number(userTerm);
    if (!Number.isFinite(term) || term < 1) return 50;
    if (!Array.isArray(termDist) || termDist.length === 0) return 50;

    const maxShare = Math.max(...termDist.map((x) => Number(x.percent) || 0), 0);
    const matched = termDist.find((x) => parseTermFromLabel(x.label) === term);
    const share = matched ? Number(matched.percent) || 0 : 0;

    if (share <= 0) return 15;

    const relative = maxShare > 0 ? share / maxShare : 0;
    let score = 30 + share * 1.8;
    score += relative * 20;
    return ns.clamp(Math.round(score), 0, 100);
  };

  ns.computeFacultyAlignment = function computeFacultyAlignment(userFaculty, facultyDist) {
    const faculty = String(userFaculty || "").toLowerCase();
    if (!faculty) return 50;
    if (!Array.isArray(facultyDist) || facultyDist.length === 0) return 50;

    const maxShare = Math.max(...facultyDist.map((x) => Number(x.percent) || 0), 0);
    let matchedShare = 0;

    for (const row of facultyDist) {
      const label = String(row.label || "").toLowerCase();
      if (label.includes(faculty) || faculty.includes(label)) {
        matchedShare = Math.max(matchedShare, Number(row.percent) || 0);
      }
    }

    if (matchedShare <= 0) return 25;

    const relative = maxShare > 0 ? matchedShare / maxShare : 0;
    return ns.clamp(Math.round(35 + matchedShare * 1.2 + relative * 25), 0, 100);
  };

  function computeTrendSlope(values) {
    if (!values || values.length < 3) return 0;
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i += 1) {
      const x = i;
      const y = values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (!denominator) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  ns.computeSelectivity = function computeSelectivity(hiresByTermTable) {
    if (!Array.isArray(hiresByTermTable) || hiresByTermTable.length === 0) return 0;

    const hires = hiresByTermTable
      .map((row) => Number(row.hires))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (!hires.length) return 0;

    const avg = hires.reduce((sum, v) => sum + v, 0) / hires.length;
    let adjustment = 0;

    if (avg >= 20) adjustment = 20;
    else if (avg >= 12) adjustment = 10;
    else if (avg >= 6) adjustment = 0;
    else if (avg >= 3) adjustment = -10;
    else adjustment = -20;

    const slope = computeTrendSlope(hires);
    if (slope > 0.7) adjustment += 5;
    if (slope < -0.7) adjustment -= 5;

    return ns.clamp(Math.round(adjustment), -20, 20);
  };

  ns.computeViabilityScore = function computeViabilityScore(
    skillMatch,
    termCompatibility,
    facultyAlignment,
    selectivityAdjustment
  ) {
    const skill = ns.clamp(Number(skillMatch) || 0, 0, 100);
    const term = ns.clamp(Number(termCompatibility) || 0, 0, 100);
    const faculty = ns.clamp(Number(facultyAlignment) || 0, 0, 100);
    const selectivity = ns.clamp(Number(selectivityAdjustment) || 0, -20, 20);

    const base = skill * 0.5 + term * 0.25 + faculty * 0.15;
    const score = ns.clamp(Math.round(base + selectivity), 0, 100);

    return {
      score,
      breakdown: {
        skillMatch: skill,
        termCompatibility: term,
        facultyAlignment: faculty,
        selectivityAdjustment: selectivity,
        weightedBase: Math.round(base)
      }
    };
  };

  ns.recommendAction = function recommendAction(viability, flags) {
    const value = ns.clamp(Number(viability) || 0, 0, 100);
    const activeFlags = flags || {};

    if (activeFlags.hardDisqualifier) {
      const reasons = Array.isArray(activeFlags.hardReasons) ? activeFlags.hardReasons : [];
      return {
        label: "Do not apply",
        reasons: (reasons.length ? reasons : ["Posting has a hard eligibility requirement that does not match your profile."]).slice(
          0,
          2
        )
      };
    }

    let label = "Apply as a reach";

    if (value >= 80) label = "Apply aggressively";
    else if (value >= 65) label = "Apply if you have exceptional projects";
    else if (value >= 50) label = "Apply as a reach";
    else if (value >= 35) label = "Better suited next term";
    else label = "Consider alternative divisions";

    const reasons = [];

    if (activeFlags.termShareZero) {
      reasons.push("Historical hires for your work-term level appear near zero.");
    }
    if (activeFlags.facultyWeak) {
      reasons.push("Faculty alignment is weak in available hiring history.");
    }
    if (activeFlags.eightMonthPreferred && activeFlags.userTermLength === "4") {
      reasons.push("Posting appears to prefer an 8-month commitment.");
    }
    if (activeFlags.highSkillMatch) {
      reasons.push("Your resume aligns strongly with listed technical requirements.");
    }
    if (activeFlags.lowSkillMatch) {
      reasons.push("Skill match is low relative to required qualifications.");
    }

    if (reasons.length < 2) {
      if (value >= 70) reasons.push("Composite viability score is favorable compared to baseline.");
      if (value < 50) reasons.push("Composite viability score indicates elevated selectivity risk.");
    }

    return {
      label,
      reasons: reasons.slice(0, 2)
    };
  };
})(globalThis);
