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

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function findSkillEntry(key) {
    return (ns.SKILLS_DICTIONARY || []).find((item) => item.key === key) || null;
  }

  function computeResumeTextMatch(resumeSkills, text, targetRole) {
    const normalizedText = String(text || "").toLowerCase();
    const entries = Array.from((resumeSkills || new Map()).entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);

    if (!entries.length || !normalizedText) return 0;

    let totalWeight = 0;
    let matchedWeight = 0;

    for (const [skill, rawWeight] of entries) {
      const weight = Math.min(4, Math.max(0.4, Number(rawWeight) || 0.4));
      totalWeight += weight;

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

      if (hits > 0) {
        matchedWeight += weight * Math.min(1.2, 0.5 + hits * 0.3);
      }
    }

    if (totalWeight <= 0) return 0;
    let score = (matchedWeight / totalWeight) * 100;

    const role = String(targetRole || "").trim().toLowerCase();
    if (role && normalizedText.includes(role)) {
      score = Math.max(score, 35);
    }

    if (/(software|developer|engineer|analyst|data|ml|qa|test|product)/.test(normalizedText)) {
      score = Math.max(score, 22);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
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

      let skillMatch = Math.round(baseSkillMatch * 0.55 + keywordSkillMatch * 0.45);
      if (baseSkillMatch === 0 && keywordSkillMatch > 0) {
        skillMatch = keywordSkillMatch;
      }
      if (skillMatch < 20 && keywordSkillMatch >= 35) {
        skillMatch = Math.round((skillMatch + keywordSkillMatch) / 2);
      }
      skillMatch = Math.max(0, Math.min(100, skillMatch));

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
      const rec = ns.recommendAction(viability.score, {
        eightMonthPreferred: !!parsed.constraints.eightMonthPreferred,
        userTermLength: settings.preferences.preferredTermLength,
        highSkillMatch: skillMatch >= 70,
        lowSkillMatch: skillMatch < 45
      });

      if (panel) {
        panel.setSubtitle(`Analyzed ${index + 1} / ${jobs.length} postings`);
      }

      return {
        job,
        parsed,
        skillMatch,
        baseSkillMatch,
        keywordSkillMatch,
        viability,
        rankingScore,
        requiredSkills: parsed.requiredSkills,
        flags,
        recommendation: rec
      };
    });

    return results.filter((item) => item && !item.error);
  }

  function buildTopRankingsCard(scoredJobs) {
    const card = ns.makeCard("Top Ranked Jobs");
    const list = document.createElement("ul");
    list.className = "wwp-list";

    scoredJobs
      .slice()
      .sort((a, b) => b.rankingScore - a.rankingScore)
      .slice(0, 10)
      .forEach((entry, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${entry.job.title} @ ${entry.job.company} | Skill ${entry.skillMatch}% | Viability ${entry.viability.score}%`;
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
    if (entry.viability.score >= 75) {
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
      title: "WaterlooWorks+ Rankings",
      subtitle: "Scanning listings...",
      width: 390,
      onDisablePage: () => ns.disableCurrentPage()
    });

    const tabs = ns.createTabs(
      [
        { id: "overview", label: "Overview" },
        { id: "selected", label: "Selected Job" },
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

    scoredJobs.forEach((entry) => annotateRow(entry.job, entry));
    reorderRows(scoredJobs, container);

    panel.setSubtitle(`Ranked ${scoredJobs.length} jobs`);

    const top = scoredJobs.slice().sort((a, b) => b.rankingScore - a.rankingScore)[0];
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

    tabs.appendToTab("overview", metrics);
    tabs.appendToTab("overview", rec);
    tabs.appendToTab("rankings", buildTopRankingsCard(scoredJobs));
    tabs.appendToTab("flags", buildFlagsCard(scoredJobs, gate.settings));
    wireSelectedJobInteraction(scoredJobs, tabs, gate.settings, panel);
  }

  run().catch((error) => {
    console.error("WaterlooWorks+ listings script failed", error);
  });
})(globalThis);
