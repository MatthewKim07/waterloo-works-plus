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

  const SKILL_SECTION_HEADING_REGEX =
    /\b(skills?\s*(?:and|&)?\s*experience|technical skills?|qualifications?|requirements?|what you(?:'|’)ll bring|what we(?:'|’)re looking for|must[- ]?have|minimum qualifications?)\b/i;
  const SOFT_PREFERENCE_CUE_REGEX = /\b(preferred|preferable|asset|nice to have|bonus|plus|would be an asset|considered an asset)\b/i;
  const HARD_REQUIREMENT_CUE_REGEX =
    /\b(required|must|mandatory|minimum qualification|proficiency|strong proficiency|experience with|familiarity with|knowledge of|understanding of|ability to|hands[- ]on|competenc(?:y|ies)|expertise in)\b/i;

  function collectDirectListItemTexts(node) {
    if (!node) return [];
    const selector = ":scope > ul > li, :scope > ol > li";
    const items = Array.from(node.querySelectorAll(selector))
      .map((li) => ns.normalizeText(li.textContent || ""))
      .filter((text) => text.length >= 12);
    return ns.unique(items);
  }

  function collectNeighborListItemTexts(headingNode) {
    const lines = [];
    if (!headingNode) return lines;

    let cursor = headingNode.nextElementSibling;
    let steps = 0;
    while (cursor && steps < 6) {
      const nodeText = ns.normalizeText(cursor.textContent || "");
      if (steps > 0 && SKILL_SECTION_HEADING_REGEX.test(nodeText) && nodeText.length <= 140) {
        break;
      }

      const direct = collectDirectListItemTexts(cursor);
      if (direct.length) lines.push(...direct);

      if (cursor.matches && cursor.matches("li")) {
        const liText = ns.normalizeText(cursor.textContent || "");
        if (liText.length >= 12) lines.push(liText);
      }

      cursor = cursor.nextElementSibling;
      steps += 1;
    }

    return ns.unique(lines);
  }

  function extractSkillBulletsFromHeadingSections(postingRoot) {
    if (!postingRoot || !postingRoot.querySelectorAll) return [];
    const candidates = Array.from(postingRoot.querySelectorAll("h1,h2,h3,h4,h5,strong,b,p,div,span,td,th,label"));
    const bullets = [];

    for (const node of candidates) {
      const headingText = ns.normalizeText(node.textContent || "");
      if (!headingText || headingText.length > 160) continue;
      if (!SKILL_SECTION_HEADING_REGEX.test(headingText)) continue;

      bullets.push(...collectDirectListItemTexts(node.parentElement));
      bullets.push(...collectNeighborListItemTexts(node));
    }

    return ns.unique(
      bullets.filter((line) => {
        if (!line || line.length < 12) return false;
        if (SOFT_PREFERENCE_CUE_REGEX.test(line) && !HARD_REQUIREMENT_CUE_REGEX.test(line)) return false;
        return extractSkillsFromSentences([line]).length > 0;
      })
    );
  }

  function getImplicitSkillSentences(sentences, mode) {
    const source = Array.isArray(sentences) ? sentences : [];
    return source.filter((sentence) => {
      const line = String(sentence || "");
      if (!line) return false;
      const hasSkillAlias = extractSkillsFromSentences([line]).length > 0;
      if (!hasSkillAlias) return false;

      if (mode === "required") {
        if (SOFT_PREFERENCE_CUE_REGEX.test(line) && !HARD_REQUIREMENT_CUE_REGEX.test(line)) return false;
        return HARD_REQUIREMENT_CUE_REGEX.test(line);
      }

      if (mode === "preferred") {
        return SOFT_PREFERENCE_CUE_REGEX.test(line);
      }

      return false;
    });
  }

  function detectConstraintValue(text, regex) {
    const match = text.match(regex);
    return match ? match[0].trim() : null;
  }

  function wordToNumber(token) {
    const value = String(token || "").toLowerCase().trim();
    const table = {
      one: 1,
      first: 1,
      "1st": 1,
      two: 2,
      second: 2,
      "2nd": 2,
      three: 3,
      third: 3,
      "3rd": 3,
      four: 4,
      fourth: 4,
      "4th": 4,
      five: 5,
      fifth: 5,
      "5th": 5,
      six: 6,
      sixth: 6,
      "6th": 6,
      seven: 7,
      seventh: 7,
      "7th": 7,
      eight: 8,
      eighth: 8,
      "8th": 8
    };
    if (table[value]) return table[value];
    const numeric = Number(value.replace(/(?:st|nd|rd|th)$/i, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  function extractHardEligibilityRequirements(sentences) {
    let minWorkTerm = null;
    let minAcademicYear = null;
    const allowedWorkTerms = new Set();
    const notes = [];

    (sentences || []).forEach((sentence) => {
      const s = String(sentence || "");
      const lower = s.toLowerCase();
      if (!lower) return;

      const softCue = /(preferred|preferable|ideally|asset|nice to have|considered an asset|would be an asset)/.test(lower);
      const hardQualifier = /(must|required|only|eligible|mandatory)/.test(lower);
      const hardRangeCue = /(minimum|at least|or above|or higher|and above|\+)/.test(lower);
      if (softCue && !hardQualifier) return;
      if (!hardQualifier && !hardRangeCue) return;

      // Work-term constraints (only / minimum / ranges)
      const workTermPattern = /(?:work\s*term|term)\s*(one|two|three|four|five|six|seven|eight|\d{1,2}(?:st|nd|rd|th)?|\d{1,2})/g;
      const termNums = [];
      let match;
      while ((match = workTermPattern.exec(lower))) {
        const num = wordToNumber(match[1]);
        if (Number.isFinite(num)) termNums.push(num);
      }

      if (termNums.length > 0) {
        const hasMinCue = /(at least|minimum|or above|and above|or higher|\+)/.test(lower);
        const hasOnlyCue = /\bonly\b/.test(lower);
        if (hasMinCue) {
          const nextMin = Math.min(...termNums);
          minWorkTerm = minWorkTerm == null ? nextMin : Math.max(minWorkTerm, nextMin);
          notes.push(s);
        } else if (hasOnlyCue || /\beligible\b/.test(lower)) {
          termNums.forEach((n) => allowedWorkTerms.add(n));
          notes.push(s);
        }
      }

      // Academic year constraints
      if (/\bupper[- ]?year\b/.test(lower)) {
        minAcademicYear = minAcademicYear == null ? 3 : Math.max(minAcademicYear, 3);
        notes.push(s);
      }

      const yearPattern = /(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|\d{1,2}(?:st|nd|rd|th)?|\d{1,2})\s*[- ]?year/g;
      while ((match = yearPattern.exec(lower))) {
        const year = wordToNumber(match[1]);
        if (!Number.isFinite(year)) continue;
        minAcademicYear = minAcademicYear == null ? year : Math.max(minAcademicYear, year);
        notes.push(s);
      }
    });

    return {
      minWorkTerm,
      allowedWorkTerms: Array.from(allowedWorkTerms).sort((a, b) => a - b),
      minAcademicYear,
      requirementLines: ns.unique(notes).slice(0, 6)
    };
  }

  function detectTermSignals(lowerText) {
    const text = String(lowerText || "");

    const fourMonthMention =
      /(?:^|[^0-9])4\s*[- ]?month(?:s)?\b|four\s*[- ]?month(?:s)?\b|(?:^|[^0-9])1\s*work\s*terms?\b|one\s*work\s*terms?\b/.test(text);
    const eightMonthMention = /(?:^|[^0-9])8\s*[- ]?month(?:s)?\b|eight\s*[- ]?month(?:s)?\b|(?:^|[^0-9])2\s*work\s*terms?\b|two\s*work\s*terms?\b/.test(text);

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

  function extractWorkTermDurationValue(postingRoot, fullText) {
    const rootText = String((postingRoot && postingRoot.textContent) || "");
    const sources = [rootText, String(fullText || "")];

    for (const source of sources) {
      if (!source) continue;
      const inline = source.match(/work\s*term\s*duration\s*:\s*([^\n\r]+)/i);
      if (inline && inline[1]) {
        const value = ns.normalizeText(inline[1]);
        if (value) return value;
      }

      const multiline = source.match(/work\s*term\s*duration\s*:\s*\n+\s*([^\n\r]+)/i);
      if (multiline && multiline[1]) {
        const value = ns.normalizeText(multiline[1]);
        if (value) return value;
      }
    }

    return null;
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

    const requiredSentencesByKeyword = sentences.filter((s) => sentenceHasKeyword(s, requiredKeywords));
    const preferredSentencesByKeyword = sentences.filter((s) => sentenceHasKeyword(s, preferredKeywords));
    const implicitRequiredSentences = getImplicitSkillSentences(sentences, "required");
    const implicitPreferredSentences = getImplicitSkillSentences(sentences, "preferred");
    const sectionSkillBullets = extractSkillBulletsFromHeadingSections(postingRoot);

    const requiredSentences = ns.unique([
      ...requiredSentencesByKeyword,
      ...implicitRequiredSentences,
      ...sectionSkillBullets
    ]);
    const requiredSet = new Set(requiredSentences);
    const preferredSentences = ns
      .unique([...preferredSentencesByKeyword, ...implicitPreferredSentences])
      .filter((line) => !requiredSet.has(line));

    const requiredSkills = extractSkillsFromSentences(requiredSentences);
    const preferredSkills = extractSkillsFromSentences(preferredSentences).filter((skill) => !requiredSkills.includes(skill));

    const lowerText = fullText.toLowerCase();

    const termSignals = detectTermSignals(lowerText);
    const workTermDurationValue = extractWorkTermDurationValue(postingRoot, fullText);

    if (workTermDurationValue) {
      const durationSignals = detectTermSignals(String(workTermDurationValue).toLowerCase());
      if (durationSignals.fourMonthMention && !durationSignals.eightMonthMention) {
        termSignals.acceptsFourMonth = true;
        termSignals.acceptsEightMonth = false;
        termSignals.fourMonthRequired = true;
        termSignals.eightMonthRequired = false;
      } else if (durationSignals.eightMonthMention && !durationSignals.fourMonthMention) {
        termSignals.acceptsFourMonth = false;
        termSignals.acceptsEightMonth = true;
        termSignals.fourMonthRequired = false;
        termSignals.eightMonthRequired = true;
      } else if (durationSignals.fourMonthMention && durationSignals.eightMonthMention) {
        termSignals.acceptsFourMonth = true;
        termSignals.acceptsEightMonth = true;
      }
    }

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

    const hardEligibility = extractHardEligibilityRequirements(sentences);

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
      workTermDurationValue,
      coverLetterRequired,
      coverLetterRecommended,
      transcriptRequired,
      gpaRequirement,
      firstYearCompletion,
      termRestriction,
      minWorkTerm: hardEligibility.minWorkTerm,
      allowedWorkTerms: hardEligibility.allowedWorkTerms,
      minAcademicYear: hardEligibility.minAcademicYear,
      eligibilityRequirementLines: hardEligibility.requirementLines,
      mastersRequired,
      phdRequired,
      graduateOnly
    };

    return {
      requiredSkills,
      preferredSkills,
      constraints,
      summaryBullets,
      extractionMeta: {
        requiredSentenceCount: requiredSentences.length,
        preferredSentenceCount: preferredSentences.length,
        sectionSkillBulletCount: sectionSkillBullets.length
      },
      fullText
    };
  };
})(globalThis);
