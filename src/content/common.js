(function initContentCommon(global) {
  const ns = (global.WWP = global.WWP || {});

  function lower(value) {
    return String(value || "").toLowerCase();
  }

  const FIELD_ALIASES = {
    engineering: ["engineering", "mechatronics", "electrical", "mechanical", "systems engineering"],
    business: ["business", "commerce", "bba", "mba"],
    marketing: ["marketing", "digital marketing", "brand"],
    communications: ["communications", "communication", "public relations", "pr"],
    finance: ["finance", "accounting", "economics", "econ"],
    operations: ["operations", "supply chain", "logistics"],
    "computer science": ["computer science", "software", "cs"],
    mathematics: ["mathematics", "math", "statistics", "statistical"],
    science: ["science", "biology", "chemistry", "physics"],
    arts: ["arts", "humanities", "social science"],
    environment: ["environment", "geography", "planning"],
    health: ["health", "kinesiology", "public health"]
  };

  function detectCanonicalFields(text) {
    const t = String(text || "").toLowerCase();
    if (!t) return [];
    const out = [];
    Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
      if ((aliases || []).some((alias) => t.includes(alias))) {
        out.push(field);
      }
    });
    return Array.from(new Set(out));
  }

  function hasFieldOverlap(a, b) {
    const left = Array.isArray(a) ? a : [];
    const right = new Set(Array.isArray(b) ? b : []);
    return left.some((item) => right.has(item));
  }

  ns.isWaterlooWorksUrl = function isWaterlooWorksUrl(urlLike) {
    try {
      const parsed = new URL(String(urlLike || ""), location.origin);
      return /(^|\.)waterlooworks\.uwaterloo\.ca$/i.test(parsed.hostname);
    } catch (_error) {
      return false;
    }
  };

  ns.detectPageType = function detectPageType(doc, locationLike) {
    const currentDoc = doc || document;
    const loc = locationLike || location;

    const url = `${loc.pathname} ${loc.search}`.toLowerCase();
    const bodyText = lower(currentDoc.body ? currentDoc.body.textContent : "");
    const title = lower(currentDoc.title || "");
    const pathname = String(loc.pathname || "").toLowerCase();

    if (
      /work\s*term\s*ratings|ratings/.test(title) ||
      (bodyText.includes("students hired") && bodyText.includes("work term")) ||
      pathname.includes("worktermratings")
    ) {
      return "ratings";
    }

    if (
      /job\s*posting|position\s*description/.test(title) ||
      /jobid=|postingid=|\/posting\//.test(url) ||
      pathname.includes("/job/") ||
      pathname.includes("/posting/")
    ) {
      return "posting";
    }

    if (
      (/job\s*list|my\s*applications|waterlooworks/.test(title) && /job|posting|co-op/.test(bodyText)) ||
      pathname.includes("/myaccount/co-op") ||
      pathname.includes("/co-op/") ||
      pathname.includes("/jobs")
    ) {
      return "listings";
    }

    // TODO: tighten selectors for WaterlooWorks-specific routing when exact URLs are confirmed.
    if (/\/jobs|\/postings|search/.test(url)) {
      return "listings";
    }

    const postingLinkCount = currentDoc.querySelectorAll("a[href*='job'], a[href*='posting'], a[href*='position']").length;
    if (postingLinkCount >= 8) {
      return "listings";
    }

    return "unknown";
  };

  ns.getSettingsForPage = async function getSettingsForPage() {
    const settings = await ns.getSettings();
    const disabled = !settings.enabled;
    return {
      settings,
      disabled
    };
  };

  ns.setExtensionEnabled = async function setExtensionEnabled(enabled) {
    const settings = await ns.getSettings();
    settings.enabled = !!enabled;
    await ns.saveSettings(settings);
    return settings.enabled;
  };

  ns.disableCurrentPage = async function disableCurrentPage() {
    await ns.setExtensionEnabled(false);
    alert("WaterlooWorks+ extension is now disabled. Refresh to hide overlays.");
    return true;
  };

  ns.fetchJobHtml = async function fetchJobHtml(url, requestOptions) {
    if (!ns.isWaterlooWorksUrl(url)) {
      throw new Error("Skipped non-WaterlooWorks URL");
    }

    const target = new URL(String(url), location.origin).href;
    const options = requestOptions && typeof requestOptions === "object" ? requestOptions : {};
    const method = String(options.method || "GET").toUpperCase();
    const headers = options.headers && typeof options.headers === "object" ? { ...options.headers } : {};
    const body = typeof options.body === "string" ? options.body : undefined;
    const sameOrigin = (() => {
      try {
        return new URL(target).origin === location.origin;
      } catch (_error) {
        return false;
      }
    })();

    // Prefer direct page-origin fetch first to avoid extension-origin CORS edge cases.
    if (sameOrigin) {
      try {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), 2200) : 0;
        const response = await fetch(target, {
          method,
          headers,
          body,
          credentials: "include",
          redirect: "follow",
          signal: controller ? controller.signal : undefined
        });
        if (timer) clearTimeout(timer);
        const text = await response.text();
        if (response.ok && text && text.length > 200) {
          return text;
        }
      } catch (_error) {
        // Fall through to service worker route.
      }
    }

    const viaMessage = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "wwp:fetchJobHtml", url: target, method, headers, body }, (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, error: "No response from service worker" });
      });
    });

    if (viaMessage && viaMessage.ok && viaMessage.text) {
      return viaMessage.text;
    }

    throw new Error((viaMessage && viaMessage.error) || "Background fetch failed");
  };

  ns.fetchPostingViaBackgroundProbe = async function fetchPostingViaBackgroundProbe(payload) {
    const data = payload && typeof payload === "object" ? payload : {};
    const pageUrl = String(data.pageUrl || location.href || "");
    const jobId = String(data.jobId || "").trim();
    const title = String(data.title || "").trim();
    if (!jobId && !title) {
      throw new Error("Missing job probe identity");
    }

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "wwp:probeJobPostingInBackground",
          payload: {
            pageUrl,
            jobId,
            title
          }
        },
        (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false, error: "No background probe response" });
        }
      );
    });

    if (!response || !response.ok) {
      throw new Error((response && response.error) || "Background probe failed");
    }

    return response;
  };

  ns.getUserFlagsFromConstraints = function getUserFlagsFromConstraints(constraints, preferences, scores) {
    const flags = {
      eightMonthPreferred: !!(constraints && constraints.eightMonthPreferred),
      userTermLength: preferences && preferences.preferredTermLength ? preferences.preferredTermLength : "4",
      highSkillMatch: scores && scores.skillMatch >= 70,
      lowSkillMatch: scores && scores.skillMatch < 45,
      roleMismatch: scores && scores.targetRoleMatch < 45,
      fieldMismatchPreferred: scores && scores.fieldAlignmentPreferredMismatch,
      fieldMismatchRequired: scores && scores.fieldAlignmentRequiredMismatch
    };
    return flags;
  };

  ns.getConstraintFlagLabels = function getConstraintFlagLabels(constraints) {
    if (!constraints) return [];
    const flags = [];
    if (constraints.eightMonthPreferred) flags.push("8-month preferred");
    if (constraints.fourMonthPreferred) flags.push("4-month preferred");
    if (constraints.eightMonthRequired) flags.push("8-month required");
    if (constraints.fourMonthRequired) flags.push("4-month required");
    if (constraints.coverLetterRequired) flags.push("Cover letter required");
    if (constraints.coverLetterRecommended && !constraints.coverLetterRequired) flags.push("Cover letter recommended");
    if (constraints.transcriptRequired) flags.push("Transcript required");
    if (constraints.gpaRequirement) flags.push(`GPA req: ${constraints.gpaRequirement}`);
    if (constraints.firstYearCompletion) flags.push("First-year completion");
    if (constraints.termRestriction) flags.push("Term restriction");
    if (Number.isFinite(constraints.minWorkTerm)) flags.push(`Min work term ${constraints.minWorkTerm}`);
    if (Array.isArray(constraints.allowedWorkTerms) && constraints.allowedWorkTerms.length) {
      flags.push(`Eligible terms: ${constraints.allowedWorkTerms.join(", ")}`);
    }
    if (Number.isFinite(constraints.minAcademicYear)) flags.push(`Min year ${constraints.minAcademicYear}`);
    if (Array.isArray(constraints.requiredDegreeFields) && constraints.requiredDegreeFields.length) {
      flags.push(`Degree fields: ${constraints.requiredDegreeFields.join(", ")}`);
    }
    if (Array.isArray(constraints.preferredDegreeFields) && constraints.preferredDegreeFields.length) {
      flags.push(`Preferred fields: ${constraints.preferredDegreeFields.join(", ")}`);
    }
    if (constraints.mastersRequired) flags.push("Master's enrollment required");
    if (constraints.phdRequired) flags.push("PhD enrollment required");
    if (constraints.graduateOnly) flags.push("Graduate students only");
    return flags;
  };

  function inferUserAcademicProfile(settings) {
    const preferences = settings && settings.preferences ? settings.preferences : {};
    const resumeText = String((settings && settings.resumeRawText) || "").toLowerCase();
    const faculty = String(preferences.faculty || "").toLowerCase();

    const hasPhdSignal = /(ph\.?d|doctoral|doctorate)/.test(resumeText) || /(ph\.?d|doctoral|doctorate)/.test(faculty);
    const hasGradSignal =
      hasPhdSignal ||
      /(master'?s|msc|m\.?eng|masc|graduate student|grad student)/.test(resumeText) ||
      /(master'?s|graduate)/.test(faculty);
    const userFields = new Set(detectCanonicalFields([faculty, resumeText].join(" ")));
    if (!userFields.size && faculty) {
      if (/eng/.test(faculty)) userFields.add("engineering");
      if (/math/.test(faculty)) userFields.add("mathematics");
      if (/sci/.test(faculty)) userFields.add("science");
      if (/art/.test(faculty)) userFields.add("arts");
      if (/env/.test(faculty)) userFields.add("environment");
      if (/health/.test(faculty)) userFields.add("health");
    }

    return {
      isPhd: hasPhdSignal,
      isGraduate: hasGradSignal,
      fields: Array.from(userFields)
    };
  }

  ns.computeDegreeFieldAlignment = function computeDegreeFieldAlignment(constraints, settings) {
    const c = constraints || {};
    const profile = inferUserAcademicProfile(settings || {});
    const userFields = Array.isArray(profile.fields) ? profile.fields : [];
    const required = Array.isArray(c.requiredDegreeFields) ? c.requiredDegreeFields : [];
    const preferred = Array.isArray(c.preferredDegreeFields) ? c.preferredDegreeFields : [];

    let score = 50;
    let requiredMismatch = false;
    let preferredMismatch = false;

    if (required.length) {
      if (hasFieldOverlap(userFields, required)) {
        score = 85;
      } else {
        score = 15;
        requiredMismatch = true;
      }
    }

    if (preferred.length) {
      if (hasFieldOverlap(userFields, preferred)) {
        score += 12;
      } else {
        score -= 18;
        preferredMismatch = true;
      }
    }

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      requiredMismatch,
      preferredMismatch,
      userFields,
      requiredFields: required,
      preferredFields: preferred
    };
  };

  ns.computeTargetRoleMatch = function computeTargetRoleMatch(jobTitle, jobText, targetRoleText) {
    const title = lower(jobTitle);
    const text = lower(jobText);
    const rawTargets = String(targetRoleText || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (!rawTargets.length) return 50;

    const TECH_HINT = /(software|developer|engineer|full[- ]?stack|frontend|backend|data|ml|ai|qa|test)/i;
    const BIZ_TITLE_HINT = /(sales|marketing|communications?|business development|account manager|customer success|recruit|hr|human resources)/i;

    let best = 0;
    rawTargets.forEach((role) => {
      const r = lower(role);
      const words = r.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
      let score = 0;

      if (r && title.includes(r)) score = Math.max(score, 95);
      else if (words.length && words.every((w) => title.includes(w))) score = Math.max(score, 78);
      else if (r && text.includes(r)) score = Math.max(score, 68);
      else if (words.length) {
        const inTitle = words.filter((w) => title.includes(w)).length;
        const inText = words.filter((w) => text.includes(w)).length;
        const ratio = Math.max(inTitle / words.length, inText / words.length);
        score = Math.max(score, Math.round(ratio * 62));
      }

      if (TECH_HINT.test(r) && BIZ_TITLE_HINT.test(title)) {
        score -= 38;
      }
      best = Math.max(best, score);
    });

    return Math.max(0, Math.min(100, Math.round(best)));
  };

  ns.detectHardDisqualifier = function detectHardDisqualifier(constraints, settings) {
    const c = constraints || {};
    const profile = inferUserAcademicProfile(settings || {});
    const userTerm = Math.max(1, Number((settings && settings.preferences && settings.preferences.workTerm) || 1));
    const userAcademicYear = Math.ceil(userTerm / 2);
    const reasons = [];

    if (c.phdRequired && !profile.isPhd) {
      reasons.push("Posting requires current PhD enrollment.");
    }
    if (c.mastersRequired && !profile.isGraduate) {
      reasons.push("Posting requires current Master's enrollment.");
    }
    if (c.graduateOnly && !profile.isGraduate) {
      reasons.push("Posting is restricted to graduate students.");
    }
    if (Number.isFinite(c.minWorkTerm) && userTerm < Number(c.minWorkTerm)) {
      reasons.push(`Posting requires work term ${c.minWorkTerm}+.`);
    }
    if (Array.isArray(c.allowedWorkTerms) && c.allowedWorkTerms.length && !c.allowedWorkTerms.includes(userTerm)) {
      reasons.push(`Posting is restricted to work term ${c.allowedWorkTerms.join(", ")}.`);
    }
    if (Number.isFinite(c.minAcademicYear) && userAcademicYear < Number(c.minAcademicYear)) {
      reasons.push(`Posting requires year ${c.minAcademicYear}+ standing.`);
    }
    if (Array.isArray(c.requiredDegreeFields) && c.requiredDegreeFields.length && !hasFieldOverlap(profile.fields || [], c.requiredDegreeFields)) {
      reasons.push(`Posting targets degree fields: ${c.requiredDegreeFields.join(", ")}.`);
    }

    return {
      doNotApply: reasons.length > 0,
      reasons
    };
  };

  ns.scoreRolePreference = function scoreRolePreference(jobText, targetRole) {
    const role = lower(targetRole);
    if (!role) return 0;
    const text = lower(jobText);
    return text.includes(role) ? 12 : 0;
  };

  ns.scoreIndustryPreference = function scoreIndustryPreference(jobText, industries) {
    const list = Array.isArray(industries) ? industries : [];
    if (!list.length) return 0;
    const text = lower(jobText);
    let score = 0;
    for (const industry of list) {
      const token = lower(industry).trim();
      if (token && text.includes(token)) {
        score += 4;
      }
    }
    return Math.min(16, score);
  };

  ns.scoreTermLengthPreference = function scoreTermLengthPreference(constraints, preferredTermLength) {
    if (!constraints) return 0;
    if (preferredTermLength === "either") return 2;

    const acceptsFour = constraints.acceptsFourMonth === true;
    const acceptsEight = constraints.acceptsEightMonth === true;
    const requiresFour = constraints.fourMonthRequired === true;
    const requiresEight = constraints.eightMonthRequired === true;

    if (preferredTermLength === "8") {
      if (requiresEight) return 12;
      if (constraints.eightMonthPreferred && acceptsEight) return 10;
      if (acceptsEight && acceptsFour) return 7;
      if (acceptsEight) return 8;
      if (requiresFour || (acceptsFour && !acceptsEight) || constraints.workTermLength === 4) return -14;
      return 0;
    }

    if (preferredTermLength === "4") {
      if (requiresFour) return 12;
      if (constraints.fourMonthPreferred && acceptsFour) return 10;
      if (acceptsEight && acceptsFour) return 7;
      if (acceptsFour) return 8;
      if (requiresEight || (acceptsEight && !acceptsFour) || constraints.workTermLength === 8) return -14;
      return 0;
    }

    return 0;
  };
})(globalThis);
