(function initContentCommon(global) {
  const ns = (global.WWP = global.WWP || {});

  function lower(value) {
    return String(value || "").toLowerCase();
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
    const disabled = !settings.enabled || settings.disabledPaths.includes(location.pathname);
    return {
      settings,
      disabled
    };
  };

  ns.disableCurrentPage = async function disableCurrentPage() {
    const disabled = await ns.togglePageDisabled(location.pathname);
    if (disabled) {
      alert("WaterlooWorks+ is now disabled on this page. Refresh to hide overlays.");
    } else {
      alert("WaterlooWorks+ is now enabled on this page. Refresh to apply insights.");
    }
    return disabled;
  };

  ns.fetchJobHtml = async function fetchJobHtml(url) {
    if (!ns.isWaterlooWorksUrl(url)) {
      throw new Error("Skipped non-WaterlooWorks URL");
    }

    const viaMessage = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "wwp:fetchJobHtml", url }, (response) => {
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

  ns.getUserFlagsFromConstraints = function getUserFlagsFromConstraints(constraints, preferences, scores) {
    const flags = {
      eightMonthPreferred: !!(constraints && constraints.eightMonthPreferred),
      userTermLength: preferences && preferences.preferredTermLength ? preferences.preferredTermLength : "4",
      highSkillMatch: scores && scores.skillMatch >= 70,
      lowSkillMatch: scores && scores.skillMatch < 45
    };
    return flags;
  };

  ns.getConstraintFlagLabels = function getConstraintFlagLabels(constraints) {
    if (!constraints) return [];
    const flags = [];
    if (constraints.eightMonthPreferred) flags.push("8-month preferred");
    if (constraints.coverLetterRequired) flags.push("Cover letter required");
    if (constraints.coverLetterRecommended && !constraints.coverLetterRequired) flags.push("Cover letter recommended");
    if (constraints.transcriptRequired) flags.push("Transcript required");
    if (constraints.gpaRequirement) flags.push(`GPA req: ${constraints.gpaRequirement}`);
    if (constraints.firstYearCompletion) flags.push("First-year completion");
    if (constraints.termRestriction) flags.push("Term restriction");
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

    return {
      isPhd: hasPhdSignal,
      isGraduate: hasGradSignal
    };
  }

  ns.detectHardDisqualifier = function detectHardDisqualifier(constraints, settings) {
    const c = constraints || {};
    const profile = inferUserAcademicProfile(settings || {});
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

    if (preferredTermLength === "8") {
      if (constraints.eightMonthPreferred || constraints.workTermLength === 8) return 10;
      if (constraints.workTermLength === 4) return -8;
      return 0;
    }

    if (preferredTermLength === "4") {
      if (constraints.eightMonthPreferred || constraints.workTermLength === 8) return -8;
      if (constraints.workTermLength === 4) return 8;
      return 0;
    }

    return 0;
  };
})(globalThis);
