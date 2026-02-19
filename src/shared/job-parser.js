(function initJobParser(global) {
  const ns = (global.WWP = global.WWP || {});

  function asDocument(htmlOrDoc) {
    if (!htmlOrDoc) return document;
    if (typeof Document !== "undefined" && htmlOrDoc instanceof Document) {
      return htmlOrDoc;
    }
    const parser = new DOMParser();
    return parser.parseFromString(String(htmlOrDoc), "text/html");
  }

  function sentenceHasKeyword(sentence, list) {
    const s = sentence.toLowerCase();
    return list.some((k) => s.includes(k));
  }

  function extractSkillsFromSentences(sentences) {
    const found = [];
    const lowerSentences = sentences.map((s) => s.toLowerCase());

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const aliases = entry.aliases || [];
      const hit = aliases.some((alias) => {
        const token = ns.normalizeToken(alias);
        if (!token) return false;
        const rx = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        return lowerSentences.some((s) => rx.test(s));
      });
      if (hit) {
        found.push(entry.key);
      }
    }

    return ns.unique(found);
  }

  function detectConstraintValue(text, regex) {
    const match = text.match(regex);
    return match ? match[0].trim() : null;
  }

  ns.parseJobPosting = function parseJobPosting(htmlOrDoc) {
    const doc = asDocument(htmlOrDoc);

    // TODO: Tune selector list to WaterlooWorks-specific posting containers.
    const postingRoot =
      doc.querySelector(".jobPosting, .postingDetails, [data-testid='job-description'], main") || doc.body || doc.documentElement;

    const fullText = ns.normalizeText(postingRoot.textContent || "");
    const sentences = ns.toSentenceList(fullText);

    const requiredKeywords = ["required", "must", "minimum qualification", "qualification", "need to", "mandatory"];
    const preferredKeywords = ["preferred", "nice to have", "asset", "bonus", "would be an asset"];

    const requiredSentences = sentences.filter((s) => sentenceHasKeyword(s, requiredKeywords));
    const preferredSentences = sentences.filter((s) => sentenceHasKeyword(s, preferredKeywords));

    const requiredSkills = extractSkillsFromSentences(requiredSentences);
    const preferredSkills = extractSkillsFromSentences(preferredSentences);

    const lowerText = fullText.toLowerCase();

    const eightMonthPreferred = /8\s*[- ]?month\s*(preferred|required)?|two\s*work\s*terms/.test(lowerText);
    const fourMonthMention = /4\s*[- ]?month/.test(lowerText);

    let workTermLength = null;
    if (eightMonthPreferred && !fourMonthMention) {
      workTermLength = 8;
    } else if (fourMonthMention && !eightMonthPreferred) {
      workTermLength = 4;
    } else if (eightMonthPreferred && fourMonthMention) {
      workTermLength = 8;
    }

    const coverLetterRequired = /cover letter\s*(is\s*)?(required|mandatory)/.test(lowerText);
    const coverLetterRecommended = /cover letter\s*(is\s*)?(recommended|preferred|encouraged)/.test(lowerText);
    const transcriptRequired = /(unofficial\s*)?transcript\s*(is\s*)?(required|mandatory|must)/.test(lowerText);
    const gpaRequirement = detectConstraintValue(
      fullText,
      /(gpa\s*(of|>=|>|minimum)?\s*\d(?:\.\d{1,2})?|minimum\s*gpa\s*\d(?:\.\d{1,2})?)/i
    );
    const firstYearCompletion = /(first[- ]year\s*(completed|completion)|completed\s*first\s*year)/.test(lowerText);

    const termRestriction = detectConstraintValue(
      fullText,
      /(work\s*term\s*(\d|one|two|three|four|five|six|seven|eight)|term\s*\d\s*only|for\s*students\s*in\s*term\s*\d)/i
    );

    const summaryBullets = ns
      .unique(
        sentences.filter((s) =>
          sentenceHasKeyword(s, ["must", "required", "preferred", "cover letter", "transcript", "gpa", "8-month", "term"])
        )
      )
      .slice(0, 8);

    const constraints = {
      workTermLength,
      eightMonthPreferred,
      coverLetterRequired,
      coverLetterRecommended,
      transcriptRequired,
      gpaRequirement,
      firstYearCompletion,
      termRestriction
    };

    return {
      requiredSkills,
      preferredSkills,
      constraints,
      summaryBullets,
      fullText
    };
  };
})(globalThis);
