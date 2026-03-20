(function initAutofillResolvers(global) {
  const ns = (global.WWP = global.WWP || {});
  const { AUTOFILL_INTENT: I } = ns;

  function snippetFromResume(profile, maxLen) {
    const t = String((profile && profile.resumeRawText) || "").trim();
    if (!t) return "";
    const lim = maxLen || 400;
    return t.length > lim ? `${t.slice(0, lim)}…` : t;
  }

  function resolve(intent, profile, settings) {
    if (!intent || intent === I.UNKNOWN) {
      return { value: "", confidence: "low", note: "Unclassified field" };
    }
    const prefs = (settings && settings.preferences) || {};
    const p = profile || {};

    if (intent === I.PROGRAM) {
      return {
        value: `${prefs.faculty || ""} — target: ${prefs.targetRole || "(set in app)"}`.trim(),
        confidence: prefs.faculty ? "medium" : "low",
        note: "Check against your calendar program name"
      };
    }
    if (intent === I.TERM) {
      return {
        value: String(prefs.workTerm || ""),
        confidence: "medium",
        note: "Verify sequence number matches WW"
      };
    }
    if (intent === I.COVER_LETTER_TEXT || intent === I.WHY_COMPANY) {
      const snip = snippetFromResume(p, 600);
      return {
        value: snip ? `[Draft from resume — edit heavily]\n${snip}` : "",
        confidence: snip ? "low" : "low",
        note: "Requires human rewrite"
      };
    }
    if (intent === I.WORK_AUTHORIZATION) {
      return { value: "Yes — edit if you need exceptions", confidence: "low", note: "Legal wording is on you" };
    }
    return { value: "", confidence: "low", note: "No canned value" };
  }

  ns.autofillResolvers = { resolve, snippetFromResume };
})(globalThis);
