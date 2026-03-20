(function initListingsPage(global) {
  const ns = (global.WWP = global.WWP || {});
  const IS_BACKGROUND_PROBE_TAB = (() => {
    try {
      return new URLSearchParams(String(location.search || "")).get("wwp_probe") === "1";
    } catch (_error) {
      return false;
    }
  })();
  if (window !== window.top && window.name === "wwp-probe-frame") return;
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
      html.wwp-suppress-posting-ui .ui-dialog,
      html.wwp-suppress-posting-ui .ui-widget-overlay,
      html.wwp-suppress-posting-ui [role='dialog'],
      html.wwp-suppress-posting-ui .modal,
      html.wwp-suppress-posting-ui .modal-backdrop,
      html.wwp-suppress-posting-ui .modal-dialog,
      html.wwp-suppress-posting-ui .modal-content,
      html.wwp-suppress-posting-ui .ui-sidebar,
      html.wwp-suppress-posting-ui .ui-sidebar-mask,
      html.wwp-suppress-posting-ui .ui-dialog,
      html.wwp-suppress-posting-ui .ui-dialog-content,
      html.wwp-suppress-posting-ui .ui-widget-overlay,
      html.wwp-suppress-posting-ui .p-dialog,
      html.wwp-suppress-posting-ui .p-dialog-mask,
      html.wwp-suppress-posting-ui [id*='dialog'],
      html.wwp-suppress-posting-ui [class*='drawer'],
      html.wwp-suppress-posting-ui [class*='side-panel'] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
      }
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
    if (ns.wwDomAdapter && typeof ns.wwDomAdapter.isSupportedCoopListingsPage === "function") {
      return ns.wwDomAdapter.isSupportedCoopListingsPage(location, document);
    }
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

  function isActionAnchorText(text) {
    const t = cleanNoiseText(text).toLowerCase();
    if (!t) return true;
    return /(folder|print|apply|appl(y|ication)|rank|shortlist|not interested|viewed|deadline|new|delete|remove|save|share|map|compare)/.test(t);
  }

  function getAnchorDisplayText(anchor) {
    if (!(anchor instanceof Element)) return "";
    const text = cleanNoiseText(ns.getTextFromElement(anchor));
    if (text) return text;
    const aria = cleanNoiseText(anchor.getAttribute("aria-label") || anchor.getAttribute("title") || "");
    return aria;
  }

  function isLikelyTitleAnchor(anchor) {
    const text = getAnchorDisplayText(anchor);
    if (!text) return false;
    if (!isMeaningfulTitleText(text)) return false;
    if (isActionAnchorText(text)) return false;
    return true;
  }

  function pickPrimaryJobAnchor(row, titleHint) {
    if (!(row instanceof Element)) return null;
    const anchors = Array.from(row.querySelectorAll("a"));
    if (!anchors.length) return null;

    const titleNeedle = normalizeTitleKey(titleHint || "");
    let best = null;
    let bestScore = -Infinity;

    anchors.forEach((anchor) => {
      const text = getAnchorDisplayText(anchor);
      if (!text) return;

      let score = 0;
      if (isLikelyTitleAnchor(anchor)) score += 140;
      if (isMeaningfulTitleText(text)) score += 60;
      if (!isActionAnchorText(text)) score += 30;

      const href = String(anchor.getAttribute("href") || "").toLowerCase();
      if (/javascript:|#|job|posting|position/.test(href)) score += 12;
      if (/folder|print|rank|apply|notinterested|shortlist/.test(href)) score -= 60;

      const normalized = normalizeTitleKey(text);
      if (titleNeedle && normalized && titleNeedle.includes(normalized)) score += 90;
      if (titleNeedle && normalized && normalized.includes(titleNeedle)) score += 90;

      if (text.length >= 8) score += Math.min(25, Math.floor(text.length / 8));
      if (score > bestScore) {
        bestScore = score;
        best = anchor;
      }
    });

    return best;
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

  function extractJobIdFromRow(row) {
    if (!row) return "";
    const cells = Array.from(row.querySelectorAll("td"));
    for (const cell of cells) {
      const text = cleanNoiseText(ns.getTextFromElement(cell));
      if (/^\d{5,8}$/.test(text)) return text;
    }
    const rowText = cleanNoiseText(ns.getTextFromElement(row));
    const match = rowText.match(/\b\d{5,8}\b/);
    return match ? match[0] : "";
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
      if (/\/myaccount\/co-op\/.*jobs\.htm/.test(p) && /[?&](job|posting|position|id)=/.test(q)) return true;
      if (/\/myaccount\/co-op\/.*jobs\.htm/.test(p) && /[?&][a-z0-9_-]*(job|post|position|opportun|id)[a-z0-9_-]*=/.test(q)) {
        return true;
      }
      return false;
    } catch (_error) {
      return false;
    }
  }

  const POSTING_QUERY_PARAM_CANDIDATES = [
    "jobId",
    "postingId",
    "positionId",
    "opportunityId",
    "jobPostingId",
    "selectedJobId",
    "selectedPostingId",
    "posting",
    "position",
    "job",
    "id"
  ];
  const QUERY_PARAM_NOISE = /^(page|sort|order|filter|tab|viewed|new|deadline|offset|limit)$/i;
  const SUBMIT_LIKE_PARAM = /(event|action|command|submit|method|op|operation|target|source|trigger|execute|update|ajax|faces|viewstate|state|token)/i;
  const ID_LIKE_PARAM = /(job|post|position|opportun|record|detail|select|chosen|active|current|id)/i;

  function addUrlCandidate(list, seen, rawUrl) {
    const absolute = normalizeUrl(rawUrl);
    if (!absolute) return;
    if (!isAllowedJobUrl(absolute) || isLikelyNonJobPath(absolute)) return;
    if (!isLikelyPostingUrl(absolute)) return;
    if (seen.has(absolute)) return;
    seen.add(absolute);
    list.push(absolute);
  }

  function extractFunctionNamesFromJsSnippet(snippet) {
    const text = String(snippet || "");
    if (!text) return [];
    const names = new Set();
    const regex = /\b([A-Za-z_$][\w$]*)\s*\(/g;
    let match;
    while ((match = regex.exec(text))) {
      const name = match[1];
      if (!name) continue;
      if (/^(if|for|while|switch|return|function|catch|new|setTimeout|setInterval)$/.test(name)) continue;
      names.add(name);
      if (names.size >= 24) break;
    }
    return Array.from(names);
  }

  function collectContextStringsForJob(job) {
    const out = [];
    const seen = new Set();
    const push = (value) => {
      const text = String(value || "");
      if (!text.trim()) return;
      if (seen.has(text)) return;
      seen.add(text);
      out.push(text);
    };

    const nodes = [];
    if (job && job.row) nodes.push(job.row);
    if (job && job.anchor && job.anchor !== job.row) nodes.push(job.anchor);

    nodes.forEach((node) => {
      const scoped = [node, ...Array.from(node.querySelectorAll("a[href], [onclick], [ondblclick], [data-url], [data-href], [data-link], button"))];
      scoped.forEach((el) => {
        ["href", "onclick", "ondblclick", "data-url", "data-href", "data-link"].forEach((attr) => {
          const value = typeof el.getAttribute === "function" ? el.getAttribute(attr) : "";
          if (value) push(value);
        });
      });
    });

    const fnNames = new Set();
    out.forEach((text) => {
      extractFunctionNamesFromJsSnippet(text).forEach((name) => fnNames.add(name));
    });
    Array.from(fnNames)
      .slice(0, 16)
      .forEach((name) => {
        try {
          const fn = window[name];
          if (typeof fn === "function") {
            push(Function.prototype.toString.call(fn));
          }
        } catch (_error) {}
      });

    const jobId = String((job && job.jobId) || "");
    Array.from(document.querySelectorAll("script"))
      .slice(0, 30)
      .forEach((script) => {
        const text = String(script.textContent || "");
        if (!text) return;
        if (jobId && text.includes(jobId)) {
          push(text.slice(0, 6000));
          return;
        }
        if (/jobs\.htm|postingid|jobid|positionid|opportunityid/i.test(text)) {
          push(text.slice(0, 2400));
        }
      });

    return out.slice(0, 80);
  }

  function discoverParamNamesFromContext(contextStrings) {
    const byLower = new Map();
    POSTING_QUERY_PARAM_CANDIDATES.forEach((param) => byLower.set(String(param).toLowerCase(), param));

    const addName = (raw) => {
      const name = String(raw || "").replace(/['"`\s]/g, "");
      if (!name) return;
      if (QUERY_PARAM_NOISE.test(name)) return;
      if (!/(job|post|position|opportun|record|select|detail|id)/i.test(name)) return;
      const lower = name.toLowerCase();
      if (!byLower.has(lower)) byLower.set(lower, name);
    };

    (contextStrings || []).forEach((textRaw) => {
      const text = String(textRaw || "");
      if (!text) return;

      let match;
      const qsRegex = /[?&]([A-Za-z][\w-]{1,48})=/g;
      while ((match = qsRegex.exec(text))) {
        addName(match[1]);
      }

      const assignRegex = /([A-Za-z][\w-]{1,48})\s*[:=]\s*['"]?\d{5,8}\b/g;
      while ((match = assignRegex.exec(text))) {
        addName(match[1]);
      }

      const quotedRegex = /['"]([A-Za-z][\w-]{1,48})['"]\s*[:=]/g;
      while ((match = quotedRegex.exec(text))) {
        addName(match[1]);
      }
    });

    return Array.from(byLower.values());
  }

  function discoverBaseUrlsFromContext(contextStrings) {
    const urls = [];
    const seen = new Set();
    const pushUrl = (raw) => {
      const absolute = normalizeUrl(raw);
      if (!absolute) return;
      if (!isAllowedJobUrl(absolute) || isLikelyNonJobPath(absolute)) return;
      if (seen.has(absolute)) return;
      seen.add(absolute);
      urls.push(absolute);
    };

    (contextStrings || []).forEach((textRaw) => {
      const text = String(textRaw || "");
      if (!text) return;
      extractUrlCandidatesFromString(text).forEach((candidate) => pushUrl(candidate));

      const pathRegex = /\/myaccount\/co-op\/[a-z0-9/_-]*jobs\.htm/gi;
      let match;
      while ((match = pathRegex.exec(text))) {
        pushUrl(match[0]);
      }
    });

    return urls;
  }

  function addCandidateFromTemplate(list, seen, baseUrl, paramNames, jobId) {
    let parsed;
    try {
      parsed = new URL(String(baseUrl || ""), location.origin);
    } catch (_error) {
      return;
    }
    if (!isAllowedJobUrl(parsed.href) || isLikelyNonJobPath(parsed.href)) return;

    // Replace any existing numeric id-like query values first.
    const numericKeys = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      if (QUERY_PARAM_NOISE.test(key)) continue;
      if (/^\d{5,8}$/.test(String(value || "")) && /(job|post|position|opportun|id)/i.test(key)) {
        numericKeys.push(key);
      }
    }
    if (numericKeys.length) {
      numericKeys.forEach((key) => {
        const next = new URL(parsed.href);
        next.searchParams.set(key, jobId);
        addUrlCandidate(list, seen, next.href);
      });
    }

    paramNames.forEach((param) => {
      if (QUERY_PARAM_NOISE.test(param)) return;
      const next = new URL(parsed.href);
      next.searchParams.set(param, jobId);
      addUrlCandidate(list, seen, next.href);
    });
  }

  function buildPostingUrlCandidates(job, knownPostingUrls, contextStrings) {
    const candidates = [];
    const seen = new Set();
    const jobId = String((job && job.jobId) || "").trim();
    const maxCandidates = 8;

    if (job && job.url) {
      addUrlCandidate(candidates, seen, job.url);
    }

    if (!jobId) {
      return candidates;
    }

    const context = Array.isArray(contextStrings) ? contextStrings : [];
    const paramNames = discoverParamNamesFromContext(context);
    const contextUrls = discoverBaseUrlsFromContext(context);

    const pathCandidates = (() => {
      const currentPath = String(location.pathname || "");
      const roots = [currentPath];
      const directRoot = currentPath.replace(/\/jobs\.htm$/i, "");
      if (directRoot && directRoot !== currentPath) roots.push(directRoot);
      roots.push("/myAccount/co-op/direct");
      roots.push("/myAccount/co-op/fullcycle");
      roots.push("/myAccount/co-op/full-cycle");
      roots.push("/myAccount/co-op");

      const suffixes = [
        "/jobs.htm",
        "/job.htm",
        "/jobPosting.htm",
        "/job-posting.htm",
        "/posting.htm",
        "/postingDetails.htm",
        "/job-details.htm"
      ];

      const paths = [];
      roots.forEach((root) => {
        const normalizedRoot = String(root || "").replace(/\/+$/, "");
        suffixes.forEach((suffix) => {
          if (!normalizedRoot) {
            paths.push(suffix);
          } else if (normalizedRoot.toLowerCase().endsWith(".htm")) {
            paths.push(normalizedRoot);
          } else {
            paths.push(`${normalizedRoot}${suffix}`);
          }
        });
      });
      return ns.unique(paths);
    })();

    const baseUrls = ns.unique([
      location.href,
      new URL(location.pathname, location.origin).href,
      `${location.origin}/myAccount/co-op/direct/jobs.htm`,
      `${location.origin}/myAccount/co-op/fullcycle/jobs.htm`,
      `${location.origin}/myAccount/co-op/full-cycle/jobs.htm`,
      `${location.origin}/myAccount/co-op/jobs.htm`,
      ...pathCandidates.map((path) => `${location.origin}${path.startsWith("/") ? path : `/${path}`}`),
      ...((knownPostingUrls || []).filter(Boolean)),
      ...contextUrls
    ]);

    baseUrls.forEach((baseUrl) => {
      if (candidates.length >= maxCandidates) return;
      addCandidateFromTemplate(candidates, seen, baseUrl, paramNames, jobId);
    });

    return candidates.slice(0, maxCandidates);
  }

  function collectRowActionPayload(job) {
    const payload = {
      sourceIds: new Set(),
      eventTargets: new Set(),
      formHints: new Set(),
      raw: []
    };
    const seenRaw = new Set();

    const pushRaw = (value) => {
      const text = String(value || "");
      if (!text || seenRaw.has(text)) return;
      seenRaw.add(text);
      payload.raw.push(text);
    };

    const nodes = [];
    if (job && job.row) nodes.push(job.row);
    if (job && job.anchor && job.anchor !== job.row) nodes.push(job.anchor);
    nodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      const scoped = [node, ...Array.from(node.querySelectorAll("a,button,[onclick],[ondblclick],[data-url],[data-href],[data-link],[data-ri],[data-rk]"))];
      scoped.forEach((el) => {
        ["onclick", "ondblclick", "href", "data-url", "data-href", "data-link", "data-ri", "data-rk"].forEach((attr) => {
          const value = typeof el.getAttribute === "function" ? el.getAttribute(attr) : "";
          if (value) pushRaw(value);
        });
      });
    });

    const collectIdLikeTokens = (text) => {
      const tokenRegex = /[A-Za-z0-9_$:-]{6,}/g;
      let token;
      while ((token = tokenRegex.exec(text))) {
        const value = token[0];
        if (!value) continue;
        if (!/:/.test(value)) continue;
        if (/javascript|return|function|false|true|undefined|null/i.test(value)) continue;
        if (/^[0-9:._-]+$/.test(value)) continue;
        payload.sourceIds.add(value);
        payload.eventTargets.add(value);
      }
    };

    payload.raw.forEach((raw) => {
      const text = String(raw || "");
      if (!text) return;

      let match;
      const sourceRegexes = [
        /(?:\bs\b|source|javax\.faces\.source)\s*[:=]\s*['"]([^'"]{4,220})['"]/gi,
        /PrimeFaces\.ab\(\{[^}]*\bs\s*:\s*['"]([^'"]{4,220})['"]/gi,
        /myfaces\.ab\(\{[^}]*\bs\s*:\s*['"]([^'"]{4,220})['"]/gi,
        /A4J\.AJAX\.Submit\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]{4,220})['"]/gi
      ];
      sourceRegexes.forEach((rx) => {
        while ((match = rx.exec(text))) {
          payload.sourceIds.add(match[1]);
        }
      });

      const formRegexes = [
        /(?:\bf\b|form)\s*[:=]\s*['"]([^'"]{1,160})['"]/gi,
        /getElementById\(\s*['"]([^'"]{1,160})['"]\s*\)/gi
      ];
      formRegexes.forEach((rx) => {
        while ((match = rx.exec(text))) {
          payload.formHints.add(match[1]);
        }
      });

      const eventTargetRegexes = [/__doPostBack\(\s*['"]([^'"]{4,220})['"]\s*,/gi, /__EVENTTARGET\s*[:=]\s*['"]([^'"]{4,220})['"]/gi];
      eventTargetRegexes.forEach((rx) => {
        while ((match = rx.exec(text))) {
          payload.eventTargets.add(match[1]);
        }
      });

      collectIdLikeTokens(text);
    });

    if (job && job.anchor && typeof job.anchor.getAttribute === "function") {
      const idAttr = String(job.anchor.getAttribute("id") || "").trim();
      const nameAttr = String(job.anchor.getAttribute("name") || "").trim();
      if (idAttr) {
        payload.sourceIds.add(idAttr);
        payload.eventTargets.add(idAttr);
      }
      if (nameAttr) {
        payload.sourceIds.add(nameAttr);
        payload.eventTargets.add(nameAttr);
      }
    }

    return {
      sourceIds: Array.from(payload.sourceIds).slice(0, 20),
      eventTargets: Array.from(payload.eventTargets).slice(0, 20),
      formHints: Array.from(payload.formHints).slice(0, 12),
      raw: payload.raw.slice(0, 60)
    };
  }

  function decodeJsQuotedValue(rawValue) {
    const raw = String(rawValue || "");
    if (!raw) return "";
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === "'" && last === "'") || (first === '"' && last === '"')) {
      const body = raw.slice(1, -1);
      return body
        .replace(/\\\\/g, "\\")
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\t/g, "\t");
    }
    return raw;
  }

  function parsePrimeFacesAjaxConfigsFromText(textLike) {
    const text = String(textLike || "");
    if (!/(PrimeFaces|myfaces)\.ab\s*\(/i.test(text)) return [];

    const configs = [];
    const callRegex = /(?:PrimeFaces|myfaces)\.ab\(\s*\{([\s\S]*?)\}\s*\)/gi;
    let callMatch;
    while ((callMatch = callRegex.exec(text))) {
      const objectBody = String(callMatch[1] || "");
      if (!objectBody) continue;

      const cfg = {};
      const pairRegex = /([A-Za-z_$][\w$]*)\s*:\s*('(?:\\'|[^'])*'|"(?:\\"|[^"])*"|[A-Za-z0-9_:@.$-]+)/g;
      let pairMatch;
      while ((pairMatch = pairRegex.exec(objectBody))) {
        const key = String(pairMatch[1] || "").trim();
        const rawValue = String(pairMatch[2] || "").trim();
        if (!key || !rawValue) continue;
        cfg[key] = decodeJsQuotedValue(rawValue);
      }

      const source = String(cfg.s || cfg.source || "").trim();
      if (!source) continue;
      configs.push({
        source,
        form: String(cfg.f || cfg.form || "").trim(),
        process: String(cfg.p || cfg.process || cfg.e || "").trim(),
        update: String(cfg.u || cfg.update || "").trim(),
        event: String(cfg.event || "").trim()
      });
    }

    return configs;
  }

  function collectPrimeFacesAjaxConfigs(job) {
    if (!job) return [];
    const snippets = new Set();
    const addSnippet = (value) => {
      const text = String(value || "");
      if (!text.trim()) return;
      snippets.add(text);
    };

    const nodes = [];
    if (job.anchor instanceof Element) nodes.push(job.anchor);
    if (job.row instanceof Element) nodes.push(job.row);
    nodes.forEach((node) => {
      ["onclick", "ondblclick", "href", "data-url", "data-href", "data-link"].forEach((attr) => {
        try {
          const value = node.getAttribute(attr);
          if (value) addSnippet(value);
        } catch (_error) {}
      });
    });

    if (job.row instanceof Element) {
      Array.from(job.row.querySelectorAll("[onclick], [ondblclick], a[href]"))
        .slice(0, 24)
        .forEach((el) => {
          ["onclick", "ondblclick", "href"].forEach((attr) => {
            try {
              const value = el.getAttribute(attr);
              if (value) addSnippet(value);
            } catch (_error) {}
          });
        });
    }

    const out = [];
    const seen = new Set();
    snippets.forEach((snippet) => {
      parsePrimeFacesAjaxConfigsFromText(snippet).forEach((cfg) => {
        const key = JSON.stringify([cfg.source, cfg.form, cfg.process, cfg.update, cfg.event]);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(cfg);
      });
    });
    return out.slice(0, 20);
  }

  function lookupFormByHint(formHint) {
    const hint = String(formHint || "").trim();
    if (!hint) return null;
    const direct = document.getElementById(hint);
    if (direct instanceof HTMLFormElement) return direct;
    try {
      const named = document.forms.namedItem(hint);
      if (named instanceof HTMLFormElement) return named;
    } catch (_error) {}
    try {
      const escaped = window.CSS && typeof window.CSS.escape === "function" ? window.CSS.escape(hint) : hint.replace(/"/g, '\\"');
      const byName = document.querySelector(`form[name="${escaped}"]`);
      if (byName instanceof HTMLFormElement) return byName;
    } catch (_error) {}
    return null;
  }

  function resolveFormForPrimeFacesConfig(config, job, fallbackForms) {
    const forms = Array.isArray(fallbackForms) ? fallbackForms : Array.from(document.forms || []);
    const hinted = lookupFormByHint(config && config.form);
    if (hinted) return hinted;
    if (job && job.anchor && typeof job.anchor.closest === "function") {
      const fromAnchor = job.anchor.closest("form");
      if (fromAnchor instanceof HTMLFormElement) return fromAnchor;
    }
    if (job && job.row && typeof job.row.closest === "function") {
      const fromRow = job.row.closest("form");
      if (fromRow instanceof HTMLFormElement) return fromRow;
    }
    return forms[0] instanceof HTMLFormElement ? forms[0] : null;
  }

  function appendPrimeFacesExactCandidates(pushCandidate, job, paramNames, jobId) {
    const primeConfigs = collectPrimeFacesAjaxConfigs(job);
    if (!primeConfigs.length) return;
    const forms = Array.from(document.forms || []).slice(0, 24);

    primeConfigs.forEach((config) => {
      const form = resolveFormForPrimeFacesConfig(config, job, forms);
      if (!(form instanceof HTMLFormElement)) return;
      const actionRaw = form.getAttribute("action") || location.pathname || location.href;
      const action = normalizeUrl(actionRaw);
      if (!action || !isAllowedJobUrl(action) || isLikelyNonJobPath(action)) return;

      const sourceId = String(config.source || "").trim();
      if (!sourceId) return;
      const formId = String(config.form || form.getAttribute("id") || form.getAttribute("name") || "").trim();
      const execute = String(config.process || sourceId).trim() || sourceId;
      const render = String(config.update || "@all").trim() || "@all";
      const eventName = String(config.event || "click").trim();

      const hiddenPayload = getBaseHiddenFormPayload(form);
      const baseBodyPayload = {
        ...hiddenPayload,
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": sourceId,
        "javax.faces.partial.execute": execute,
        "javax.faces.partial.render": render,
        [sourceId]: sourceId
      };
      if (eventName) {
        baseBodyPayload["javax.faces.behavior.event"] = eventName;
        baseBodyPayload["javax.faces.partial.event"] = eventName;
      }
      if (formId) {
        baseBodyPayload[formId] = formId;
      }

      const idNames = ns
        .unique([
          ...Object.keys(baseBodyPayload).filter((name) => ID_LIKE_PARAM.test(name)),
          ...(Array.isArray(paramNames) ? paramNames.filter((name) => ID_LIKE_PARAM.test(name)) : [])
        ])
        .slice(0, 14);

      if (!idNames.length) {
        const body = new URLSearchParams(baseBodyPayload).toString();
        if (body && body.length < 22000) {
          pushCandidate({
            method: "POST",
            url: action,
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
              FacesRequest: "partial/ajax"
            },
            body,
            source: "primefaces-exact",
            matchConfidence: "high"
          });
        }
        return;
      }

      idNames.forEach((idName) => {
        const bodyPayload = { ...baseBodyPayload, [idName]: jobId };
        const body = new URLSearchParams(bodyPayload).toString();
        if (!body || body.length >= 22000) return;
        pushCandidate({
          method: "POST",
          url: action,
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            FacesRequest: "partial/ajax"
          },
          body,
          source: "primefaces-exact",
          matchConfidence: "high"
        });
      });
    });
  }

  function parseJsfcljsCallsFromText(textLike) {
    const text = String(textLike || "");
    if (!/jsfcljs\s*\(/i.test(text)) return [];
    const out = [];
    const callRegex =
      /jsfcljs\(\s*document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\s*,\s*\{([\s\S]*?)\}\s*,\s*['"]([^'"]*)['"]\s*\)/gi;
    let callMatch;
    while ((callMatch = callRegex.exec(text))) {
      const formId = String(callMatch[1] || "").trim();
      const paramsBody = String(callMatch[2] || "");
      const target = String(callMatch[3] || "").trim();
      if (!formId || !paramsBody) continue;

      const params = {};
      const pairRegex = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]*)['"]/g;
      let pairMatch;
      while ((pairMatch = pairRegex.exec(paramsBody))) {
        const k = String(pairMatch[1] || "").trim();
        const v = String(pairMatch[2] || "").trim();
        if (!k) continue;
        params[k] = v;
      }

      if (!Object.keys(params).length) continue;
      out.push({ formId, target, params });
    }
    return out;
  }

  function collectJsfcljsCalls(job) {
    if (!job) return [];
    const snippets = new Set();
    const addSnippet = (value) => {
      const text = String(value || "");
      if (!text.trim()) return;
      snippets.add(text);
    };

    const nodes = [];
    if (job.anchor instanceof Element) nodes.push(job.anchor);
    if (job.row instanceof Element) nodes.push(job.row);
    nodes.forEach((node) => {
      ["onclick", "ondblclick", "href"].forEach((attr) => {
        try {
          const value = node.getAttribute(attr);
          if (value) addSnippet(value);
        } catch (_error) {}
      });
    });

    if (job.row instanceof Element) {
      Array.from(job.row.querySelectorAll("[onclick], [ondblclick], a[href]"))
        .slice(0, 24)
        .forEach((el) => {
          ["onclick", "ondblclick", "href"].forEach((attr) => {
            try {
              const value = el.getAttribute(attr);
              if (value) addSnippet(value);
            } catch (_error) {}
          });
        });
    }

    const out = [];
    const seen = new Set();
    snippets.forEach((snippet) => {
      parseJsfcljsCallsFromText(snippet).forEach((call) => {
        const key = JSON.stringify([call.formId, call.target, call.params]);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(call);
      });
    });
    return out.slice(0, 20);
  }

  function appendJsfcljsExactCandidates(pushCandidate, job, paramNames, jobId) {
    const calls = collectJsfcljsCalls(job);
    if (!calls.length) return;

    calls.forEach((call) => {
      const form = lookupFormByHint(call.formId);
      if (!(form instanceof HTMLFormElement)) return;
      const actionRaw = form.getAttribute("action") || location.pathname || location.href;
      const action = normalizeUrl(actionRaw);
      if (!action || !isAllowedJobUrl(action) || isLikelyNonJobPath(action)) return;

      const hiddenPayload = getBaseHiddenFormPayload(form);
      const baseBodyPayload = { ...hiddenPayload, ...(call.params || {}) };

      const idNames = ns
        .unique([
          ...Object.keys(baseBodyPayload).filter((name) => ID_LIKE_PARAM.test(name)),
          ...(Array.isArray(paramNames) ? paramNames.filter((name) => ID_LIKE_PARAM.test(name)) : [])
        ])
        .slice(0, 14);

      if (!idNames.length) {
        const body = new URLSearchParams(baseBodyPayload).toString();
        if (body && body.length < 22000) {
          pushCandidate({
            method: "POST",
            url: action,
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body,
            source: "jsfcljs-exact",
            matchConfidence: "high"
          });
        }
        return;
      }

      idNames.forEach((idName) => {
        const bodyPayload = { ...baseBodyPayload, [idName]: jobId };
        const body = new URLSearchParams(bodyPayload).toString();
        if (!body || body.length >= 22000) return;
        pushCandidate({
          method: "POST",
          url: action,
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body,
          source: "jsfcljs-exact",
          matchConfidence: "high"
        });
      });
    });
  }

  function getBaseHiddenFormPayload(form) {
    const payload = {};
    if (!form) return payload;
    const elements = Array.from(form.elements || []);
    elements.forEach((el) => {
      if (!el || typeof el.name !== "string") return;
      const name = String(el.name || "").trim();
      if (!name || name.length > 180) return;
      const type = String(el.type || "").toLowerCase();
      if (/(file|button|submit|reset)/.test(type)) return;
      if ((type === "checkbox" || type === "radio") && !el.checked) return;

      const value = String(el.value == null ? "" : el.value);
      if (type === "hidden" || SUBMIT_LIKE_PARAM.test(name) || /viewstate|token|nonce|session|auth|csrf/i.test(name)) {
        payload[name] = value;
      }
    });
    return payload;
  }

  function appendJsfAjaxCandidates(out, pushCandidate, action, form, actionPayload, jobId) {
    const hiddenPayload = getBaseHiddenFormPayload(form);
    const sourceIds = actionPayload && Array.isArray(actionPayload.sourceIds) ? actionPayload.sourceIds : [];
    if (!sourceIds.length) return;
    const viewStateName = Object.keys(hiddenPayload).find((name) => /javax\.faces\.viewstate/i.test(name)) || "javax.faces.ViewState";
    const formId = String((form && (form.getAttribute("id") || form.getAttribute("name"))) || "").trim();

    sourceIds.slice(0, 10).forEach((sourceId) => {
      const bodyPayload = {
        ...hiddenPayload,
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": sourceId,
        "javax.faces.partial.execute": sourceId,
        "javax.faces.partial.render": "@all",
        [sourceId]: sourceId
      };
      if (formId) bodyPayload[formId] = formId;
      if (!bodyPayload[viewStateName] && hiddenPayload[viewStateName]) bodyPayload[viewStateName] = hiddenPayload[viewStateName];
      const idParam = Object.keys(bodyPayload).find((name) => ID_LIKE_PARAM.test(name));
      if (idParam) bodyPayload[idParam] = jobId;

      const body = new URLSearchParams(bodyPayload).toString();
      if (!body || body.length > 14000) return;
      pushCandidate({
        method: "POST",
        url: action,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          FacesRequest: "partial/ajax"
        },
        body
      });
    });
  }

  function appendAspNetPostbackCandidates(out, pushCandidate, action, form, actionPayload, jobId) {
    const hiddenPayload = getBaseHiddenFormPayload(form);
    const eventTargets = actionPayload && Array.isArray(actionPayload.eventTargets) ? actionPayload.eventTargets : [];
    if (!eventTargets.length) return;

    const hasViewState = Object.keys(hiddenPayload).some((name) => /__VIEWSTATE/i.test(name));
    if (!hasViewState) return;

    eventTargets.slice(0, 10).forEach((target) => {
      const bodyPayload = {
        ...hiddenPayload,
        __EVENTTARGET: target,
        __EVENTARGUMENT: ""
      };
      const idParam = Object.keys(bodyPayload).find((name) => ID_LIKE_PARAM.test(name));
      if (idParam) bodyPayload[idParam] = jobId;
      const body = new URLSearchParams(bodyPayload).toString();
      if (!body || body.length > 16000) return;
      pushCandidate({
        method: "POST",
        url: action,
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body
      });
    });
  }

  function buildFormRequestCandidates(job, contextStrings) {
    const jobId = String((job && job.jobId) || "").trim();
    if (!jobId) return [];

    const out = [];
    const seen = new Set();
    const paramNames = ns.unique([...POSTING_QUERY_PARAM_CANDIDATES, ...discoverParamNamesFromContext(contextStrings || [])]);
    const actionPayload = collectRowActionPayload(job || {});
    const forms = Array.from(document.forms || []).slice(0, 24);

    const pushCandidate = (candidate) => {
      const key = `${candidate.method}|${candidate.url}|${candidate.body || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(candidate);
    };

    appendPrimeFacesExactCandidates(pushCandidate, job, paramNames, jobId);
    appendJsfcljsExactCandidates(pushCandidate, job, paramNames, jobId);

    forms.forEach((form) => {
      const actionRaw = form.getAttribute("action") || location.pathname || location.href;
      const action = normalizeUrl(actionRaw);
      if (!action || !isAllowedJobUrl(action) || isLikelyNonJobPath(action)) return;
      if (!/\/myaccount\/co-op\/|jobs\.htm|posting|job/i.test(action.toLowerCase())) return;

      const payload = {};
      const elements = Array.from(form.elements || []);
      elements.forEach((el) => {
        if (!el || typeof el.name !== "string") return;
        const name = String(el.name || "").trim();
        if (!name || name.length > 120) return;
        if (QUERY_PARAM_NOISE.test(name)) return;
        const type = String(el.type || "").toLowerCase();
        if (/(file|button|submit|reset)/.test(type)) return;
        if ((type === "checkbox" || type === "radio") && !el.checked) return;

        if (type !== "hidden" && !SUBMIT_LIKE_PARAM.test(name) && !ID_LIKE_PARAM.test(name)) {
          return;
        }

        const value = String(el.value == null ? "" : el.value).trim();
        if (!value && type !== "hidden") return;
        payload[name] = value;
      });

      const idNames = ns.unique([
        ...Object.keys(payload).filter((name) => ID_LIKE_PARAM.test(name)),
        ...paramNames.filter((name) => ID_LIKE_PARAM.test(name))
      ]).slice(0, 10);

      appendJsfAjaxCandidates(out, pushCandidate, action, form, actionPayload, jobId);
      appendAspNetPostbackCandidates(out, pushCandidate, action, form, actionPayload, jobId);

      if (!idNames.length) return;

      idNames.forEach((idName) => {
        const bodyPayload = { ...payload, [idName]: jobId };
        const postBody = new URLSearchParams(bodyPayload).toString();
        if (postBody.length > 0 && postBody.length < 9000) {
          pushCandidate({
            method: "POST",
            url: action,
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: postBody
          });
        }

        const getUrl = new URL(action, location.origin);
        Object.entries(bodyPayload).forEach(([k, v]) => {
          if (typeof v === "string" && v.length <= 500) getUrl.searchParams.set(k, v);
        });
        pushCandidate({
          method: "GET",
          url: getUrl.href
        });
      });
    });

    return out.slice(0, 24);
  }

  function buildPostingRequestCandidates(job, knownPostingUrls, contextStrings) {
    const getCandidates = buildPostingUrlCandidates(job, knownPostingUrls, contextStrings).map((url) => ({ method: "GET", url }));
    const all = [...getCandidates, ...buildFormRequestCandidates(job, contextStrings)];
    const out = [];
    const seen = new Set();
    all.forEach((candidate) => {
      const method = String(candidate.method || "GET").toUpperCase();
      const url = String(candidate.url || "");
      const body = typeof candidate.body === "string" ? candidate.body : "";
      if (!url) return;
      const key = JSON.stringify([method, url, body]);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        method,
        url,
        body: body || undefined,
        headers: candidate.headers && typeof candidate.headers === "object" ? candidate.headers : undefined,
        source: candidate.source ? String(candidate.source) : undefined,
        matchConfidence: candidate.matchConfidence ? String(candidate.matchConfidence) : undefined
      });
    });
    return out.slice(0, 28);
  }

  function extractPostingUrlFromRow(row, anchor) {
    const values = [];
    const jobIdHint = extractJobIdFromRow(row);

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

    const scored = [];
    for (const raw of values) {
      const absolute = normalizeUrl(raw);
      if (!absolute) continue;
      if (!isLikelyPostingUrl(absolute)) continue;
      let score = 0;
      const low = absolute.toLowerCase();
      if (/jobid=|postingid=|positionid=|opportunityid=/.test(low)) score += 120;
      if (jobIdHint && low.includes(jobIdHint.toLowerCase())) score += 90;
      if (/\/posting\/|\/job\//.test(low)) score += 40;
      if (/folder|print|apply/.test(low)) score -= 80;
      scored.push({ url: absolute, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.length ? scored[0].url : null;
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

      const guessedAnchor = pickPrimaryJobAnchor(row, "");
      const title = extractTitleFromRow(row, guessedAnchor);
      if (!title) return;
      const anchor = pickPrimaryJobAnchor(row, title) || guessedAnchor || null;

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

      const title = getAnchorDisplayText(anchor);
      if (!title || title.length < 3 || title.length > 220) continue;
      if (isLikelyNavLinkText(title)) continue;
      if (!isLikelyTitleAnchor(anchor)) continue;

      const rowText = ns.getTextFromElement(row);
      if (rowText.length < 18) continue;
      if (/sign out|logout|profile|settings|help center|student help/.test(rowText.toLowerCase())) continue;

      const tdCount = row.querySelectorAll("td").length;
      const wordCount = title.split(/\s+/).filter(Boolean).length;
      const rowSignals = /(deadline|employer|location|work term|job title|position)/i.test(rowText);
      if (tdCount < 2 && wordCount < 2 && !rowSignals) continue;

      const primaryAnchor = pickPrimaryJobAnchor(row, title) || anchor;
      out.push({ row, anchor: primaryAnchor, title });
    }
    return out;
  }

  function inferCompany(row, title) {
    const selectors = [
      ".company",
      "[data-company]",
      ".employer",
      ".organization"
    ];
    for (const selector of selectors) {
      const node = row.querySelector(selector);
      const text = ns.getTextFromElement(node);
      if (text && text.length < 80 && !/^\d{5,8}$/.test(text)) return text;
    }

    const titleNorm = cleanNoiseText(title || "").toLowerCase();
    const cells = Array.from(row.querySelectorAll("td"))
      .map((cell) => cleanNoiseText(ns.getTextFromElement(cell)))
      .filter(Boolean);
    for (const text of cells) {
      const low = text.toLowerCase();
      if (text.length > 80) continue;
      if (/^\d{5,8}$/.test(text)) continue;
      if (titleNorm && low === titleNorm) continue;
      if (/(new|viewed|deadline|junior|intermediate|senior|in-person|remote|hybrid)/.test(low)) continue;
      if (/[a-z]{3,}/i.test(text)) return text;
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
    const anchors = Array.from(document.querySelectorAll("a"));
    const strictCandidates = [];

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href") || "";
      const hasHandler = anchor.hasAttribute("onclick") || anchor.hasAttribute("ondblclick");
      const isJsHref = /^javascript:/i.test(String(href).trim());
      if (!href && !hasHandler) continue;

      if (!isJsHref) {
        const absoluteHref = normalizeUrl(href);
        if (!absoluteHref || !isAllowedJobUrl(absoluteHref)) continue;
        if (isLikelyNonJobPath(absoluteHref)) continue;
      }

      const row = anchor.closest("tr, .job-row, .posting-row, .job-listing-item, li, [role='row'], .row") || anchor.parentElement;
      if (!row) continue;

      const title = getAnchorDisplayText(anchor);
      if (!title || title.length < 3 || title.length > 220) continue;
      if (isLikelyNavLinkText(title)) continue;
      if (!isLikelyTitleAnchor(anchor)) continue;

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
      const primaryAnchor = pickPrimaryJobAnchor(item.row, item.title) || item.anchor || null;
      const hrefFromAnchor = primaryAnchor ? normalizeUrl(primaryAnchor.getAttribute("href")) : null;
      const postingUrl = item.postingUrl || (hrefFromAnchor && isLikelyPostingUrl(hrefFromAnchor) ? hrefFromAnchor : null);
      const jobId = extractJobIdFromRow(item.row);
      const key = postingUrl || (jobId ? `id-${jobId}` : `row-${item.rowIndex != null ? item.rowIndex : scopedIndex}`);

      if (!byUrl.has(key)) {
        byUrl.set(key, {
          row: item.row,
          anchor: primaryAnchor,
          title: item.title,
          url: postingUrl,
          jobId,
          key,
          company: inferCompany(item.row, item.title),
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

  function clearAllRowAnnotations() {
    document.querySelectorAll("tr").forEach((row) => {
      row.classList.remove("wwp-row-selected", "wwp-row-hidden-by-smart-search", "wwp-row-hidden-by-term-filter", "wwp-row-hidden-by-hard-filter");
      if (row.dataset && row.dataset.wwpJobKey) {
        delete row.dataset.wwpJobKey;
      }
      if (row.__wwpEntry) {
        delete row.__wwpEntry;
      }
    });
  }

  function computeJobSetSignature(jobs) {
    if (!Array.isArray(jobs) || jobs.length === 0) return "";
    const parts = jobs.map((job) => {
      const title = cleanNoiseText(job && job.title ? job.title : "");
      const company = cleanNoiseText(job && job.company ? job.company : "");
      const location = cleanNoiseText(job && job.location ? job.location : "");
      const url = String((job && job.url) || "");
      const key = String((job && job.key) || "");
      return `${url}|${key}|${title}|${company}|${location}`;
    });
    parts.sort();
    return parts.join("||");
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

  function analyzeParsedJob(job, parsed, resumeSkills, settings) {
    const safeParsed = parsed || ns.parseJobPosting(job && job.snippet ? job.snippet : "");
    const fullText = String((safeParsed && safeParsed.fullText) || "");
    const analysisText = [job.title, job.company, job.location, job.snippet, fullText.slice(0, 2500)].join(" ");

    const baseSkillMatch = ns.computeSkillMatch(
      resumeSkills,
      safeParsed.requiredSkills,
      safeParsed.preferredSkills,
      fullText,
      {
        requiredLines: safeParsed.requiredSentences,
        preferredLines: safeParsed.preferredSentences
      }
    );
    const keywordSkillMatch = computeResumeTextMatch(resumeSkills, analysisText, settings.preferences.targetRole);
    const skillMatch = computeBlendedSkillMatch(baseSkillMatch, keywordSkillMatch, safeParsed);
    const targetRoleMatch = ns.computeTargetRoleMatch(job.title, analysisText, settings.preferences.targetRole);
    const fieldAlignment = ns.computeDegreeFieldAlignment(safeParsed.constraints, settings);

    const termCompatibility = estimateTermCompatibilityFromConstraints(safeParsed.constraints, settings.preferences.workTerm);
    const facultyAlignment = fieldAlignment.score;
    const viability = ns.computeViabilityScore(skillMatch, termCompatibility, facultyAlignment, 0);

    const combinedText = [job.title, job.company, job.location, job.snippet, fullText.slice(0, 1200)].join(" ");
    const roleBoost = ns.scoreRolePreference(combinedText, settings.preferences.targetRole);
    const industryBoost = ns.scoreIndustryPreference(combinedText, settings.preferences.industries);
    const termLengthBoost = ns.scoreTermLengthPreference(safeParsed.constraints, settings.preferences.preferredTermLength);

    let overallMatch = skillMatch * 0.55 + targetRoleMatch * 0.3 + viability.score * 0.15;
    if (fieldAlignment.preferredMismatch) overallMatch -= 8;
    if (fieldAlignment.requiredMismatch) overallMatch -= 38;
    if (targetRoleMatch < 30 && skillMatch < 50) overallMatch -= 12;
    overallMatch = ns.clamp(Math.round(overallMatch), 0, 100);

    const rankingScore = overallMatch * 0.72 + viability.score * 0.16 + roleBoost + industryBoost + termLengthBoost;
    const flags = ns.getConstraintFlagLabels(safeParsed.constraints);
    const hard = ns.detectHardDisqualifier(safeParsed.constraints, settings);
    const rec = ns.recommendAction(overallMatch, {
      eightMonthPreferred: !!safeParsed.constraints.eightMonthPreferred,
      userTermLength: settings.preferences.preferredTermLength,
      highSkillMatch: skillMatch >= 70,
      lowSkillMatch: skillMatch < 45,
      roleMismatch: targetRoleMatch < 45,
      fieldMismatchPreferred: fieldAlignment.preferredMismatch,
      fieldMismatchRequired: fieldAlignment.requiredMismatch,
      hardDisqualifier: hard.doNotApply,
      hardReasons: hard.reasons
    });

    return {
      parsed: safeParsed,
      skillMatch,
      baseSkillMatch,
      keywordSkillMatch,
      targetRoleMatch,
      overallMatch,
      fieldAlignment,
      viability,
      rankingScore: hard.doNotApply ? Math.max(0, rankingScore - 70) : rankingScore,
      requiredSkills: safeParsed.requiredSkills,
      flags,
      recommendation: rec,
      hardDisqualifier: hard.doNotApply,
      hardReasons: hard.reasons
    };
  }

  function isElementVisible(node) {
    if (!(node instanceof Element)) return false;
    const view = (node.ownerDocument && node.ownerDocument.defaultView) || window;
    const style = view.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= 0.02) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 40 && rect.height > 80;
  }

  function looksLikePostingContent(text) {
    const t = String(text || "").toLowerCase();
    if (!t || t.length < 220) return false;
    return /(skills and experience|required|preferred|job summary|job responsibilities|job posting information|application information|work term duration)/.test(
      t
    );
  }

  function normalizeTitleKey(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeFullPostingParsed(parsed, selectedTitle) {
    if (!parsed || typeof parsed !== "object") return false;
    const text = ns.normalizeText(parsed.fullText || "");
    if (!looksLikePostingContent(text)) return false;

    const reqCount = Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.length : 0;
    const prefCount = Array.isArray(parsed.preferredSkills) ? parsed.preferredSkills.length : 0;
    const constraintValue =
      parsed.constraints &&
      (parsed.constraints.workTermDurationValue ||
        parsed.constraints.coverLetterRequired ||
        parsed.constraints.transcriptRequired ||
        parsed.constraints.termRestriction ||
        (Array.isArray(parsed.constraints.requiredDegreeFields) && parsed.constraints.requiredDegreeFields.length > 0));
    if (reqCount + prefCount < 3 && !constraintValue && text.length < 1400) return false;

    const TITLE_STOPWORDS = new Set([
      "intern",
      "internship",
      "co",
      "coop",
      "student",
      "position",
      "role",
      "job",
      "junior",
      "senior",
      "assistant",
      "engineering",
      "developer",
      "software",
      "analyst"
    ]);

    const rawTitleTokens = normalizeTitleKey(selectedTitle)
      .split(" ")
      .filter((token) => token.length >= 4);
    const titleTokens = rawTitleTokens.filter((token) => !TITLE_STOPWORDS.has(token));
    const tokensForMatch = titleTokens.length ? titleTokens : rawTitleTokens;
    if (!tokensForMatch.length) return text.length >= 900;
    const lower = text.toLowerCase();
    const hitCount = tokensForMatch.filter((token) => lower.includes(token)).length;
    const minHits = tokensForMatch.length >= 4 ? 2 : 1;
    return hitCount >= minHits;
  }

  function parsedLikelyMatchesSelectedJob(parsed, job) {
    if (!job || !looksLikeFullPostingParsed(parsed, job.title)) return false;
    const fullText = ns.normalizeText((parsed && parsed.fullText) || "").toLowerCase();
    if (!fullText) return false;

    const jobId = String((job && job.jobId) || "").trim();
    if (jobId) {
      if (fullText.includes(jobId.toLowerCase())) {
        return true;
      }
      const numericIds = ns.unique((fullText.match(/\b\d{5,8}\b/g) || []).slice(0, 24));
      if (numericIds.length > 0 && !numericIds.includes(jobId)) {
        return false;
      }
    }

    const companyStopwords = new Set([
      "inc",
      "ltd",
      "corp",
      "corporation",
      "company",
      "division",
      "office",
      "solutions",
      "technologies",
      "technology",
      "services",
      "systems",
      "group",
      "university",
      "waterloo"
    ]);
    const companyTokens = normalizeTitleKey((job && job.company) || "")
      .split(" ")
      .filter((token) => token.length >= 4 && !companyStopwords.has(token));
    if (companyTokens.length) {
      const companyHits = companyTokens.filter((token) => fullText.includes(token)).length;
      if (companyHits === 0 && !jobId) {
        const reqCount = Array.isArray(parsed && parsed.requiredSkills) ? parsed.requiredSkills.length : 0;
        const prefCount = Array.isArray(parsed && parsed.preferredSkills) ? parsed.preferredSkills.length : 0;
        if (reqCount + prefCount < 8) return false;
      }
    }

    return true;
  }

  function collectLikelyPostingStrings(value, out, depth, keyHint) {
    if (depth > 6 || out.length > 240) return;
    if (typeof value === "string") {
      const text = ns.normalizeText(value);
      if (!text) return;
      const key = String(keyHint || "").toLowerCase();
      const likelyByKey = /(description|summary|responsibil|qualif|require|prefer|skill|duties|work\s*term|duration|gpa|cover|transcript|posting|title|division|organization)/.test(
        key
      );
      const likelyByText = looksLikePostingContent(text) || /(required skills|preferred skills|job posting information|work term duration|application information)/i.test(text);
      if (likelyByKey || likelyByText || text.length >= 100) {
        out.push(text);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => collectLikelyPostingStrings(item, out, depth + 1, keyHint));
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, val]) => collectLikelyPostingStrings(val, out, depth + 1, key));
    }
  }

  function parsePostingResponsePayload(rawText) {
    const text = String(rawText || "");
    if (!text.trim()) return ns.parseJobPosting("");

    const trimmed = text.trim();
    if (/^<\?xml/i.test(trimmed) || /<partial-response[\s>]/i.test(trimmed)) {
      try {
        const xml = new DOMParser().parseFromString(trimmed, "text/xml");
        const updates = Array.from(xml.querySelectorAll("update"));
        if (updates.length) {
          const htmlFragments = updates
            .map((node) => ns.normalizeText(node.textContent || ""))
            .filter(Boolean);
          const joined = htmlFragments.join("\n");
          if (joined.length >= 180) {
            return ns.parseJobPosting(joined);
          }
        }
      } catch (_error) {
        // fall through
      }
    }

    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        const data = JSON.parse(trimmed);
        const pieces = [];
        collectLikelyPostingStrings(data, pieces, 0, "");
        const joined = ns.unique(pieces).join("\n");
        if (joined.length >= 180) {
          return ns.parseJobPosting(joined);
        }
      } catch (_error) {
        // fall through
      }
    }

    return ns.parseJobPosting(text);
  }

  function parsePostingFromContextBlob(job, contextStrings) {
    const jobId = String((job && job.jobId) || "").trim().toLowerCase();
    const titleTokens = normalizeTitleKey(job && job.title ? job.title : "")
      .split(" ")
      .filter((token) => token.length >= 4);
    const chunks = [];

    (contextStrings || []).forEach((raw) => {
      const text = String(raw || "");
      if (!text || text.length < 220) return;
      const lower = text.toLowerCase();
      if (jobId && !lower.includes(jobId)) return;
      const tokenHits = titleTokens.filter((token) => lower.includes(token)).length;
      const looksPosting = looksLikePostingContent(text) || /(required skills|preferred skills|job posting information|application information|work term duration)/i.test(lower);
      if (!looksPosting && tokenHits < Math.min(2, titleTokens.length || 2)) return;
      chunks.push(text.slice(0, 16000));
    });

    if (!chunks.length) return null;
    const parsed = parsePostingResponsePayload(chunks.join("\n"));
    if (parsedLikelyMatchesSelectedJob(parsed, job || {})) {
      return parsed;
    }
    return null;
  }

  function collectPostingRootCandidatesFromDocument(doc, selectedTitle, visibleOnly) {
    const rootDoc = doc || document;
    const selectors = [
      ".ui-dialog-content",
      ".modal-body",
      ".modal-content",
      "[role='dialog']",
      ".jobPosting",
      ".postingDetails",
      ".job-details"
    ];
    const candidates = [];
    const titleNeedle = ns.normalizeText(selectedTitle || "").toLowerCase();
    selectors.forEach((selector) => {
      rootDoc.querySelectorAll(selector).forEach((node) => {
        if (visibleOnly && !isElementVisible(node)) return;
        const text = ns.normalizeText(node.textContent || "");
        if (!looksLikePostingContent(text)) return;
        const lower = text.toLowerCase();
        const titleBoost = titleNeedle && lower.includes(titleNeedle) ? 4000 : 0;
        candidates.push({ node, textLength: text.length + titleBoost });
      });
    });
    candidates.sort((a, b) => b.textLength - a.textLength);
    return candidates.map((item) => item.node);
  }

  function collectPostingRootCandidates(selectedTitle, visibleOnly) {
    return collectPostingRootCandidatesFromDocument(document, selectedTitle, visibleOnly);
  }

  function postingTextMatchesEntry(postingText, entry) {
    const text = String(postingText || "").toLowerCase();
    if (!text) return false;

    const jobId = String(entry && entry.job && entry.job.jobId ? entry.job.jobId : "").trim();
    if (jobId && text.includes(jobId.toLowerCase())) return true;
    if (jobId) {
      const numericIds = ns.unique((text.match(/\b\d{5,8}\b/g) || []).slice(0, 36));
      if (numericIds.length && !numericIds.includes(jobId)) return false;
    }

    const TITLE_STOPWORDS = new Set([
      "intern",
      "internship",
      "co",
      "coop",
      "student",
      "position",
      "role",
      "job",
      "junior",
      "senior",
      "assistant",
      "engineering",
      "developer",
      "software",
      "analyst"
    ]);
    const rawTitleTokens = normalizeTitleKey(entry && entry.job ? entry.job.title : "")
      .split(" ")
      .filter((token) => token.length >= 4);
    const titleTokens = rawTitleTokens.filter((token) => !TITLE_STOPWORDS.has(token));
    const tokensForMatch = titleTokens.length ? titleTokens : rawTitleTokens;
    if (!tokensForMatch.length) return false;
    const hitCount = tokensForMatch.filter((token) => text.includes(token)).length;
    const minHits = tokensForMatch.length >= 4 ? 2 : 1;
    if (hitCount < minHits) return false;

    const companyTokens = normalizeTitleKey(entry && entry.job ? entry.job.company : "")
      .split(" ")
      .filter((token) => token.length >= 4 && !/^(inc|ltd|corp|company|division|office|group|solutions|technologies|systems)$/.test(token));
    if (!companyTokens.length) return true;
    const companyHits = companyTokens.filter((token) => text.includes(token)).length;
    return companyHits >= 1;
  }

  function findPostingRootForEntry(entry) {
    const title = entry && entry.job ? entry.job.title : "";
    const visible = collectPostingRootCandidatesFromDocument(document, title, true);
    for (const node of visible) {
      const text = ns.normalizeText(node.textContent || "").toLowerCase();
      if (postingTextMatchesEntry(text, entry)) return node;
    }

    const all = collectPostingRootCandidatesFromDocument(document, title, false);
    for (const node of all) {
      const text = ns.normalizeText(node.textContent || "").toLowerCase();
      if (postingTextMatchesEntry(text, entry)) return node;
    }

    return null;
  }

  function findPostingRootForEntryInDocument(doc, entry) {
    const title = entry && entry.job ? entry.job.title : "";
    const visible = collectPostingRootCandidatesFromDocument(doc || document, title, true);
    for (const node of visible) {
      const text = ns.normalizeText(node.textContent || "").toLowerCase();
      if (postingTextMatchesEntry(text, entry)) return node;
    }

    const all = collectPostingRootCandidatesFromDocument(doc || document, title, false);
    for (const node of all) {
      const text = ns.normalizeText(node.textContent || "").toLowerCase();
      if (postingTextMatchesEntry(text, entry)) return node;
    }
    return null;
  }

  function closeLikelyPostingDialogInDocument(doc) {
    const rootDoc = doc || document;
    const selectors = [
      "button[aria-label*='close' i]",
      ".ui-dialog-titlebar-close",
      ".modal-header .close",
      ".modal .close",
      "button.close",
      "button[data-dismiss='modal']"
    ];
    for (const selector of selectors) {
      const buttons = Array.from(rootDoc.querySelectorAll(selector));
      const button = buttons.find((node) => isElementVisible(node) || node instanceof Element);
      if (!button) continue;
      try {
        button.dispatchEvent(
          new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: (rootDoc && rootDoc.defaultView) || window
          })
        );
        return true;
      } catch (_error) {}
    }
    return false;
  }

  function findJobMatchByHint(jobs, jobIdHint, titleHint) {
    const list = Array.isArray(jobs) ? jobs : [];
    const jobId = String(jobIdHint || "").trim();
    const titleKey = normalizeTitleKey(titleHint || "");
    if (jobId) {
      const byId = list.find((job) => String(job && job.jobId ? job.jobId : "").trim() === jobId);
      if (byId) return byId;
      const byRowText = list.find((job) => {
        const text = ns.normalizeText(job && job.row ? job.row.textContent || "" : "");
        return new RegExp(`\\b${jobId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
      });
      if (byRowText) return byRowText;
    }
    if (titleKey) {
      return (
        list.find((job) => normalizeTitleKey(job && job.title ? job.title : "").includes(titleKey)) ||
        list.find((job) => titleKey.includes(normalizeTitleKey(job && job.title ? job.title : ""))) ||
        null
      );
    }
    return null;
  }

  async function extractPostingByProbePayload(payload) {
    const probe = payload && typeof payload === "object" ? payload : {};
    const jobId = String(probe.jobId || "").trim();
    const title = String(probe.title || "").trim();
    const found = await waitForJobRows(null, 26, 360);
    const jobs = found && Array.isArray(found.jobs) ? found.jobs : [];
    if (!jobs.length) {
      return { ok: false, error: "Probe tab found no job rows" };
    }

    const job = findJobMatchByHint(jobs, jobId, title);
    if (!job) {
      return { ok: false, error: "Probe tab could not match selected job row" };
    }

    const contextStrings = collectContextStringsForJob(job);
    const knownPostingUrls = ns.unique(jobs.map((item) => (item && item.url ? item.url : "")).filter(Boolean));
    const requests = buildPostingRequestCandidates(job, knownPostingUrls, contextStrings);
    const startMs = Date.now();
    for (const request of requests) {
      if (Date.now() - startMs > 5200) break;
      const method = String(request.method || "GET").toUpperCase();
      const url = String(request.url || "");
      const body = typeof request.body === "string" ? request.body : undefined;
      const headers = request.headers && typeof request.headers === "object" ? request.headers : undefined;
      if (!url) continue;
      try {
        const html = await ns.fetchJobHtml(url, { method, body, headers });
        const parsed = parsePostingResponsePayload(html);
        if (parsedLikelyMatchesSelectedJob(parsed, { ...job, title: title || job.title })) {
          return { ok: true, parsed, source: "probe-network", method, url };
        }
      } catch (_error) {}
    }

    const anchor = pickPrimaryJobAnchor(job.row, job.title) || job.anchor || job.row.querySelector("a");
    if (!(anchor instanceof Element)) {
      return { ok: false, error: "Probe tab could not find title anchor" };
    }

    const captured = [];
    const seenCaptured = new Set();
    const pushCaptured = (value) => {
      const text = String(value || "");
      if (!text || text.length < 80) return;
      if (seenCaptured.has(text)) return;
      seenCaptured.add(text);
      captured.push(text.slice(0, 250000));
    };

    const originalFetch = window.fetch;
    const XHRCtor = window.XMLHttpRequest;
    const originalXhrOpen = XHRCtor && XHRCtor.prototype ? XHRCtor.prototype.open : null;
    const originalXhrSend = XHRCtor && XHRCtor.prototype ? XHRCtor.prototype.send : null;

    const restoreNetworkHooks = () => {
      try {
        if (window.fetch !== originalFetch) {
          window.fetch = originalFetch;
        }
      } catch (_error) {}
      try {
        if (XHRCtor && originalXhrOpen) XHRCtor.prototype.open = originalXhrOpen;
        if (XHRCtor && originalXhrSend) XHRCtor.prototype.send = originalXhrSend;
      } catch (_error) {}
    };

    try {
      if (typeof originalFetch === "function") {
        window.fetch = async function wrappedProbeFetch(...args) {
          const response = await originalFetch.apply(this, args);
          try {
            const clone = response.clone();
            const text = await clone.text();
            pushCaptured(text);
          } catch (_error) {}
          return response;
        };
      }

      if (XHRCtor && originalXhrOpen && originalXhrSend) {
        XHRCtor.prototype.open = function patchedProbeOpen(method, url, ...rest) {
          this.__wwp_url = String(url || "");
          this.__wwp_method = String(method || "GET");
          return originalXhrOpen.call(this, method, url, ...rest);
        };
        XHRCtor.prototype.send = function patchedProbeSend(body) {
          try {
            this.addEventListener("loadend", () => {
              try {
                const text = String(this.responseText || "");
                pushCaptured(text);
              } catch (_error) {}
            });
          } catch (_error) {}
          return originalXhrSend.call(this, body);
        };
      }

      const preventNav = (event) => {
        event.preventDefault();
      };
      anchor.addEventListener("click", preventNav, { capture: true, once: true });
      try {
        anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      } catch (_error) {
        return { ok: false, error: "Probe tab click dispatch failed" };
      }

      const timeoutAt = Date.now() + 6200;
      const probeEntry = { job: { jobId: job.jobId, title: title || job.title } };
      while (Date.now() < timeoutAt) {
        await ns.wait(130);

        for (const blob of captured) {
          const parsedPayload = parsePostingResponsePayload(blob);
          if (!parsedLikelyMatchesSelectedJob(parsedPayload, { ...job, title: title || job.title })) continue;
          closeLikelyPostingDialogInDocument(document);
          return { ok: true, parsed: parsedPayload, source: "probe-click-payload", method: "CLICK" };
        }

        const root = findPostingRootForEntryInDocument(document, probeEntry);
        if (!root) continue;
        const parsed = ns.parseJobPosting(root.outerHTML || root.textContent || "");
        if (parsedLikelyMatchesSelectedJob(parsed, { ...job, title: title || job.title })) {
          closeLikelyPostingDialogInDocument(document);
          return { ok: true, parsed, source: "probe-click-dom", method: "CLICK" };
        }
      }
    } finally {
      restoreNetworkHooks();
      closeLikelyPostingDialogInDocument(document);
    }

    return { ok: false, error: "Probe tab could not load full posting content" };
  }

  function installProbeMessageListener() {
    if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== "object") return;
      if (message.type !== "wwp:probeExtractByJob") return;
      (async () => {
        try {
          const result = await extractPostingByProbePayload(message.payload || {});
          sendResponse(result);
        } catch (error) {
          sendResponse({ ok: false, error: String(error && error.message ? error.message : error) });
        }
      })();
      return true;
    });
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
        const canUseCache = isLikelyPostingUrl(job.url);
        const cached = canUseCache ? await ns.getCachedJobAnalysis(job.url) : null;
        parsed = cached || null;
        if (parsed && !parsedLikelyMatchesSelectedJob(parsed, job)) {
          parsed = null;
        }

        if (!parsed) {
          try {
            const html = await ns.fetchJobHtml(job.url);
            const parsedFromFetch = parsePostingResponsePayload(html);
            if (parsedLikelyMatchesSelectedJob(parsedFromFetch, job)) {
              parsed = parsedFromFetch;
              if (canUseCache) {
                await ns.setCachedJobAnalysis(job.url, parsed);
              }
            }
          } catch (_error) {
            parsed = null;
          }
        }
      }

      if (!parsed) {
        // Fallback: analyze using visible row content only when posting fetch is unavailable.
        parsed = ns.parseJobPosting(job.snippet || ns.getTextFromElement(job.row));
      }

      const analyzed = analyzeParsedJob(job, parsed, resumeSkills, settings);

      if (panel) {
        panel.setSubtitle(`Analyzed ${index + 1} / ${jobs.length} postings`);
      }

      return {
        job,
        ...analyzed
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
        btn.textContent = `${index + 1}. ${entry.job.title} @ ${entry.job.company} | Skill ${entry.skillMatch}% | Overall ${entry.overallMatch}%`;
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
    metrics.appendChild(ns.makeProgressMetric("Target Role Match", entry.targetRoleMatch || 0));
    metrics.appendChild(ns.makeProgressMetric("Overall Match", entry.overallMatch || 0));

    let fitLabel = "Low fit - likely skip";
    let tone = "danger";
    if (entry.hardDisqualifier) {
      fitLabel = "Do not apply - confirmed not a fit";
      tone = "danger";
    } else if ((entry.overallMatch || 0) >= 75) {
      fitLabel = "Strong fit - apply";
      tone = "good";
    } else if ((entry.overallMatch || 0) >= 60) {
      fitLabel = "Decent fit - apply selectively";
      tone = "good";
    } else if ((entry.overallMatch || 0) >= 45) {
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

    const resumeMap = ns.getResumeSkillMap(settings);
    const reqSkills = Array.isArray(entry.requiredSkills) ? entry.requiredSkills : [];
    if (reqSkills.length) {
      const matchedRequired = reqSkills.filter((skill) => (resumeMap.get(skill) || 0) > 0).length;
      const coverage = Math.round((matchedRequired / Math.max(1, reqSkills.length)) * 100);
      const li = document.createElement("li");
      li.textContent = `Required skill coverage: ${matchedRequired}/${reqSkills.length} (${coverage}%).`;
      recList.appendChild(li);
    }

    const topSkills = (entry.requiredSkills || []).slice(0, 6);
    if (topSkills.length) {
      const li = document.createElement("li");
      li.textContent = `Key requirements: ${topSkills.join(", ")}`;
      recList.appendChild(li);
    }

    rec.appendChild(recList);

    const pref = document.createElement("p");
    pref.className = "wwp-inline-note";
    pref.textContent = `Your prefs: term ${settings.preferences.workTerm}, role ${settings.preferences.targetRole || "(not set)"}, length ${settings.preferences.preferredTermLength}. Overall match blends skills, role alignment, and eligibility compatibility.`;

    card.append(title, metrics, chips, pref);
    return { card, rec };
  }

  function buildSelectedJobPendingCard(entry) {
    const card = ns.makeCard("Selected Job");
    const title = document.createElement("p");
    title.style.margin = "0 0 8px";
    title.style.fontWeight = "700";
    title.textContent = `${entry.job.title} @ ${entry.job.company || "Unknown company"}`;

    const note = document.createElement("p");
    note.className = "wwp-inline-note";
    note.textContent = "Accurate fit scores are shown only after you open this job's description.";

    const hint = document.createElement("ul");
    hint.className = "wwp-list";
    const li1 = document.createElement("li");
    li1.textContent = "Click the job title link to open the posting.";
    const li2 = document.createElement("li");
    li2.textContent = "Once opened, WaterlooWorks+ will load full-match percentages in this tab.";
    hint.append(li1, li2);

    card.append(title, note, hint);
    return { card };
  }

  function wireSelectedJobInteraction(scoredJobs, tabs, settings, panel) {
    const selectedHost = document.createElement("div");
    tabs.appendToTab("selected", selectedHost);

    let selectedRow = null;
    const byKey = new Map();
    const byTitle = new Map();
    const resumeSkills = ns.getResumeSkillMap(settings);
    const knownPostingUrls = ns.unique(scoredJobs.map((entry) => (entry && entry.job ? entry.job.url : "")).filter(Boolean));
    let renderNonce = 0;
    let suppressSelectionHandlers = false;
    const cleanup = [];
    const probeState = {
      iframe: null,
      loadedUrl: "",
      loading: null
    };

    function getProbeTargetUrl() {
      try {
        const next = new URL(location.href);
        next.hash = "";
        return next.href;
      } catch (_error) {
        return location.href;
      }
    }

    function createProbeFrame() {
      const frame = document.createElement("iframe");
      frame.name = "wwp-probe-frame";
      frame.title = "wwp-probe-frame";
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("tabindex", "-1");
      frame.style.position = "fixed";
      frame.style.left = "-20000px";
      frame.style.top = "0";
      frame.style.width = "1280px";
      frame.style.height = "900px";
      frame.style.opacity = "0";
      frame.style.pointerEvents = "none";
      frame.style.border = "0";
      frame.style.zIndex = "-1";
      document.body.appendChild(frame);
      probeState.iframe = frame;
      return frame;
    }

    async function ensureProbeFrameLoaded(forceReload) {
      const targetUrl = getProbeTargetUrl();
      let frame = probeState.iframe;
      if (!frame || !document.contains(frame)) {
        frame = createProbeFrame();
        probeState.loadedUrl = "";
      }
      if (!forceReload && probeState.loadedUrl === targetUrl && frame.contentDocument && frame.contentDocument.readyState === "complete") {
        return frame.contentDocument;
      }
      if (probeState.loading && !forceReload) {
        return probeState.loading;
      }
      probeState.loading = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanupLoad();
          reject(new Error("Probe frame load timeout"));
        }, 6500);
        const onLoad = () => {
          cleanupLoad();
          probeState.loadedUrl = targetUrl;
          resolve(frame.contentDocument);
        };
        const onError = () => {
          cleanupLoad();
          reject(new Error("Probe frame failed to load"));
        };
        const cleanupLoad = () => {
          clearTimeout(timeout);
          frame.removeEventListener("load", onLoad);
          frame.removeEventListener("error", onError);
          probeState.loading = null;
        };
        frame.addEventListener("load", onLoad, { once: true });
        frame.addEventListener("error", onError, { once: true });
        frame.src = targetUrl;
      });
      return probeState.loading;
    }

    function findRowForJobInDocument(doc, entry) {
      if (!doc || !entry || !entry.job) return null;
      const jobId = String(entry.job.jobId || "").trim();
      const titleKey = normalizeTitleKey(entry.job.title);
      const rows = Array.from(doc.querySelectorAll("tr"));

      if (jobId) {
        const byId = rows.find((row) => {
          const text = ns.normalizeText(row.textContent || "");
          return new RegExp(`\\b${jobId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
        });
        if (byId) return byId;
      }

      if (titleKey) {
        return (
          rows.find((row) => {
            const text = normalizeTitleKey(row.textContent || "");
            return text.includes(titleKey);
          }) || null
        );
      }

      return null;
    }

    function closePostingInProbeDocument(doc) {
      if (!doc) return;
      const selectors = [
        "button[aria-label*='close' i]",
        ".ui-dialog-titlebar-close",
        ".modal-header .close",
        ".modal .close",
        "button.close",
        "button[data-dismiss='modal']"
      ];
      for (const selector of selectors) {
        const buttons = Array.from(doc.querySelectorAll(selector));
        const button = buttons.find((node) => isElementVisible(node));
        if (button) {
          try {
            button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: doc.defaultView || window }));
          } catch (_error) {}
          break;
        }
      }
    }

    async function hydrateEntryFromProbeFrame(entry) {
      if (!entry || !entry.job) return null;
      if (entry.__probeHydrateInFlight && entry.__probeHydratePromise) return entry.__probeHydratePromise;
      const now = Date.now();
      if (entry.__probeHydrateLastAttempt && now - entry.__probeHydrateLastAttempt < 1400) return null;
      entry.__probeHydrateLastAttempt = now;
      entry.__probeHydrateInFlight = true;
      const task = (async () => {
        let probeDoc;
        try {
          try {
            probeDoc = await ensureProbeFrameLoaded(false);
          } catch (_error) {
            probeDoc = await ensureProbeFrameLoaded(true);
          }

          let probeRow = findRowForJobInDocument(probeDoc, entry);
          if (!probeRow) {
            await ns.wait(450);
            probeRow = findRowForJobInDocument(probeDoc, entry);
          }
          if (!probeRow) {
            probeDoc = await ensureProbeFrameLoaded(true);
            probeRow = findRowForJobInDocument(probeDoc, entry);
          }
          if (!probeRow) return null;

          const probeAnchor = pickPrimaryJobAnchor(probeRow, entry.job.title) || probeRow.querySelector("a");
          if (!(probeAnchor instanceof Element)) return null;

          const probeWin = (probeDoc && probeDoc.defaultView) || window;
          const captured = [];
          const seen = new Set();
          const pushCaptured = (value) => {
            const text = String(value || "");
            if (!text || text.length < 80) return;
            if (seen.has(text)) return;
            seen.add(text);
            captured.push(text.slice(0, 250000));
          };

          const originalFetch = probeWin.fetch;
          const ProbeXhrCtor = probeWin.XMLHttpRequest;
          const originalXhrOpen = ProbeXhrCtor && ProbeXhrCtor.prototype ? ProbeXhrCtor.prototype.open : null;
          const originalXhrSend = ProbeXhrCtor && ProbeXhrCtor.prototype ? ProbeXhrCtor.prototype.send : null;
          const style = probeDoc.createElement("style");
          style.id = "wwp-probe-hide-posting-style";
          style.textContent = `
            .ui-dialog, .ui-widget-overlay, [role='dialog'], .modal, .modal-backdrop, .ui-sidebar, .ui-sidebar-mask, [class*='drawer'], [class*='side-panel'] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
            }
          `;
          (probeDoc.head || probeDoc.documentElement).appendChild(style);

          const restore = () => {
            try {
              if (probeWin.fetch !== originalFetch) {
                probeWin.fetch = originalFetch;
              }
            } catch (_error) {}
            try {
              if (ProbeXhrCtor && originalXhrOpen) ProbeXhrCtor.prototype.open = originalXhrOpen;
              if (ProbeXhrCtor && originalXhrSend) ProbeXhrCtor.prototype.send = originalXhrSend;
            } catch (_error) {}
            try {
              const node = probeDoc.getElementById("wwp-probe-hide-posting-style");
              if (node) node.remove();
            } catch (_error) {}
          };

          try {
            if (typeof originalFetch === "function") {
              probeWin.fetch = async function wrappedProbeFetch(...args) {
                const response = await originalFetch.apply(this, args);
                try {
                  const clone = response.clone();
                  const text = await clone.text();
                  pushCaptured(text);
                } catch (_error) {}
                return response;
              };
            }

            if (ProbeXhrCtor && originalXhrOpen && originalXhrSend) {
              ProbeXhrCtor.prototype.open = function patchedProbeOpen(method, url, ...rest) {
                this.__wwp_url = String(url || "");
                this.__wwp_method = String(method || "GET");
                return originalXhrOpen.call(this, method, url, ...rest);
              };
              ProbeXhrCtor.prototype.send = function patchedProbeSend(body) {
                try {
                  this.addEventListener("loadend", () => {
                    try {
                      const text = String(this.responseText || "");
                      pushCaptured(text);
                    } catch (_error) {}
                  });
                } catch (_error) {}
                return originalXhrSend.call(this, body);
              };
            }

            // Always block default anchor navigation inside the probe frame.
            // We only need page handlers/XHR side-effects, not href navigation (which can be javascript:).
            const preventDefault = (event) => {
              event.preventDefault();
            };
            probeAnchor.addEventListener("click", preventDefault, { capture: true, once: true });

            probeAnchor.dispatchEvent(
              new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
                view: probeWin
              })
            );

            const startedAt = Date.now();
            const timeoutAt = startedAt + 4600;
            let probeRowTriggered = false;
            while (Date.now() < timeoutAt) {
              await ns.wait(120);
              const currentDoc = (probeState.iframe && probeState.iframe.contentDocument) || probeDoc;
              if (!currentDoc) continue;

              for (const blob of captured) {
                const parsedPayload = parsePostingResponsePayload(blob);
                if (!parsedLikelyMatchesSelectedJob(parsedPayload, entry.job)) continue;
                const analyzed = analyzeParsedJob(entry.job, parsedPayload, resumeSkills, settings);
                closePostingInProbeDocument(currentDoc);
                return {
                  ...entry,
                  ...analyzed,
                  __probeHydrated: true,
                  __probeHydratedAt: Date.now()
                };
              }

              const root = findPostingRootForEntryInDocument(currentDoc, entry);
              if (root) {
                const parsedLive = ns.parseJobPosting(root.outerHTML || root.textContent || "");
                if (parsedLikelyMatchesSelectedJob(parsedLive, entry.job)) {
                  const analyzed = analyzeParsedJob(entry.job, parsedLive, resumeSkills, settings);
                  closePostingInProbeDocument(currentDoc);
                  return {
                    ...entry,
                    ...analyzed,
                    __probeHydrated: true,
                    __probeHydratedAt: Date.now()
                  };
                }
              }

              const bodyText = ns.normalizeText((currentDoc.body && currentDoc.body.textContent) || "");
              if (looksLikePostingContent(bodyText) && postingTextMatchesEntry(bodyText, entry)) {
                const parsedDoc = ns.parseJobPosting(currentDoc.documentElement ? currentDoc.documentElement.outerHTML : bodyText);
                if (parsedLikelyMatchesSelectedJob(parsedDoc, entry.job)) {
                  const analyzed = analyzeParsedJob(entry.job, parsedDoc, resumeSkills, settings);
                  closePostingInProbeDocument(currentDoc);
                  return {
                    ...entry,
                    ...analyzed,
                    __probeHydrated: true,
                    __probeHydratedAt: Date.now()
                  };
                }
              }

              // Some WW tables wire open handlers on the row (not anchor). Trigger once inside hidden probe frame only.
              if (!probeRowTriggered && probeRow && Date.now() - startedAt > 1200) {
                probeRowTriggered = true;
                try {
                  probeRow.dispatchEvent(
                    new MouseEvent("click", {
                      bubbles: true,
                      cancelable: true,
                      view: probeWin
                    })
                  );
                  probeRow.dispatchEvent(
                    new MouseEvent("dblclick", {
                      bubbles: true,
                      cancelable: true,
                      view: probeWin
                    })
                  );
                } catch (_error) {}
              }
            }
          } finally {
            restore();
          }
        } catch (_error) {
          return null;
        } finally {
          entry.__probeHydrateInFlight = false;
          entry.__probeHydratePromise = null;
        }
        return null;
      })();

      entry.__probeHydratePromise = task;
      return task;
    }

    function rememberEntry(entry) {
      if (!entry || !entry.job) return;
      if (entry.job.key) byKey.set(entry.job.key, entry);
      const titleKey = normalizeTitleKey(entry.job.title);
      if (titleKey) byTitle.set(titleKey, entry);
    }

    async function refreshEntryFromVisiblePosting(entry) {
      const retryScheduleMs = [0, 140, 260, 420, 620, 900, 1250, 1700, 2200];

      for (let idx = 0; idx < retryScheduleMs.length; idx += 1) {
        if (idx > 0) {
          await ns.wait(retryScheduleMs[idx] - retryScheduleMs[idx - 1]);
        }

        const root = findPostingRootForEntry(entry);
        if (!root) continue;

        const rootText = ns.normalizeText(root.textContent || "");
        if (!looksLikePostingContent(rootText)) continue;

        const contentFingerprint = rootText.slice(0, 2200);
        if (entry && entry.__livePostingFingerprint === contentFingerprint) return null;

        const parsedLive = ns.parseJobPosting(root.outerHTML || rootText);
        const reqCount = (parsedLive.requiredSkills || []).length;
        const prefCount = (parsedLive.preferredSkills || []).length;

        // If modal content is still partially loading, retry until we get meaningful skill extraction.
        if (reqCount + prefCount < 4 && idx < retryScheduleMs.length - 1) {
          continue;
        }
        if (reqCount + prefCount === 0) {
          continue;
        }
        if (!parsedLikelyMatchesSelectedJob(parsedLive, entry.job)) {
          continue;
        }

        const analyzed = analyzeParsedJob(entry.job, parsedLive, resumeSkills, settings);
        return {
          ...entry,
          ...analyzed,
          __livePostingFingerprint: contentFingerprint
        };
      }

      return null;
    }

  async function hydrateEntryFromNetwork(entry) {
      if (!entry || !entry.job) return null;
      const now = Date.now();
      const minRetryMs = 260;
      if (entry.__networkHydrateInFlight && entry.__networkHydratePromise) return entry.__networkHydratePromise;
      if (entry.__networkHydrateLastAttempt && now - entry.__networkHydrateLastAttempt < minRetryMs) return null;
      entry.__networkHydrateInFlight = true;
      entry.__networkHydrateLastAttempt = now;

      const task = (async () => {
        const startMs = Date.now();
        const contextStrings = entry.job.__contextStrings || collectContextStringsForJob(entry.job);
        entry.job.__contextStrings = contextStrings;
        const requests = buildPostingRequestCandidates(entry.job, knownPostingUrls, contextStrings);
        for (const request of requests) {
          if (Date.now() - startMs > 5200) break;
          const method = String(request.method || "GET").toUpperCase();
          const url = String(request.url || "");
          const body = typeof request.body === "string" ? request.body : "";
          const headers = request.headers && typeof request.headers === "object" ? request.headers : undefined;
          const highConfidenceRequest = String(request.matchConfidence || "").toLowerCase() === "high";
          if (!url) continue;

          const canUseCache = method === "GET" && !body && isLikelyPostingUrl(url);
          let parsed = canUseCache ? await ns.getCachedJobAnalysis(url) : null;
          if (parsed && !parsedLikelyMatchesSelectedJob(parsed, entry.job)) {
            parsed = null;
          }
          if (!parsed) {
            try {
              const html = await ns.fetchJobHtml(url, {
                method,
                body: body || undefined,
                headers
              });
              const parsedFromFetch = parsePostingResponsePayload(html);
              const likelyMatch =
                parsedLikelyMatchesSelectedJob(parsedFromFetch, entry.job) ||
                (highConfidenceRequest && looksLikeFullPostingParsed(parsedFromFetch, entry.job.title));
              if (!likelyMatch) {
                continue;
              }
              parsed = parsedFromFetch;
              if (canUseCache) {
                await ns.setCachedJobAnalysis(url, parsed);
              }
            } catch (_error) {
              continue;
            }
          }

          const parsedLikely =
            parsedLikelyMatchesSelectedJob(parsed, entry.job) || (highConfidenceRequest && looksLikeFullPostingParsed(parsed, entry.job.title));
          if (!parsedLikely) {
            continue;
          }

          if (url && !knownPostingUrls.includes(url)) {
            knownPostingUrls.push(url);
          }

          const hydratedJob = { ...entry.job, url };
          const analyzed = analyzeParsedJob(hydratedJob, parsed, resumeSkills, settings);
          return {
            ...entry,
            ...analyzed,
            job: hydratedJob,
            __networkHydrated: true,
            __networkHydratedAt: Date.now()
          };
        }

        const parsedFromContext = parsePostingFromContextBlob(entry.job, contextStrings);
        if (parsedFromContext && parsedLikelyMatchesSelectedJob(parsedFromContext, entry.job)) {
          const analyzed = analyzeParsedJob(entry.job, parsedFromContext, resumeSkills, settings);
          return {
            ...entry,
            ...analyzed,
            __networkHydrated: true,
            __networkHydratedAt: Date.now(),
            __networkHydratedMethod: "context"
          };
        }
        return null;
      })()
        .catch(() => null)
        .finally(() => {
          entry.__networkHydrateInFlight = false;
          entry.__networkHydratePromise = null;
        });

      entry.__networkHydratePromise = task;
      return task;
    }

    async function hydrateEntryFromBackgroundProbe(entry) {
      // Disabled intentionally for row-selection UX: background probe can create visible browser UI side effects.
      return null;

      if (!entry || !entry.job || IS_BACKGROUND_PROBE_TAB) return null;
      if (typeof ns.fetchPostingViaBackgroundProbe !== "function") return null;

      const now = Date.now();
      if (entry.__backgroundProbeInFlight) return null;
      if (entry.__backgroundProbeLastAttempt && now - entry.__backgroundProbeLastAttempt < 2200) return null;

      entry.__backgroundProbeInFlight = true;
      entry.__backgroundProbeLastAttempt = now;

      try {
        const response = await ns.fetchPostingViaBackgroundProbe({
          pageUrl: location.href,
          jobId: entry.job.jobId || "",
          title: entry.job.title || ""
        });
        const parsed = response && response.parsed ? response.parsed : null;
        if (!parsedLikelyMatchesSelectedJob(parsed, entry.job)) {
          return null;
        }

        const hydratedJob = response && response.url ? { ...entry.job, url: response.url } : entry.job;
        const analyzed = analyzeParsedJob(hydratedJob, parsed, resumeSkills, settings);
        return {
          ...entry,
          ...analyzed,
          job: hydratedJob,
          __backgroundProbeHydrated: true,
          __backgroundProbeHydratedAt: Date.now(),
          __backgroundProbeSource: String((response && response.source) || "background")
        };
      } catch (_error) {
        return null;
      } finally {
        entry.__backgroundProbeInFlight = false;
      }
    }

    async function hydrateEntryFromSuppressedClick(entry) {
      if (!entry || !entry.job || !entry.job.row) return null;
      if (entry.__suppressedClickInFlight && entry.__suppressedClickPromise) return entry.__suppressedClickPromise;
      const now = Date.now();
      if (entry.__suppressedClickLastAttempt && now - entry.__suppressedClickLastAttempt < 1300) return null;
      entry.__suppressedClickLastAttempt = now;
      entry.__suppressedClickInFlight = true;

      const task = (async () => {
        const anchor = entry.job.anchor || pickPrimaryJobAnchor(entry.job.row, entry.job.title);
        const clickTargets = [];
        if (entry.job.row instanceof Element) clickTargets.push(entry.job.row);
        if (anchor instanceof Element && !clickTargets.includes(anchor)) clickTargets.push(anchor);
        if (clickTargets.length === 0) return null;

        const htmlRoot = document.documentElement;
        const captured = [];
        const seenPayloads = new Set();
        const pushCaptured = (text) => {
          const value = String(text || "");
          if (!value || value.length < 80) return;
          if (seenPayloads.has(value)) return;
          seenPayloads.add(value);
          captured.push(value.slice(0, 250000));
        };

        const originalFetch = window.fetch;
        const XHRCtor = window.XMLHttpRequest;
        const originalXhrOpen = XHRCtor && XHRCtor.prototype ? XHRCtor.prototype.open : null;
        const originalXhrSend = XHRCtor && XHRCtor.prototype ? XHRCtor.prototype.send : null;
        const originalWindowOpen = window.open;

        const restoreNetworkHooks = () => {
          try {
            if (window.fetch !== originalFetch) {
              window.fetch = originalFetch;
            }
          } catch (_error) {}
          try {
            if (XHRCtor && originalXhrOpen) XHRCtor.prototype.open = originalXhrOpen;
            if (XHRCtor && originalXhrSend) XHRCtor.prototype.send = originalXhrSend;
          } catch (_error) {}
          try {
            if (window.open !== originalWindowOpen) {
              window.open = originalWindowOpen;
            }
          } catch (_error) {}
        };

        try {
          window.open = () => null;

          if (typeof originalFetch === "function") {
            window.fetch = async function wrappedFetch(...args) {
              const response = await originalFetch.apply(this, args);
              try {
                const clone = response.clone();
                const text = await clone.text();
                pushCaptured(text);
              } catch (_error) {}
              return response;
            };
          }

          if (XHRCtor && originalXhrOpen && originalXhrSend) {
            XHRCtor.prototype.open = function patchedOpen(method, url, ...rest) {
              this.__wwp_url = String(url || "");
              this.__wwp_method = String(method || "GET");
              return originalXhrOpen.call(this, method, url, ...rest);
            };
            XHRCtor.prototype.send = function patchedSend(body) {
              try {
                this.addEventListener("loadend", () => {
                  try {
                    const text = String(this.responseText || "");
                    pushCaptured(text);
                  } catch (_error) {}
                });
              } catch (_error) {}
              return originalXhrSend.call(this, body);
            };
          }

          htmlRoot.classList.add("wwp-suppress-posting-ui");
          suppressSelectionHandlers = true;

          const startedAt = Date.now();
          const timeoutAt = startedAt + 4300;
          let clickRound = 0;
          while (Date.now() < timeoutAt) {
            if (clickRound < 3) {
              const target = clickTargets[clickRound % clickTargets.length];
              if (target instanceof Element) {
                try {
                  if (target.tagName === "A") {
                    target.addEventListener(
                      "click",
                      (event) => {
                        event.preventDefault();
                      },
                      { capture: true, once: true }
                    );
                  }
                  target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
                  if (target === entry.job.row) {
                    target.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
                  }
                } catch (_error) {}
              }
              clickRound += 1;
            }

            await ns.wait(140);

            const root = findPostingRootForEntry(entry);
            if (root) {
              const parsedLive = ns.parseJobPosting(root.outerHTML || root.textContent || "");
              const parsedOk = parsedLikelyMatchesSelectedJob(parsedLive, entry.job) || looksLikeFullPostingParsed(parsedLive, entry.job.title);
              if (parsedOk) {
                const analyzed = analyzeParsedJob(entry.job, parsedLive, resumeSkills, settings);
                closeLikelyPostingDialogInDocument(document);
                return {
                  ...entry,
                  ...analyzed,
                  __suppressedClickHydrated: true,
                  __suppressedClickHydratedAt: Date.now()
                };
              }
            }

            for (const blob of captured) {
              const parsedPayload = parsePostingResponsePayload(blob);
              const parsedOk =
                parsedLikelyMatchesSelectedJob(parsedPayload, entry.job) || looksLikeFullPostingParsed(parsedPayload, entry.job.title);
              if (!parsedOk) continue;
              const analyzed = analyzeParsedJob(entry.job, parsedPayload, resumeSkills, settings);
              closeLikelyPostingDialogInDocument(document);
              return {
                ...entry,
                ...analyzed,
                __suppressedClickHydrated: true,
                __suppressedClickHydratedAt: Date.now()
              };
            }
          }
        } catch (_error) {
          return null;
        } finally {
          closeLikelyPostingDialogInDocument(document);
          restoreNetworkHooks();
          suppressSelectionHandlers = false;
          htmlRoot.classList.remove("wwp-suppress-posting-ui");
        }
        return null;
      })()
        .catch(() => null)
        .finally(() => {
          entry.__suppressedClickInFlight = false;
          entry.__suppressedClickPromise = null;
        });

      entry.__suppressedClickPromise = task;
      return task;
    }

    scoredJobs.forEach((entry) => {
      rememberEntry(entry);
    });

    function render(entry, options) {
      const opts = options || {};
      if (!entry) return;
      const selectedTitle = entry.job.title;
      if (selectedRow) selectedRow.classList.remove("wwp-row-selected");
      selectedRow = entry.job.row;
      selectedRow.classList.add("wwp-row-selected");

      selectedHost.innerHTML = "";
      if (opts.showAccurate === true) {
        const blocks = buildSelectedJobCard(entry, settings);
        selectedHost.appendChild(blocks.card);
        selectedHost.appendChild(blocks.rec);
      } else {
        const pending = buildSelectedJobPendingCard(entry);
        selectedHost.appendChild(pending.card);
      }
      tabs.activate("selected");
      if (panel && typeof panel.setSubtitle === "function") {
        panel.setSubtitle(`Selected: ${entry.job.title}`);
      }

      if (opts.skipLiveRefresh || opts.requestLiveRefresh !== true) return;
      if (panel && typeof panel.setSubtitle === "function") {
        panel.setSubtitle(`Selected: ${selectedTitle} (waiting for posting open...)`);
      }
      const ticket = ++renderNonce;
      let hydratedFromLive = false;
      refreshEntryFromVisiblePosting(entry)
        .then((liveRefreshed) => {
          if (ticket !== renderNonce) return null;
          if (liveRefreshed) {
            hydratedFromLive = true;
            rememberEntry(liveRefreshed);
            render(liveRefreshed, { showAccurate: true, skipLiveRefresh: true });
            return null;
          }
          return null;
        })
        .catch((_error) => {
          if (ticket !== renderNonce) return;
          if (panel && typeof panel.setSubtitle === "function") {
            panel.setSubtitle(`Selected: ${selectedTitle} (open posting to load fit)`);
          }
        })
        .finally(() => {
          if (ticket !== renderNonce) return;
          if (!panel || typeof panel.setSubtitle !== "function") return;
          panel.setSubtitle(hydratedFromLive ? `Selected: ${selectedTitle}` : `Selected: ${selectedTitle} (open posting for accurate fit)`);
        });
    }

    const sorted = scoredJobs.slice().sort((a, b) => b.rankingScore - a.rankingScore);
    render(sorted[0] || scoredJobs[0], { skipLiveRefresh: true });

    scoredJobs.forEach((entry) => {
      const row = entry.job.row;
      if (!row) return;
      const onRowClick = () => {
        if (suppressSelectionHandlers) return;
        render(entry, { skipLiveRefresh: true });
      };
      row.addEventListener("click", onRowClick, { passive: true });
      cleanup.push(() => row.removeEventListener("click", onRowClick));
      if (entry.job.anchor) {
        const onAnchorClick = () => {
          if (suppressSelectionHandlers) return;
          render(entry, { requestLiveRefresh: true });
        };
        entry.job.anchor.addEventListener("click", onAnchorClick, { passive: true });
        cleanup.push(() => entry.job.anchor.removeEventListener("click", onAnchorClick));
      }
    });

    const onDocumentClick = (event) => {
      if (suppressSelectionHandlers) return;
      const target = event.target;
      if (!(target instanceof Element)) return;

      const row = target.closest("tr");
      if (row && row.dataset && row.dataset.wwpJobKey && byKey.has(row.dataset.wwpJobKey)) {
        render(byKey.get(row.dataset.wwpJobKey), { skipLiveRefresh: true });
        return;
      }

      const heading = target.closest("h1, h2, h3, .modal-title, .ui-dialog-title");
      if (heading) {
        const titleKey = normalizeTitleKey(heading.textContent || "");
        if (titleKey && byTitle.has(titleKey)) {
          render(byTitle.get(titleKey), { requestLiveRefresh: true });
        }
      }
    };
    document.addEventListener("click", onDocumentClick, true);
    cleanup.push(() => document.removeEventListener("click", onDocumentClick, true));
    cleanup.push(() => {
      if (probeState.iframe && document.contains(probeState.iframe)) {
        probeState.iframe.remove();
      }
      probeState.iframe = null;
      probeState.loadedUrl = "";
      probeState.loading = null;
    });

    return {
      render,
      dispose() {
        cleanup.forEach((fn) => {
          try {
            fn();
          } catch (_error) {}
        });
        if (selectedRow) selectedRow.classList.remove("wwp-row-selected");
        selectedRow = null;
      }
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

    const prevRuntime = ns.__WWP_LISTINGS_RUNTIME;
    const gate = await ns.getSettingsForPage();
    if (gate.disabled) {
      if (prevRuntime && typeof prevRuntime.dispose === "function") {
        prevRuntime.dispose();
      }
      ns.__WWP_LISTINGS_RUNTIME = null;
      return;
    }

    if (prevRuntime && typeof prevRuntime.dispose === "function") {
      prevRuntime.dispose();
    }

    const runtime = {
      disposed: false,
      selection: null,
      observer: null,
      pollTimer: 0,
      mutationTimer: 0,
      rerunTimer: 0,
      pageClickHandler: null,
      currentSignature: ""
    };
    ns.__WWP_LISTINGS_RUNTIME = runtime;

    runtime.dispose = () => {
      if (runtime.disposed) return;
      runtime.disposed = true;
      if (runtime.selection && typeof runtime.selection.dispose === "function") {
        runtime.selection.dispose();
      }
      runtime.selection = null;
      if (runtime.observer) {
        runtime.observer.disconnect();
      }
      runtime.observer = null;
      if (runtime.pollTimer) {
        window.clearInterval(runtime.pollTimer);
      }
      runtime.pollTimer = 0;
      if (runtime.mutationTimer) {
        window.clearTimeout(runtime.mutationTimer);
      }
      runtime.mutationTimer = 0;
      if (runtime.rerunTimer) {
        window.clearTimeout(runtime.rerunTimer);
      }
      runtime.rerunTimer = 0;
      if (runtime.pageClickHandler) {
        document.removeEventListener("click", runtime.pageClickHandler, true);
      }
      runtime.pageClickHandler = null;
      clearAllRowAnnotations();
      const panelHost = document.getElementById("wwp-listings-panel");
      if (panelHost) panelHost.remove();
      const launcher = document.getElementById("wwp-listings-panel-launcher");
      if (launcher) launcher.remove();
    };

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

    const tabIds = ["overview", "selected", "search", "rankings", "flags"];
    const clearTabs = () => {
      tabIds.forEach((id) => tabs.clearTab(id));
    };

    function scheduleRerun(reason) {
      if (runtime.disposed || runtime.rerunTimer) return;
      panel.setSubtitle(`Detected listings update (${reason})... refreshing`);
      runtime.rerunTimer = window.setTimeout(() => {
        runtime.rerunTimer = 0;
        if (runtime.disposed) return;
        run().catch((error) => {
          console.error("WaterlooWorks+ listings refresh failed", error);
        });
      }, 450);
    }

    function checkForListingsChange(reason) {
      if (runtime.disposed) return;
      const latest = findJobRows();
      if (!latest.jobs.length) return;
      const nextSignature = computeJobSetSignature(latest.jobs);
      if (!nextSignature || nextSignature === runtime.currentSignature) return;
      runtime.currentSignature = nextSignature;
      scheduleRerun(reason);
    }

    function installRefreshWatchers(container) {
      if (runtime.disposed) return;
      const watchRoot = (container && container.parentElement) || container || document.body;
      runtime.observer = new MutationObserver(() => {
        if (runtime.disposed) return;
        if (runtime.mutationTimer) {
          window.clearTimeout(runtime.mutationTimer);
        }
        runtime.mutationTimer = window.setTimeout(() => {
          runtime.mutationTimer = 0;
          checkForListingsChange("table mutation");
        }, 320);
      });
      runtime.observer.observe(watchRoot, { childList: true, subtree: true, characterData: true });

      runtime.pollTimer = window.setInterval(() => {
        checkForListingsChange("periodic check");
      }, 1800);

      runtime.pageClickHandler = (event) => {
        if (runtime.disposed) return;
        const target = event.target;
        if (!(target instanceof Element)) return;
        const clickable = target.closest("a, button, [role='button'], li");
        if (!clickable) return;

        const label = ns.normalizeText(clickable.textContent || "");
        const aria = String(clickable.getAttribute("aria-label") || "").toLowerCase();
        const cls = String(clickable.className || "").toLowerCase();
        const looksLikePager =
          /^\d+$/.test(label) ||
          /(page|next|previous|pagination|pager)/.test(aria) ||
          /(pagination|pager|page-item|page-link)/.test(cls);
        if (!looksLikePager) return;

        window.setTimeout(() => checkForListingsChange("page click"), 280);
        window.setTimeout(() => checkForListingsChange("page click"), 1000);
      };
      document.addEventListener("click", runtime.pageClickHandler, true);
    }

    const found = await waitForJobRows(panel, 30, 650);
    const jobs = found.jobs;
    const container = found.container;
    runtime.currentSignature = computeJobSetSignature(jobs);
    installRefreshWatchers(container);

    if (!jobs.length) {
      clearTabs();
      const summaryCard = ns.makeCard("Status");
      summaryCard.innerHTML +=
        '<p class="wwp-inline-note">No job rows were detected in the main results container yet. Try toggling table filters or refreshing.</p>';
      tabs.appendToTab("overview", summaryCard);
      panel.setSubtitle("No listings detected");
      return;
    }

    ensureInlineStyles();
    clearAllRowAnnotations();
    clearTabs();

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
    metrics.appendChild(ns.makeProgressMetric("Target Role Match", top.targetRoleMatch || 0));
    metrics.appendChild(ns.makeProgressMetric("Overall Match", top.overallMatch || 0));

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
    runtime.selection = selection;
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

  if (IS_BACKGROUND_PROBE_TAB) {
    installProbeMessageListener();
    return;
  }

  (async () => {
    try {
      const settings = await ns.getSettings();
      if (!settings.enabled) return;
      if (!ns.isFeatureEnabled(settings, "smartOverlay")) return;
      installProbeMessageListener();
      await run();
    } catch (error) {
      console.error("WaterlooWorks+ listings script failed", error);
    }
  })();
})(globalThis);
