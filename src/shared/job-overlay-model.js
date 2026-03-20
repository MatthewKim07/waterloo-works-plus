/**
 * One structured object per listings row for badges + inspector (keeps DOM layer thin).
 */
(function initJobOverlayModel(global) {
  const ns = (global.WWP = global.WWP || {});

  /**
   * @param {object} job - listings row job (title, company, location, …)
   * @param {object} parsed - parseJobPosting result
   * @param {object} scores - skillMatch, overallMatch, recommendation, flags, hardDisqualifier, hardReasons
   */
  function build(job, parsed, scores) {
    const p = parsed || {};
    const c = p.constraints || {};
    const req = Array.isArray(p.requiredSkills) ? p.requiredSkills : [];
    const pref = Array.isArray(p.preferredSkills) ? p.preferredSkills : [];
    const topSkills = [...req.slice(0, 5), ...pref.slice(0, 3)].filter(Boolean);
    const uniqueSkills = [];
    const seen = new Set();
    topSkills.forEach((s) => {
      const k = String(s).toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniqueSkills.push(s);
      }
    });

    const docBits = [];
    if (c.coverLetterRequired) docBits.push("cover letter");
    else if (c.coverLetterRecommended) docBits.push("cover letter?");
    if (c.transcriptRequired) docBits.push("transcript");

    let termLabel = "";
    if (c.workTermLength === 8 || c.eightMonthRequired) termLabel = "8 mo";
    else if (c.workTermLength === 4 || c.fourMonthRequired) termLabel = "4 mo";
    else if (c.eightMonthPreferred) termLabel = "8 mo pref";
    else if (c.fourMonthPreferred) termLabel = "4 mo pref";

    const rec = scores && scores.recommendation ? scores.recommendation : null;

    return {
      version: 1,
      summary: {
        title: String((job && job.title) || ""),
        company: String((job && job.company) || ""),
        location: String((job && job.location) || "")
      },
      scores: {
        overallMatch: Number(scores && scores.overallMatch) || 0,
        skillMatch: Number(scores && scores.skillMatch) || 0,
        targetRoleMatch: Number(scores && scores.targetRoleMatch) || 0
      },
      recommendation: {
        label: rec && rec.label ? rec.label : "",
        tone: rec && rec.tone ? rec.tone : ""
      },
      signals: {
        termLabel: termLabel || null,
        stackChips: uniqueSkills.slice(0, 6),
        constraintFlags: Array.isArray(scores && scores.flags) ? scores.flags.slice(0, 6) : [],
        docs: docBits,
        hardBlock: !!(scores && scores.hardDisqualifier),
        hardReasons: Array.isArray(scores && scores.hardReasons) ? scores.hardReasons.slice(0, 3) : []
      }
    };
  }

  ns.jobOverlayModel = { build };
})(globalThis);
