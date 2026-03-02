(function initListingsPage(global) {
  const ns = (global.WWP = global.WWP || {});
  if (ns.__WWP_LISTINGS_RAN) return;
  ns.__WWP_LISTINGS_RAN = true;

  function ensureInlineStyles() {
    if (document.getElementById("wwp-inline-row-style")) return;
    const style = document.createElement("style");
    style.id = "wwp-inline-row-style";
    style.textContent = `
      .wwp-row-selected { box-shadow: inset 0 0 0 2px #2563eb; }
      .wwp-row-hidden-by-smart-search { display: none !important; }
      .wwp-row-hidden-by-term-filter { display: none !important; }
      .wwp-row-hidden-by-hard-filter { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function normalizeUrl(href) {
    try {
      return new URL(href, location.origin).href;
    } catch (_error) {
      return null;
    }
  }

  function isAllowedJobUrl(url) {
    return typeof ns.isWaterlooWorksUrl === "function" ? ns.isWaterlooWorksUrl(url) : false;
  }

  function isSupportedCoopListingsPage() {
    const pathname = String(location.pathname || "").toLowerCase();
    if (!pathname.includes("/myaccount/co-op/")) return false;

    if (/\/myaccount\/co-op\/(direct|fullcycle|full-cycle)\/jobs\.htm/.test(pathname)) {
      return true;
    }

    if (/\/myaccount\/co-op\/.*jobs/.test(pathname)) {
      return true;
    }

    const bodyText = String(document.body ? document.body.textContent : "").toLowerCase();
    const hasJobTable = !!document.querySelector("table tr td");
    if (hasJobTable && /(job search|job title|organization|openings)/.test(bodyText)) {
      return true;
    }

    return false;
  }

  function hasSidebarAncestor(node) {
    if (!node || typeof node.closest !== "function") return false;
    const sidebar = node.closest("nav, aside, [role='navigation'], .sidebar, .left-nav, .menu, .navbar");
    return !!sidebar;
  }

  function hasNavLikeClass(node) {
    const classBlob = String((node && node.className) || "").toLowerCase();
    return /(nav|menu|sidebar|breadcrumb|header|footer)/.test(classBlob);
  }

  function rowHasJobSignals(row, anchor, href, text) {
    if (!row || !anchor) return false;
    if (hasSidebarAncestor(row) || hasSidebarAncestor(anchor)) return false;
    if (hasNavLikeClass(row)) return false;

    const clean = String(text || "").toLowerCase();
    if (clean.length < 20) return false;
    if (/sign out|logout|help|profile|setting|calendar|my account/.test(clean)) return false;

    const h = String(href || "").toLowerCase();
    const title = ns.getTextFromElement(anchor).toLowerCase();
    const tdCount = row.querySelectorAll("td").length;

    const hrefSignal = /jobid|postingid|\/posting\/|\/job\/|myaccount\/co-op\/direct\/jobs|jobs\.htm/.test(h);
    const titleSignal = /(intern|co-op|coop|developer|engineer|analyst|scientist|assistant|manager|design|software|data|qa|test|research|product)/.test(title);
    const contextSignal = /(deadline|employer|location|work term|position|job title)/.test(clean);
    const tableLikeRow = tdCount >= 3 && title.length >= 4;

    if (tdCount >= 3 && (hrefSignal || titleSignal)) return true;
    if (hrefSignal && contextSignal) return true;
    if (contextSignal && titleSignal) return true;
    if (tableLikeRow && !/home|dashboard|profile|setting|calendar|contact|faq/.test(title)) return true;

    return false;
  }

  function isLikelyNavLinkText(text) {
    const t = String(text || "").trim().toLowerCase();
    return /^(home|dashboard|profile|settings?|help|logout|sign out|contact|about|support|calendar)$/.test(t);
  }

  function isLikelyNonJobPath(url) {
    try {
      const parsed = new URL(url, location.origin);
      const p = parsed.pathname.toLowerCase();
      return /(help|support|faq|about|privacy|terms|contact|search-jobs\/waterlooworks-program-cluster-mapping)/.test(p);
    } catch (_error) {
      return false;
    }
  }

  function cleanNoiseText(text) {
    return String(text || "")
      .replace(/\b(create_new_folder|do_not_disturb|play_arrow|play|pause|expand_more|expand_less|keyboard_arrow_down|keyboard_arrow_right|check_box|check_box_outline_blank|radio_button_unchecked)\b/gi, " ")
      .replace(/[_|]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isMeaningfulTitleText(text) {
    const t = cleanNoiseText(text);
    if (!t || t.length < 4) return false;
    if (isLikelyNavLinkText(t)) return false;
    if (/^[a-z_0-9-]{1,24}$/i.test(t)) return false;
    if (!/[a-z]{3,}/i.test(t)) return false;
    return true;
  }

  function extractTitleFromRow(row, anchor) {
    const anchorText = anchor ? ns.getTextFromElement(anchor) : "";
    if (isMeaningfulTitleText(anchorText)) {
      return cleanNoiseText(anchorText);
    }

    const cells = Array.from(row.querySelectorAll("td"));
    const cellTexts = cells
      .map((cell) => cleanNoiseText(ns.getTextFromElement(cell)))
      .filter((text) => isMeaningfulTitleText(text));

    const ranked = cellTexts.sort((a, b) => b.length - a.length);
    return ranked[0] || "";
  }

  function extractUrlCandidatesFromString(value) {
    const text = String(value || "");
    if (!text) return [];

    const out = [];
    const regex = /https?:\/\/[^\s"'`<>()]+|(?:\/|\.\/)?[A-Za-z0-9/_\-.%]+(?:\.htm|\.html)(?:\?[^\s"'`<>()]*)?/gi;
    let m;
    while ((m = regex.exec(text))) {
      out.push(m[0]);
    }
    return out;
  }

  function isLikelyPostingUrl(url) {
    try {
      const parsed = new URL(url, location.origin);
      if (!isAllowedJobUrl(parsed.href) || isLikelyNonJobPath(parsed.href)) return false;

      const p = parsed.pathname.toLowerCase();
      const q = parsed.search.toLowerCase();

      if (/jobid|postingid|positionid|opportunityid/.test(q)) return true;
      if (/\/posting\/|\/job\//.test(p)) return true;
      if (/\/myaccount\/co-op\/direct\/jobs\.htm/.test(p) && /[?&](job|posting|position|id)=/.test(q)) return true;
      if (/\/myaccount\/co-op\/direct\/jobs\.htm/.test(p) && q.length > 1 && !/[?&](page|sort|order|filter|tab)=/.test(q)) return true;
      return false;
    } catch (_error) {
      return false;
    }
  }

  function extractPostingUrlFromRow(row, anchor) {
    const values = [];

    if (anchor) {
      const href = anchor.getAttribute("href");
      if (href) values.push(href);
    }

    row.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (href) values.push(href);
    });

    [row, ...Array.from(row.querySelectorAll("[onclick], [data-url], [data-href], [data-link], [ondblclick]"))].forEach((el) => {
      ["onclick", "ondblclick", "data-url", "data-href", "data-link"].forEach((attr) => {
        const value = el.getAttribute(attr);
        if (value) {
          values.push(value);
          values.push(...extractUrlCandidatesFromString(value));
        }
      });
    });

    for (const raw of values) {
      const absolute = normalizeUrl(raw);
      if (!absolute) continue;
      if (!isLikelyPostingUrl(absolute)) continue;
      return absolute;
    }

    return null;
  }

  function collectRowCandidates() {
    const rows = Array.from(document.querySelectorAll("tr"));
    const out = [];

    rows.forEach((row, index) => {
      if (hasSidebarAncestor(row) || hasNavLikeClass(row)) return;

      const tdCount = row.querySelectorAll("td").length;
      if (tdCount < 3) return;

      const rowText = cleanNoiseText(ns.getTextFromElement(row));
      if (!rowText || rowText.length < 24) return;
      if (/sign out|logout|settings|profile|student help|about co-op/.test(rowText.toLowerCase())) return;

      const anchor = row.querySelector("a[href]");
      const title = extractTitleFromRow(row, anchor);
      if (!title) return;

      const postingUrl = extractPostingUrlFromRow(row, anchor);

      out.push({
        row,
        anchor,
        title,
        postingUrl,
        rowIndex: index
      });
    });

    return out;
  }

  function collectRelaxedCandidates(anchors) {
    const out = [];
    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const absoluteHref = normalizeUrl(href);
      if (!absoluteHref || !isAllowedJobUrl(absoluteHref)) continue;
      if (isLikelyNonJobPath(absoluteHref)) continue;

      const row = anchor.closest("tr, .job-row, .posting-row, .job-listing-item, li, [role='row'], .row") || anchor.parentElement;
      if (!row) continue;
      if (hasSidebarAncestor(row) || hasSidebarAncestor(anchor)) continue;
      if (hasNavLikeClass(row)) continue;

      const title = ns.getTextFromElement(anchor);
      if (!title || title.length < 3 || title.length > 220) continue;
      if (isLikelyNavLinkText(title)) continue;

      const rowText = ns.getTextFromElement(row);
      if (rowText.length < 18) continue;
      if (/sign out|logout|profile|settings|help center|student help/.test(rowText.toLowerCase())) continue;

      const tdCount = row.querySelectorAll("td").length;
      const wordCount = title.split(/\s+/).filter(Boolean).length;
      const rowSignals = /(deadline|employer|location|work term|job title|position)/i.test(rowText);
      if (tdCount < 2 && wordCount < 2 && !rowSignals) continue;

      out.push({ row, anchor, title });
    }
    return out;
  }

  function inferCompany(row) {
    const selectors = [
      ".company",
      "[data-company]",
      "td:nth-child(2)",
      ".employer",
      ".organization"
    ];
    for (const selector of selectors) {
      const node = row.querySelector(selector);
      const text = ns.getTextFromElement(node);
      if (text && text.length < 80) return text;
    }
    return "Unknown company";
  }

  function inferLocation(row) {
    const selectors = [".location", "[data-location]", "td:nth-child(3)"];
    for (const selector of selectors) {
      const node = row.querySelector(selector);
      const text = ns.getTextFromElement(node);
      if (text && text.length < 80) return text;
    }
    return "";
  }

  function inferSnippet(row) {
    const selectors = [".description", ".snippet", "td:nth-child(4)"];
    for (const selector of selectors) {
      const node = row.querySelector(selector);
      const text = ns.getTextFromElement(node);
      if (text && text.length > 15) return text.slice(0, 300);
    }
    return ns.getTextFromElement(row).slice(0, 300);
  }

  function rankCandidateContainers(candidates) {
    const groups = new Map();

    for (const item of candidates) {
      const container = item.row.parentElement;
      if (!container || container === document.body || container === document.documentElement) continue;
      if (!groups.has(container)) groups.set(container, []);
      groups.get(container).push(item);
    }

    let bestContainer = null;
    let bestScore = -1;

    groups.forEach((items, container) => {
      const combined = items.map((x) => ns.getTextFromElement(x.row).toLowerCase()).join(" ");
      const keywordScore = (combined.match(/deadline|employer|location|work term|job title|position/g) || []).length;
      const tableBoost = /table|tbody|tbod|datagrid|grid|list/i.test(String(container.tagName || "")) ? 12 : 0;
      const score = items.length * 10 + Math.min(30, keywordScore) + tableBoost;
      if (score > bestScore) {
        bestScore = score;
        bestContainer = container;
      }
    });

    return {
      container: bestContainer,
      grouped: groups
    };
  }

  function findJobRows() {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    const strictCandidates = [];

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const absoluteHref = normalizeUrl(href);
      if (!absoluteHref || !isAllowedJobUrl(absoluteHref)) continue;
      if (isLikelyNonJobPath(absoluteHref)) continue;

      const row = anchor.closest("tr, .job-row, .posting-row, .job-listing-item, li, [role='row'], .row") || anchor.parentElement;
      if (!row) continue;

      const title = ns.getTextFromElement(anchor);
      if (!title || title.length < 3 || title.length > 220) continue;
      if (isLikelyNavLinkText(title)) continue;

      const context = ns.getTextFromElement(row).slice(0, 600);
      if (!rowHasJobSignals(row, anchor, href, context)) continue;

      strictCandidates.push({ row, anchor, title });
    }

    let candidates = strictCandidates;
    if (candidates.length < 4) {
      const relaxed = collectRelaxedCandidates(anchors);
      if (relaxed.length > candidates.length) {
        candidates = relaxed;
      }
    }

    if (!candidates.length) {
      const rowCandidates = collectRowCandidates();
      if (rowCandidates.length) {
        candidates = rowCandidates.map((x) => ({ row: x.row, anchor: x.anchor, title: x.title, rowIndex: x.rowIndex, postingUrl: x.postingUrl }));
      }
    }

    if (!candidates.length) {
      return { jobs: [], container: null };
    }

    const ranked = rankCandidateContainers(candidates);
    const scoped = ranked.container ? ranked.grouped.get(ranked.container) || [] : candidates;

    const byUrl = new Map();
    scoped.forEach((item, scopedIndex) => {
      const hrefFromAnchor = item.anchor ? normalizeUrl(item.anchor.getAttribute("href")) : null;
      const postingUrl = item.postingUrl || (hrefFromAnchor && isLikelyPostingUrl(hrefFromAnchor) ? hrefFromAnchor : null);
      const key = postingUrl || `row-${item.rowIndex != null ? item.rowIndex : scopedIndex}`;

      if (!byUrl.has(key)) {
        byUrl.set(key, {
          row: item.row,
          anchor: item.anchor,
          title: item.title,
          url: postingUrl,
          key,
          company: inferCompany(item.row),
          location: inferLocation(item.row),
          snippet: inferSnippet(item.row)
        });
      }
    });

    return {
      jobs: Array.from(byUrl.values()),
      container: ranked.container
    };
  }

  async function waitForJobRows(panel, maxAttempts, waitMs) {
    let result = { jobs: [], container: null };
    const attempts = Number.isFinite(maxAttempts) ? maxAttempts : 30;
    const delay = Number.isFinite(waitMs) ? waitMs : 650;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      result = findJobRows();
      if (result.jobs.length > 0) return result;
      if (panel) {
        panel.setSubtitle(`Waiting for listings data (${attempt + 1}/${attempts})...`);
      }
      await ns.wait(delay);
    }
    return result;
  }

  function annotateRow(job, analysis) {
    const row = job.row;
    row.querySelectorAll(":scope .wwp-row-badges, :scope .wwp-row-skills").forEach((node) => node.remove());
    row.dataset.wwpJobKey = job.key || "";
    row.__wwpEntry = analysis;
  }

  function reorderRows(scoredJobs, targetContainer) {
    if (!targetContainer) return;
    const eligible = scoredJobs.filter((item) => item.job.row.parentElement === targetContainer);
    const sorted = eligible.sort((a, b) => b.rankingScore - a.rankingScore);
    for (const item of sorted) {
      targetContainer.appendChild(item.job.row);
    }
  }

  function estimateTermCompatibilityFromConstraints(constraints, workTerm) {
    const term = Number(workTerm || 1);
    if (!constraints) return 50;
    if (constraints.termRestriction) {
      const text = constraints.termRestriction.toLowerCase();
      const matches = text.match(/\d+/g) || [];
      if (matches.length && !matches.map(Number).includes(term)) {
        return 20;
      }
    }
    if (constraints.firstYearCompletion && term <= 2) return 85;
    if (constraints.firstYearCompletion && term > 2) return 45;
    return 60;
  }

  function evaluatePreferredTermEligibility(constraints, preferredTermLength) {
    const pref = String(preferredTermLength || "4");
    const c = constraints || {};
    const acceptsFourRaw = c.acceptsFourMonth;
    const acceptsEightRaw = c.acceptsEightMonth;
    const acceptsFour = acceptsFourRaw === true;
    const acceptsEight = acceptsEightRaw === true;
    const rejectsFour = acceptsFourRaw === false;
    const rejectsEight = acceptsEightRaw === false;
    const requiresFour = c.fourMonthRequired === true;
    const requiresEight = c.eightMonthRequired === true;
    const explicitFourOnly = requiresFour || (acceptsFour && rejectsEight) || c.workTermLength === 4;
    const explicitEightOnly = requiresEight || (acceptsEight && rejectsFour) || c.workTermLength === 8;

    if (pref === "either") {
      return { eligible: true, reason: "Either term length accepted by user preference." };
    }

    if (pref === "4") {
      if (explicitEightOnly) {
        return { eligible: false, reason: "Posting appears to be 8-month only." };
      }
      if (acceptsFour || c.workTermLength === 4) {
        if (c.eightMonthPreferred && acceptsFour) {
          return { eligible: true, reason: "8-month preferred but still accepts 4-month terms." };
        }
        return { eligible: true, reason: "Posting accepts 4-month term." };
      }
      // WaterlooWorks postings often omit explicit duration and default to one work term (4 months).
      // Treat unknown duration as eligible unless the posting explicitly contradicts 4-month.
      return { eligible: true, reason: "No explicit duration found; keeping posting unless it contradicts 4-month." };
    }

    if (pref === "8") {
      if (explicitFourOnly) {
        return { eligible: false, reason: "Posting appears to be 4-month only." };
      }
      if (acceptsEight || c.workTermLength === 8) {
        if (c.fourMonthPreferred && acceptsEight) {
          return { eligible: true, reason: "4-month preferred but still accepts 8-month terms." };
        }
        return { eligible: true, reason: "Posting accepts 8-month term." };
      }
      return { eligible: false, reason: "Posting does not indicate 8-month eligibility." };
    }

    return { eligible: true, reason: "No strict term preference selected." };
  }

  function applyStrictPreferredTermFilter(entries, preferredTermLength) {
    const pref = String(preferredTermLength || "4");
    const out = [];
    let hiddenCount = 0;

    entries.forEach((entry) => {
      const decision = evaluatePreferredTermEligibility(entry.parsed && entry.parsed.constraints, pref);
      entry.termEligibility = decision;
      const hideRow = pref !== "either" && !decision.eligible;

      if (entry.job && entry.job.row) {
        entry.job.row.classList.toggle("wwp-row-hidden-by-term-filter", hideRow);
      }

      if (hideRow) {
        hiddenCount += 1;
      } else {
        out.push(entry);
      }
    });

    return {
      filtered: out,
      hiddenCount
    };
  }

  function applyHardDisqualifierFilter(entries) {
    const out = [];
    let hiddenCount = 0;

    entries.forEach((entry) => {
      const hideRow = !!entry.hardDisqualifier;
      if (entry.job && entry.job.row) {
        entry.job.row.classList.toggle("wwp-row-hidden-by-hard-filter", hideRow);
      }
      if (hideRow) hiddenCount += 1;
      else out.push(entry);
    });

    return {
      filtered: out,
      hiddenCount
    };
  }

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findSkillEntry(key) {
    return (ns.SKILLS_DICTIONARY || []).find((item) => item.key === key) || null;
  }

  function computeResumeTextMatch(resumeSkills, text, targetRole) {
    const normalizedText = String(text || "").toLowerCase();
    const entries = Array.from((resumeSkills || new Map()).entries())
      .map(([skill]) => String(skill || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 120);

    if (!entries.length || !normalizedText) return 0;

    let totalCount = 0;
    let matchedCount = 0;

    for (const skill of entries) {
      totalCount += 1;

      const entry = findSkillEntry(skill);
      const aliases = entry && Array.isArray(entry.aliases) ? [skill, ...entry.aliases] : [skill];

      let hits = 0;
      for (const alias of aliases) {
        const token = ns.normalizeToken(alias);
        if (!token) continue;
        const rx = new RegExp(`\\b${escapeRegex(token)}\\b`, "g");
        const count = (normalizedText.match(rx) || []).length;
        hits += count;
      }

      if (hits > 0) matchedCount += 1;
    }

    if (totalCount <= 0) return 0;
    let score = (matchedCount / totalCount) * 100;

    const role = String(targetRole || "").trim().toLowerCase();
    if (role && normalizedText.includes(role)) {
      score = Math.max(score, 35);
    }

    if (/(software|developer|engineer|analyst|data|ml|qa|test|product)/.test(normalizedText)) {
      score = Math.max(score, 22);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function computeBlendedSkillMatch(baseSkillMatch, keywordSkillMatch, parsed) {
    const base = ns.clamp(Number(baseSkillMatch) || 0, 0, 100);
    const keyword = ns.clamp(Number(keywordSkillMatch) || 0, 0, 100);
    const requiredCount = Array.isArray(parsed && parsed.requiredSkills) ? parsed.requiredSkills.length : 0;
    const preferredCount = Array.isArray(parsed && parsed.preferredSkills) ? parsed.preferredSkills.length : 0;
    const extractionMeta = (parsed && parsed.extractionMeta) || {};
    const sectionBullets = Number(extractionMeta.sectionSkillBulletCount) || 0;
    const structuredSignals = requiredCount + preferredCount;

    let blended = 0;
    if (structuredSignals >= 6 || (requiredCount >= 4 && sectionBullets >= 3)) {
      blended = Math.round(base * 0.88 + keyword * 0.12);
    } else if (structuredSignals >= 3) {
      blended = Math.round(base * 0.78 + keyword * 0.22);
    } else {
      blended = Math.round(base * 0.55 + keyword * 0.45);
    }

    if (base >= 75) {
      blended = Math.max(blended, Math.round(base * 0.94));
    } else if (base >= 60) {
      blended = Math.max(blended, Math.round(base * 0.88));
    } else if (base >= 45) {
      blended = Math.max(blended, Math.round(base * 0.82));
    }

    if (base <= 6 && keyword > 0) {
      blended = Math.max(blended, Math.round(keyword * 0.8));
    }

    return ns.clamp(blended, 0, 100);
  }

  async function analyzeJobs(jobs, settings, panel) {
    let resumeSkills = ns.getResumeSkillMap(settings);
    if ((!resumeSkills || resumeSkills.size === 0) && settings && typeof settings.resumeRawText === "string" && settings.resumeRawText.trim()) {
      const parsedResume = ns.parseResume(settings.resumeRawText);
      resumeSkills = parsedResume.skills || new Map();
    }

    const results = await ns.runWithConcurrency(jobs, 3, async (job, index) => {
      if (index > 0) {
        await ns.wait(120);
      }

      let parsed = null;

      if (job.url) {
        const cached = await ns.getCachedJobAnalysis(job.url);
        parsed = cached || null;

        if (!parsed) {
          try {
            const html = await ns.fetchJobHtml(job.url);
            parsed = ns.parseJobPosting(html);
            await ns.setCachedJobAnalysis(job.url, parsed);
          } catch (_error) {
            parsed = null;
          }
        }
      }

      if (!parsed) {
        // Fallback: analyze using visible row content only when posting fetch is unavailable.
        parsed = ns.parseJobPosting(job.snippet || ns.getTextFromElement(job.row));
      }

      const analysisText = [job.title, job.company, job.location, job.snippet, parsed.fullText.slice(0, 2500)].join(" ");
      const baseSkillMatch = ns.computeSkillMatch(resumeSkills, parsed.requiredSkills, parsed.preferredSkills, parsed.fullText);
      const keywordSkillMatch = computeResumeTextMatch(resumeSkills, analysisText, settings.preferences.targetRole);

      const skillMatch = computeBlendedSkillMatch(baseSkillMatch, keywordSkillMatch, parsed);

      const termCompatibility = estimateTermCompatibilityFromConstraints(parsed.constraints, settings.preferences.workTerm);
      const facultyAlignment = 50;
      const viability = ns.computeViabilityScore(skillMatch, termCompatibility, facultyAlignment, 0);

      const combinedText = [job.title, job.company, job.location, job.snippet, parsed.fullText.slice(0, 1200)].join(" ");
      const roleBoost = ns.scoreRolePreference(combinedText, settings.preferences.targetRole);
      const industryBoost = ns.scoreIndustryPreference(combinedText, settings.preferences.industries);
      const termLengthBoost = ns.scoreTermLengthPreference(parsed.constraints, settings.preferences.preferredTermLength);

      const rankingScore =
        skillMatch * 0.62 +
        viability.score * 0.28 +
        roleBoost +
        industryBoost +
        termLengthBoost;

      const flags = ns.getConstraintFlagLabels(parsed.constraints);
      const hard = ns.detectHardDisqualifier(parsed.constraints, settings);
      const rec = ns.recommendAction(viability.score, {
        eightMonthPreferred: !!parsed.constraints.eightMonthPreferred,
        userTermLength: settings.preferences.preferredTermLength,
        highSkillMatch: skillMatch >= 70,
        lowSkillMatch: skillMatch < 45,
        hardDisqualifier: hard.doNotApply,
        hardReasons: hard.reasons
      });

      if (panel) {
        panel.setSubtitle(`Analyzed ${index + 1} / ${jobs.length} postings`);
      }

      const adjustedRankingScore = hard.doNotApply ? Math.max(0, rankingScore - 60) : rankingScore;

      return {
        job,
        parsed,
        skillMatch,
        baseSkillMatch,
        keywordSkillMatch,
        viability,
        rankingScore: adjustedRankingScore,
        requiredSkills: parsed.requiredSkills,
        flags,
        recommendation: rec,
        hardDisqualifier: hard.doNotApply,
        hardReasons: hard.reasons
      };
    });

    return results.filter((item) => item && !item.error);
  }

  function openJobEntry(entry) {
    if (!entry || !entry.job) return false;

    if (entry.job.url) {
      location.href = entry.job.url;
      return true;
    }

    if (entry.job.anchor) {
      const rawHref = String(entry.job.anchor.getAttribute("href") || "").trim();
      const lowerHref = rawHref.toLowerCase();
      const isJavascriptHref = lowerHref.startsWith("javascript:");
      const isHashHref = lowerHref === "#";

      // Avoid CSP violations from javascript: links in WaterlooWorks tables.
      if (rawHref && !isJavascriptHref && !isHashHref) {
        const absolute = normalizeUrl(rawHref);
        if (absolute) {
          location.href = absolute;
          return true;
        }
      }

      if (isJavascriptHref) {
        // Let site handlers open the posting while blocking javascript: default navigation.
        const blockDefault = (event) => {
          event.preventDefault();
        };
        entry.job.anchor.addEventListener("click", blockDefault, { capture: true, once: true });
        try {
          entry.job.anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
          return true;
        } catch (_error) {
          // fall through to row click
        }
      } else {
        try {
          entry.job.anchor.click();
          return true;
        } catch (_error) {
          // fall through to row click
        }
      }
    }

    if (entry.job.row) {
      entry.job.row.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      return true;
    }

    return false;
  }

  const ROLE_QUERY_SYNONYMS = {
    "software engineer": ["swe", "software developer", "developer", "engineering", "programmer", "backend", "frontend", "full stack"],
    "software developer": ["software engineer", "developer", "swe", "backend", "frontend", "full stack"],
    "data analyst": ["business analyst", "analytics", "sql", "tableau", "power bi", "data"],
    "data engineer": ["etl", "data pipeline", "data engineering", "spark", "sql", "backend"],
    "data scientist": ["machine learning", "ml", "ai", "statistics", "python", "data"],
    "product manager": ["product management", "pm", "strategy", "roadmap", "stakeholder"],
    "qa": ["quality assurance", "testing", "automation", "test engineer", "sdet"],
    "security": ["cybersecurity", "infosec", "security analyst", "application security"]
  };

  function getSiteKeywordQuery() {
    const selectors = [
      "input[placeholder*='Keyword']",
      "input[aria-label*='Keyword']",
      "input[name*='keyword']",
      "input[id*='keyword']",
      "input[name='q']"
    ];

    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node && typeof node.value === "string" ? node.value.trim() : "";
      if (value) return value;
    }
    return "";
  }

  function normalizeSearchWord(value) {
    return ns.simpleStem(ns.normalizeToken(value || ""));
  }

  function tokenizeSearchWords(value) {
    return ns
      .tokenize(String(value || ""))
      .map((token) => normalizeSearchWord(token))
      .filter((token) => token && token.length >= 2);
  }

  function getQueryPhrases(query) {
    const raw = String(query || "").trim().toLowerCase();
    if (!raw) return [];

    const phrases = [];
    const quoted = raw.match(/"([^"]{2,})"/g) || [];
    quoted.forEach((phrase) => {
      const clean = phrase.replace(/^"|"$/g, "").trim();
      if (clean) phrases.push(clean);
    });

    const stripped = raw.replace(/"[^"]{2,}"/g, " ").replace(/\s+/g, " ").trim();
    if (stripped.split(" ").length >= 2) {
      phrases.push(stripped);
    }

    return ns.unique(phrases.map((x) => x.trim()).filter(Boolean));
  }

  function expandQueryTerms(query, settings) {
    const queryText = String(query || "").trim().toLowerCase();
    const baseTokens = new Set(tokenizeSearchWords(queryText));
    const phrases = getQueryPhrases(queryText);

    const phraseSet = new Set(ns.unique(phrases));
    const seededWords = new Set([...baseTokens, ...tokenizeSearchWords(Array.from(phraseSet).join(" "))]);

    Array.from(seededWords).forEach((word) => {
      const skillEntry = (ns.SKILLS_DICTIONARY || []).find((entry) => {
        const keyWord = normalizeSearchWord(entry.key);
        if (keyWord === word) return true;
        return (entry.aliases || []).some((alias) => normalizeSearchWord(alias) === word);
      });
      if (!skillEntry) return;

      tokenizeSearchWords(skillEntry.key).forEach((token) => baseTokens.add(token));
      (skillEntry.aliases || []).forEach((alias) => tokenizeSearchWords(alias).forEach((token) => baseTokens.add(token)));
    });

    const phraseBlob = queryText.toLowerCase();
    Object.entries(ROLE_QUERY_SYNONYMS).forEach(([needle, synonyms]) => {
      if (!phraseBlob.includes(needle)) return;
      tokenizeSearchWords(needle).forEach((token) => baseTokens.add(token));
      synonyms.forEach((item) => {
        tokenizeSearchWords(item).forEach((token) => baseTokens.add(token));
        if (item.split(/\s+/).length >= 2) phraseSet.add(item);
      });
    });

    return {
      hasQuery: queryText.length > 0,
      queryText,
      tokens: Array.from(baseTokens),
      phrases: Array.from(phraseSet)
    };
  }

  function ensureEntrySearchIndex(entry) {
    if (entry.__wwpSearchIndex) return entry.__wwpSearchIndex;

    const requiredSkills = (entry.requiredSkills || []).join(" ");
    const preferredSkills = (entry.parsed && entry.parsed.preferredSkills ? entry.parsed.preferredSkills : []).join(" ");
    const combined = [entry.job.title, entry.job.company, entry.job.location, entry.job.snippet, requiredSkills, preferredSkills, entry.parsed.fullText.slice(0, 5000)]
      .join(" ")
      .toLowerCase();
    const titleLower = String(entry.job.title || "").toLowerCase();
    const titleTokenSet = new Set(tokenizeSearchWords(titleLower));
    const tokenSet = new Set(tokenizeSearchWords(combined));
    const requiredTokenSet = new Set(tokenizeSearchWords(`${requiredSkills} ${preferredSkills}`));

    const index = {
      combined,
      titleLower,
      titleTokenSet,
      tokenSet,
      requiredTokenSet
    };

    entry.__wwpSearchIndex = index;
    return index;
  }

  function computeSmartQuerySignal(entry, queryCtx) {
    const index = ensureEntrySearchIndex(entry);
    const hasQuery = queryCtx && queryCtx.hasQuery;
    if (!hasQuery) {
      return {
        raw: entry.rankingScore * 1.2 + entry.skillMatch * 0.45 + entry.viability.score * 0.25,
        hits: 0,
        titleHits: 0,
        requiredHits: 0
      };
    }

    let raw = entry.skillMatch * 0.42 + entry.viability.score * 0.28 + entry.rankingScore * 0.18;
    let hits = 0;
    let titleHits = 0;
    let requiredHits = 0;

    for (const phrase of queryCtx.phrases || []) {
      const cleanPhrase = String(phrase || "").trim().toLowerCase();
      if (!cleanPhrase) continue;
      if (index.titleLower.includes(cleanPhrase)) {
        raw += 30;
        titleHits += 1;
        hits += 2;
      } else if (index.combined.includes(cleanPhrase)) {
        raw += 14;
        hits += 1;
      }
    }

    for (const token of queryCtx.tokens || []) {
      const word = normalizeSearchWord(token);
      if (!word) continue;

      const titleMatch = index.titleTokenSet.has(word) || index.titleLower.includes(word);
      const requiredMatch = index.requiredTokenSet.has(word);
      const fullMatch = index.tokenSet.has(word) || index.combined.includes(word);

      if (titleMatch) {
        raw += 11;
        titleHits += 1;
        hits += 1;
      }
      if (requiredMatch) {
        raw += 9;
        requiredHits += 1;
        hits += 1;
      }
      if (!titleMatch && !requiredMatch && fullMatch) {
        raw += 5;
        hits += 1;
      }
    }

    if (hits === 0) {
      raw -= 90;
    }

    return {
      raw,
      hits,
      titleHits,
      requiredHits
    };
  }

  function computeSmartSearchResults(scoredJobs, query, settings) {
    const queryCtx = expandQueryTerms(query, settings);
    const prelim = scoredJobs.map((entry) => {
      const signal = computeSmartQuerySignal(entry, queryCtx);
      return {
        entry,
        raw: signal.raw,
        hits: signal.hits,
        titleHits: signal.titleHits,
        requiredHits: signal.requiredHits
      };
    });

    const values = prelim.map((item) => item.raw);
    const min = Math.min(...values);
    const max = Math.max(...values);

    const normalized = prelim.map((item) => {
      let smartScore = 50;
      if (max > min) {
        smartScore = Math.round(((item.raw - min) / (max - min)) * 100);
      } else if (queryCtx.hasQuery && item.hits > 0) {
        smartScore = 70;
      } else if (queryCtx.hasQuery) {
        smartScore = 20;
      }

      return {
        entry: item.entry,
        smartScore: ns.clamp(smartScore, 0, 100),
        hits: item.hits,
        titleHits: item.titleHits,
        requiredHits: item.requiredHits
      };
    });

    normalized.sort((a, b) => {
      if (b.smartScore !== a.smartScore) return b.smartScore - a.smartScore;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return b.entry.rankingScore - a.entry.rankingScore;
    });

    return {
      queryCtx,
      results: normalized
    };
  }

  function applySmartSearchLayout(scoredJobs, rankedResults, targetContainer, hideUnmatched) {
    const allEntries = scoredJobs.slice();
    const rankedEntries = rankedResults.map((item) => item.entry);
    const rankedSet = new Set(rankedEntries);

    if (targetContainer) {
      const inContainerRanked = rankedEntries.filter((entry) => entry.job.row && entry.job.row.parentElement === targetContainer);
      const inContainerUnranked = allEntries.filter(
        (entry) => !rankedSet.has(entry) && entry.job.row && entry.job.row.parentElement === targetContainer
      );
      inContainerRanked.concat(inContainerUnranked).forEach((entry) => targetContainer.appendChild(entry.job.row));
    }

    allEntries.forEach((entry) => {
      const row = entry.job.row;
      if (!row) return;
      const isMatched = rankedSet.has(entry);
      row.classList.toggle("wwp-row-hidden-by-smart-search", !!hideUnmatched && !isMatched);
    });
  }

  function buildSmartSearchCard(scoredJobs, settings, panel, targetContainer, onSelectEntry) {
    const card = ns.makeCard("Smart Search");

    const note = document.createElement("p");
    note.className = "wwp-inline-note";
    note.textContent = "Search by role or skills. Results are ranked by your resume match, constraints, and preference signals.";
    card.appendChild(note);

    const inputRow = document.createElement("div");
    inputRow.className = "wwp-input-row";
    const queryInput = document.createElement("input");
    queryInput.type = "text";
    queryInput.className = "wwp-input";
    queryInput.placeholder = 'Try: "software engineer", data analyst, backend, react';
    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className = "wwp-button";
    runBtn.textContent = "Search";
    inputRow.append(queryInput, runBtn);
    card.appendChild(inputRow);

    const actionRow = document.createElement("div");
    actionRow.className = "wwp-inline-actions";

    const targetRoleBtn = document.createElement("button");
    targetRoleBtn.type = "button";
    targetRoleBtn.className = "wwp-button";
    targetRoleBtn.textContent = "Use My Target Role";

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "wwp-button";
    clearBtn.textContent = "Clear";

    const hideToggleWrap = document.createElement("label");
    hideToggleWrap.className = "wwp-check";
    const hideToggle = document.createElement("input");
    hideToggle.type = "checkbox";
    hideToggle.checked = false;
    const hideToggleText = document.createElement("span");
    hideToggleText.textContent = "Only show matched rows";
    hideToggleWrap.append(hideToggle, hideToggleText);

    actionRow.append(targetRoleBtn, clearBtn, hideToggleWrap);
    card.appendChild(actionRow);

    const status = document.createElement("p");
    status.className = "wwp-inline-note";
    card.appendChild(status);

    const resultsWrap = document.createElement("div");
    resultsWrap.className = "wwp-search-results";
    card.appendChild(resultsWrap);
    let queryModeActive = false;

    function renderResults(displayResults, queryCtx) {
      resultsWrap.innerHTML = "";
      const list = displayResults.slice(0, 35);
      if (!list.length) {
        const empty = document.createElement("p");
        empty.className = "wwp-inline-note";
        empty.textContent = queryCtx.hasQuery
          ? "No strong matches on this loaded page. Try broader terms or disable WaterlooWorks filters."
          : "Type a role or skill to run smart search.";
        resultsWrap.appendChild(empty);
        return;
      }

      list.forEach((item, idx) => {
        const entry = item.entry;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wwp-search-item";

        const titleLine = document.createElement("div");
        titleLine.textContent = `${idx + 1}. ${entry.job.title}`;
        const metaLine = document.createElement("div");
        metaLine.className = "meta";
        metaLine.textContent = `${entry.job.company || "Unknown"} | Smart ${item.smartScore}% | Skill ${entry.skillMatch}% | Viability ${entry.viability.score}%`;

        button.append(titleLine, metaLine);
        button.addEventListener("click", () => {
          if (typeof onSelectEntry === "function") onSelectEntry(entry);
          openJobEntry(entry);
        });

        resultsWrap.appendChild(button);
      });
    }

    function runSearch(options) {
      const opts = options || {};
      if (opts.activateQuery === true) {
        queryModeActive = true;
      }
      const query = queryModeActive ? queryInput.value.trim() : "";
      const computed = computeSmartSearchResults(scoredJobs, query, settings);
      const baseResults = computed.results;
      const shouldFilter = !!hideToggle.checked && computed.queryCtx.hasQuery;

      const displayResults = shouldFilter
        ? baseResults.filter((item) => item.hits > 0 && item.smartScore >= 15)
        : baseResults;
      const activeFilter = shouldFilter && displayResults.length > 0;
      const layoutResults = activeFilter ? displayResults : baseResults;
      applySmartSearchLayout(scoredJobs, layoutResults, targetContainer, activeFilter);

      const shown = displayResults.length;
      const total = scoredJobs.length;
      if (computed.queryCtx.hasQuery) {
        if (activeFilter) {
          status.textContent = `Showing ${shown} / ${total} jobs for "${query}".`;
        } else if (shouldFilter && shown === 0) {
          status.textContent = `No strong matches for "${query}" on this page. Showing baseline ranking instead.`;
        } else {
          status.textContent = `Smart-ranked ${total} jobs for "${query}" (rows not filtered).`;
        }
      } else {
        status.textContent = `Showing ranked baseline across ${total} jobs. Enter a query for targeted matches.`;
      }

      if (panel && typeof panel.setSubtitle === "function") {
        if (computed.queryCtx.hasQuery) {
          panel.setSubtitle(activeFilter ? `Smart search: ${shown} matches` : `Smart search: ${shown} strong matches`);
        } else {
          panel.setSubtitle(`Ranked ${total} jobs`);
        }
      }

      renderResults(displayResults, computed.queryCtx);
    }

    queryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch({ activateQuery: true });
      }
    });
    runBtn.addEventListener("click", () => runSearch({ activateQuery: true }));
    hideToggle.addEventListener("change", () => runSearch());

    targetRoleBtn.addEventListener("click", () => {
      queryInput.value = String(settings.preferences.targetRole || "").trim();
      runSearch({ activateQuery: true });
    });

    clearBtn.addEventListener("click", () => {
      queryModeActive = false;
      queryInput.value = "";
      runSearch();
    });

    const initialQuery = getSiteKeywordQuery() || String(settings.preferences.targetRole || "").trim();
    if (initialQuery) {
      queryInput.value = initialQuery;
    }
    runSearch();

    return card;
  }

  function buildTopRankingsCard(scoredJobs, handlers) {
    const onSelect = handlers && typeof handlers.onSelect === "function" ? handlers.onSelect : null;
    const card = ns.makeCard("Top Ranked Jobs");
    const list = document.createElement("ul");
    list.className = "wwp-list";

    scoredJobs
      .slice()
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, 10)
      .forEach((entry, index) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${index + 1}. ${entry.job.title} @ ${entry.job.company} | Skill ${entry.skillMatch}% | Viability ${entry.viability.score}%`;
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.style.border = "1px solid #334155";
        btn.style.background = "#0b1220";
        btn.style.color = "#dbeafe";
        btn.style.borderRadius = "8px";
        btn.style.padding = "8px";
        btn.style.cursor = "pointer";
        btn.style.font = "inherit";
        btn.addEventListener("click", () => {
          if (onSelect) onSelect(entry);
          openJobEntry(entry);
        });
        btn.addEventListener("mouseover", () => {
          btn.style.borderColor = "#60a5fa";
        });
        btn.addEventListener("mouseout", () => {
          btn.style.borderColor = "#334155";
        });
        li.appendChild(btn);
        list.appendChild(li);
      });

    card.appendChild(list);
    return card;
  }

  function buildSelectedJobCard(entry, settings) {
    const card = ns.makeCard("Selected Job Fit");
    const title = document.createElement("p");
    title.style.margin = "0 0 6px";
    title.style.fontWeight = "700";
    title.textContent = `${entry.job.title} @ ${entry.job.company || "Unknown company"}`;

    const metrics = document.createElement("div");
    metrics.appendChild(ns.makeProgressMetric("Skill Match", entry.skillMatch));
    metrics.appendChild(ns.makeProgressMetric("Viability", entry.viability.score));
    metrics.appendChild(ns.makeProgressMetric("Keyword Match", entry.keywordSkillMatch || 0));

    let fitLabel = "Low fit - likely skip";
    let tone = "danger";
    if (entry.hardDisqualifier) {
      fitLabel = "Do not apply - confirmed not a fit";
      tone = "danger";
    } else if (entry.viability.score >= 75) {
      fitLabel = "Strong fit - apply";
      tone = "good";
    } else if (entry.viability.score >= 60) {
      fitLabel = "Decent fit - apply selectively";
      tone = "good";
    } else if (entry.viability.score >= 45) {
      fitLabel = "Reach - apply if projects align strongly";
      tone = "warn";
    }

    const chips = document.createElement("div");
    chips.className = "wwp-chip-wrap";
    chips.appendChild(ns.makeChip(fitLabel, tone));
    (entry.flags || []).slice(0, 5).forEach((flag) => chips.appendChild(ns.makeChip(flag, "warn")));

    const rec = ns.makeCard("Why");
    const recList = document.createElement("ul");
    recList.className = "wwp-list";
    entry.recommendation.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      recList.appendChild(li);
    });

    const topSkills = (entry.requiredSkills || []).slice(0, 6);
    if (topSkills.length) {
      const li = document.createElement("li");
      li.textContent = `Key requirements: ${topSkills.join(", ")}`;
      recList.appendChild(li);
    }

    rec.appendChild(recList);

    const pref = document.createElement("p");
    pref.className = "wwp-inline-note";
    pref.textContent = `Your prefs: term ${settings.preferences.workTerm}, role ${settings.preferences.targetRole || "(not set)"}, length ${settings.preferences.preferredTermLength}. Skill score combines posting requirements + title/summary match.`;

    card.append(title, metrics, chips, pref);
    return { card, rec };
  }

  function wireSelectedJobInteraction(scoredJobs, tabs, settings, panel) {
    const selectedHost = document.createElement("div");
    tabs.appendToTab("selected", selectedHost);

    let selectedRow = null;
    const byKey = new Map();
    const byTitle = new Map();

    function normalizeTitleKey(text) {
      return String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    scoredJobs.forEach((entry) => {
      if (entry && entry.job) {
        if (entry.job.key) byKey.set(entry.job.key, entry);
        const titleKey = normalizeTitleKey(entry.job.title);
        if (titleKey) byTitle.set(titleKey, entry);
      }
    });

    function render(entry) {
      if (!entry) return;
      if (selectedRow) selectedRow.classList.remove("wwp-row-selected");
      selectedRow = entry.job.row;
      selectedRow.classList.add("wwp-row-selected");

      selectedHost.innerHTML = "";
      const blocks = buildSelectedJobCard(entry, settings);
      selectedHost.appendChild(blocks.card);
      selectedHost.appendChild(blocks.rec);
      tabs.activate("selected");
      if (panel && typeof panel.setSubtitle === "function") {
        panel.setSubtitle(`Selected: ${entry.job.title}`);
      }
    }

    const sorted = scoredJobs.slice().sort((a, b) => b.rankingScore - a.rankingScore);
    render(sorted[0] || scoredJobs[0]);

    scoredJobs.forEach((entry) => {
      const row = entry.job.row;
      if (!row) return;
      row.addEventListener(
        "click",
        () => {
          render(entry);
        },
        { passive: true }
      );
      if (entry.job.anchor) {
        entry.job.anchor.addEventListener(
          "click",
          () => {
            render(entry);
          },
          { passive: true }
        );
      }
    });

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const row = target.closest("tr");
        if (row && row.dataset && row.dataset.wwpJobKey && byKey.has(row.dataset.wwpJobKey)) {
          render(byKey.get(row.dataset.wwpJobKey));
          return;
        }

        const heading = target.closest("h1, h2, h3, .modal-title, .ui-dialog-title");
        if (heading) {
          const titleKey = normalizeTitleKey(heading.textContent || "");
          if (titleKey && byTitle.has(titleKey)) {
            render(byTitle.get(titleKey));
          }
        }
      },
      true
    );

    return {
      render
    };
  }

  function buildFlagsCard(scoredJobs, settings) {
    const card = ns.makeCard("Strategic Flags");
    const chips = document.createElement("div");
    chips.className = "wwp-chip-wrap";

    const freq = new Map();
    scoredJobs.forEach((entry) => {
      (entry.flags || []).forEach((flag) => {
        freq.set(flag, (freq.get(flag) || 0) + 1);
      });
    });

    Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([flag, count]) => {
        chips.appendChild(ns.makeChip(`${flag} (${count})`, "warn"));
      });

    if (!freq.size) {
      chips.appendChild(ns.makeChip("No major constraints detected across analyzed jobs", "good"));
    }

    const prefLine = document.createElement("p");
    prefLine.className = "wwp-inline-note";
    prefLine.textContent = `Preferences: term ${settings.preferences.workTerm}, role ${settings.preferences.targetRole || "(not set)"}, length ${settings.preferences.preferredTermLength}`;

    card.append(chips, prefLine);
    return card;
  }

  async function run() {
    const pageType = ns.detectPageType(document, location);
    if (pageType !== "listings") return;
    if (!isSupportedCoopListingsPage()) return;

    const gate = await ns.getSettingsForPage();
    if (gate.disabled) return;

    const panel = ns.createShadowPanel({
      id: "wwp-listings-panel",
      title: "WaterlooWorks+",
      subtitle: "Scanning listings...",
      width: 390,
      onDisablePage: () => ns.disableCurrentPage()
    });

    const tabs = ns.createTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "selected", label: "Selected Job" },
        { id: "search", label: "Smart Search" },
        { id: "rankings", label: "Rankings" },
        { id: "flags", label: "Flags" }
      ],
      "overview"
    );
    panel.body.appendChild(tabs.root);

    const found = await waitForJobRows(panel, 30, 650);
    const jobs = found.jobs;
    const container = found.container;

    if (!jobs.length) {
      const summaryCard = ns.makeCard("Status");
      summaryCard.innerHTML +=
        '<p class="wwp-inline-note">No job rows were detected in the main results container yet. Try toggling table filters or refreshing.</p>';
      tabs.appendToTab("overview", summaryCard);
      panel.setSubtitle("No listings detected");
      return;
    }

    ensureInlineStyles();

    const summaryCard = ns.makeCard("Status");
    summaryCard.innerHTML += `<p class="wwp-inline-note">Found ${jobs.length} co-op job rows in the primary results table. Re-ranking by resume, constraints, and preferences.</p>`;
    tabs.appendToTab("overview", summaryCard);

    const scoredJobs = await analyzeJobs(jobs, gate.settings, panel);
    if (!scoredJobs.length) {
      panel.setSubtitle("No analyzable postings found");
      return;
    }

    const termFiltered = applyStrictPreferredTermFilter(scoredJobs, gate.settings.preferences.preferredTermLength);
    const hardFiltered = applyHardDisqualifierFilter(termFiltered.filtered);
    const eligibleJobs = hardFiltered.filtered;

    if (!eligibleJobs.length) {
      const noneCard = ns.makeCard("Term-Length Filter");
      noneCard.innerHTML += `<p class="wwp-inline-note">No postings remain after strict filters (term-length + auto-reject eligibility rules).</p>`;
      noneCard.innerHTML += `<p class="wwp-inline-note">Try changing term-length to "Either" or updating work term / profile preferences.</p>`;
      tabs.appendToTab("overview", noneCard);
      panel.setSubtitle("No jobs after strict eligibility filters");
      return;
    }

    eligibleJobs.forEach((entry) => annotateRow(entry.job, entry));
    reorderRows(eligibleJobs, container);

    panel.setSubtitle(`Ranked ${eligibleJobs.length} jobs`);

    const top = eligibleJobs.slice().sort((a, b) => b.rankingScore - a.rankingScore)[0];
    const metrics = ns.makeCard("Top Job Score Breakdown");
    metrics.appendChild(ns.makeProgressMetric("Skill Match", top.skillMatch));
    metrics.appendChild(ns.makeProgressMetric("Viability", top.viability.score));
    metrics.appendChild(ns.makeProgressMetric("Ranking Score", Math.max(0, Math.min(100, top.rankingScore))));

    const rec = ns.makeCard("Top Recommendation");
    const recTitle = document.createElement("p");
    recTitle.style.margin = "0 0 6px";
    recTitle.style.fontWeight = "700";
    recTitle.textContent = top.recommendation.label;
    const recList = document.createElement("ul");
    recList.className = "wwp-list";
    top.recommendation.reasons.forEach((reason) => {
      const li = document.createElement("li");
      li.textContent = reason;
      recList.appendChild(li);
    });
    rec.append(recTitle, recList);

    const termFilterCard = ns.makeCard("Term-Length Filter");
    const prefLabel = gate.settings.preferences.preferredTermLength === "either" ? "Either" : `${gate.settings.preferences.preferredTermLength}-month`;
    termFilterCard.innerHTML += `<p class="wwp-inline-note">Preference: <strong>${prefLabel}</strong>. Showing ${eligibleJobs.length} of ${scoredJobs.length} analyzed rows.</p>`;
    if (termFiltered.hiddenCount > 0 && gate.settings.preferences.preferredTermLength !== "either") {
      termFilterCard.innerHTML += `<p class="wwp-inline-note">${termFiltered.hiddenCount} rows were hidden because they did not explicitly match your selected term-length rule.</p>`;
    }
    if (hardFiltered.hiddenCount > 0) {
      termFilterCard.innerHTML += `<p class="wwp-inline-note">${hardFiltered.hiddenCount} rows were auto-rejected due to hard eligibility constraints (e.g., Master's/PhD, work-term/year minimums).</p>`;
    }

    tabs.appendToTab("overview", termFilterCard);
    tabs.appendToTab("overview", metrics);
    tabs.appendToTab("overview", rec);
    const selection = wireSelectedJobInteraction(eligibleJobs, tabs, gate.settings, panel);
    tabs.appendToTab(
      "search",
      buildSmartSearchCard(
        eligibleJobs,
        gate.settings,
        panel,
        container,
        selection && selection.render ? selection.render : null
      )
    );
    tabs.appendToTab(
      "rankings",
      buildTopRankingsCard(eligibleJobs, {
        onSelect: selection && selection.render ? selection.render : null
      })
    );
    tabs.appendToTab("flags", buildFlagsCard(eligibleJobs, gate.settings));
  }

  run().catch((error) => {
    console.error("WaterlooWorks+ listings script failed", error);
  });
})(globalThis);
