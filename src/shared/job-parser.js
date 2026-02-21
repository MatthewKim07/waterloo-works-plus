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

  function detectTermSignals(lowerText) {
    const text = String(lowerText || "");

    const fourMonthMention = /(?:^|[^0-9])4\s*[- ]?month(?:s)?\b|four\s*[- ]?month(?:s)?\b/.test(text);
    const eightMonthMention = /(?:^|[^0-9])8\s*[- ]?month(?:s)?\b|eight\s*[- ]?month(?:s)?\b|two\s*work\s*terms?\b/.test(text);

    const bothMentioned =
      /(?:4|four)\s*[- ]?month(?:s)?\s*(?:or|\/|and|&)\s*(?:8|eight)\s*[- ]?month(?:s)?/.test(text) ||
      /(?:8|eight)\s*[- ]?month(?:s)?\s*(?:or|\/|and|&)\s*(?:4|four)\s*[- ]?month(?:s)?/.test(text);

    const eightMonthPreferred =
      /(?:8|eight)\s*[- ]?month(?:s)?\s*(?:preferred|preferable|ideally)/.test(text) ||
      /prefer(?:red)?\s*(?:an?\s*)?(?:8|eight)\s*[- ]?month(?:s)?/.test(text) ||
      /two\s*work\s*terms?\s*preferred/.test(text);

    const fourMonthPreferred =
      /(?:4|four)\s*[- ]?month(?:s)?\s*(?:preferred|preferable|ideally)/.test(text) ||
      /prefer(?:red)?\s*(?:an?\s*)?(?:4|four)\s*[- ]?month(?:s)?/.test(text);

    const eightMonthRequired =
      /(?:8|eight)\s*[- ]?month(?:s)?\s*(?:required|mandatory|only)/.test(text) ||
      /must\s*(?:be|do)?\s*(?:an?\s*)?(?:8|eight)\s*[- ]?month(?:s)?/.test(text) ||
      /requires?\s*(?:an?\s*)?(?:8|eight)\s*[- ]?month(?:s)?/.test(text) ||
      /two\s*work\s*terms?\s*(?:required|mandatory)/.test(text);

    const fourMonthRequired =
      /(?:4|four)\s*[- ]?month(?:s)?\s*(?:required|mandatory|only)/.test(text) ||
      /must\s*(?:be|do)?\s*(?:an?\s*)?(?:4|four)\s*[- ]?month(?:s)?/.test(text) ||
      /requires?\s*(?:an?\s*)?(?:4|four)\s*[- ]?month(?:s)?/.test(text);

    const fourExplicitlyAccepted =
      /(?:4|four)\s*[- ]?month(?:s)?\s*(?:accepted|considered|possible|available|option|okay|ok)/.test(text) ||
      /open\s+to\s+(?:4|four)\s*[- ]?month(?:s)?/.test(text);

    const eightExplicitlyAccepted =
      /(?:8|eight)\s*[- ]?month(?:s)?\s*(?:accepted|considered|possible|available|option|okay|ok)/.test(text) ||
      /open\s+to\s+(?:8|eight)\s*[- ]?month(?:s)?/.test(text) ||
      /open\s+to\s+two\s*work\s*terms?/.test(text);

    let acceptsFourMonth = null;
    let acceptsEightMonth = null;

    if (bothMentioned) {
      acceptsFourMonth = true;
      acceptsEightMonth = true;
    } else if (fourMonthRequired && !eightExplicitlyAccepted) {
      acceptsFourMonth = true;
      acceptsEightMonth = false;
    } else if (eightMonthRequired && !fourExplicitlyAccepted) {
      acceptsFourMonth = false;
      acceptsEightMonth = true;
    } else {
      if (fourMonthMention || fourExplicitlyAccepted || fourMonthPreferred) acceptsFourMonth = true;
      if (eightMonthMention || eightExplicitlyAccepted || eightMonthPreferred) acceptsEightMonth = true;
    }

    if (fourExplicitlyAccepted) acceptsFourMonth = true;
    if (eightExplicitlyAccepted) acceptsEightMonth = true;

    if (acceptsFourMonth == null && !acceptsEightMonth && fourMonthMention) acceptsFourMonth = true;
    if (acceptsEightMonth == null && !acceptsFourMonth && eightMonthMention) acceptsEightMonth = true;

    return {
      fourMonthMention,
      eightMonthMention,
      fourMonthPreferred,
      eightMonthPreferred,
      fourMonthRequired,
      eightMonthRequired,
      acceptsFourMonth,
      acceptsEightMonth
    };
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

    const termSignals = detectTermSignals(lowerText);

    let workTermLength = null;
    if (termSignals.eightMonthRequired && !termSignals.acceptsFourMonth) {
      workTermLength = 8;
    } else if (termSignals.fourMonthRequired && !termSignals.acceptsEightMonth) {
      workTermLength = 4;
    } else if (termSignals.acceptsEightMonth && !termSignals.acceptsFourMonth) {
      workTermLength = 8;
    } else if (termSignals.acceptsFourMonth && !termSignals.acceptsEightMonth) {
      workTermLength = 4;
    }

    const coverLetterRequired = /cover letter\s*(is\s*)?(required|mandatory)/.test(lowerText);
    const coverLetterRecommended = /cover letter\s*(is\s*)?(recommended|preferred|encouraged)/.test(lowerText);
    const transcriptRequired = /(unofficial\s*)?transcript\s*(is\s*)?(required|mandatory|must)/.test(lowerText);
    const gpaRequirement = detectConstraintValue(
      fullText,
      /(gpa\s*(of|>=|>|minimum)?\s*\d(?:\.\d{1,2})?|minimum\s*gpa\s*\d(?:\.\d{1,2})?)/i
    );
    const firstYearCompletion = /(first[- ]year\s*(completed|completion)|completed\s*first\s*year)/.test(lowerText);
    const mastersRequired =
      /(currently\s+enrolled\s+in\s+(a\s+)?master'?s|must\s+be\s+(currently\s+)?enrolled\s+in\s+(a\s+)?master'?s|master'?s\s+program\s+(required|only))/i.test(
        fullText
      );
    const phdRequired =
      /(currently\s+enrolled\s+in\s+(a\s+)?ph\.?d|must\s+be\s+(currently\s+)?enrolled\s+in\s+(a\s+)?ph\.?d|ph\.?d\s+(students?\s+)?(required|only))/i.test(
        fullText
      );
    const graduateOnly =
      /(graduate\s+students?\s+only|must\s+be\s+a\s+graduate\s+student|for\s+master'?s\s+or\s+ph\.?d|graduate[- ]level\s+students?\s+only)/i.test(
        fullText
      );

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
      fourMonthMention: termSignals.fourMonthMention,
      eightMonthMention: termSignals.eightMonthMention,
      fourMonthPreferred: termSignals.fourMonthPreferred,
      eightMonthPreferred: termSignals.eightMonthPreferred,
      fourMonthRequired: termSignals.fourMonthRequired,
      eightMonthRequired: termSignals.eightMonthRequired,
      acceptsFourMonth: termSignals.acceptsFourMonth,
      acceptsEightMonth: termSignals.acceptsEightMonth,
      coverLetterRequired,
      coverLetterRecommended,
      transcriptRequired,
      gpaRequirement,
      firstYearCompletion,
      termRestriction,
      mastersRequired,
      phdRequired,
      graduateOnly
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
