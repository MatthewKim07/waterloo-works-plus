/**
 * Single place for "what kind of WW page is this" and coop-list eligibility.
 * Listings row discovery stays in listings.js for now (too big to move in one pass).
 */
(function initWwDomAdapter(global) {
  const ns = (global.WWP = global.WWP || {});
  const sel = ns.WW_SELECTORS || {};
  const pat = ns.WW_PATH_PATTERNS || {};

  function lower(value) {
    return String(value || "").toLowerCase();
  }

  /**
   * @param {Document} doc
   * @param {Location|{pathname:string,search?:string}} loc
   * @returns {'ratings'|'posting'|'listings'|'unknown'}
   */
  function detectPageType(doc, locationLike) {
    const currentDoc = doc || (typeof document !== "undefined" ? document : null);
    if (!currentDoc) return "unknown";

    const loc = locationLike || (typeof location !== "undefined" ? location : { pathname: "", search: "" });
    const url = `${loc.pathname} ${loc.search || ""}`.toLowerCase();
    const bodyText = lower(currentDoc.body ? currentDoc.body.textContent : "");
    const title = lower(currentDoc.title || "");
    const pathname = String(loc.pathname || "").toLowerCase();

    if (
      /work\s*term\s*ratings|ratings/.test(title) ||
      (bodyText.includes("students hired") && bodyText.includes("work term")) ||
      (pat.workTermRatings && pat.workTermRatings.test(pathname))
    ) {
      return "ratings";
    }

    if (
      /job\s*posting|position\s*description/.test(title) ||
      (pat.jobQuery && pat.jobQuery.test(url)) ||
      (pat.jobPostingPath && pat.jobPostingPath.test(pathname))
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

    if (/\/jobs|\/postings|search/.test(url)) {
      return "listings";
    }

    const q = sel.jobLinkBroad || "a[href*='job']";
    const postingLinkCount = currentDoc.querySelectorAll(q).length;
    if (postingLinkCount >= 8) {
      return "listings";
    }

    return "unknown";
  }

  /**
   * @param {Location|{pathname:string}} [locationLike]
   * @param {Document} [doc]
   */
  function isSupportedCoopListingsPage(locationLike, doc) {
    const loc = locationLike || (typeof location !== "undefined" ? location : { pathname: "" });
    const currentDoc = doc || (typeof document !== "undefined" ? document : null);
    const pathname = String(loc.pathname || "").toLowerCase();

    if (!pat.coopBase || !pat.coopBase.test(pathname)) return false;
    if (pat.coopJobsHtm && pat.coopJobsHtm.test(pathname)) return true;
    if (pat.coopJobsAny && pat.coopJobsAny.test(pathname)) return true;

    if (!currentDoc || !currentDoc.body) return false;
    const bodyText = String(currentDoc.body.textContent || "").toLowerCase();
    const hasJobTable = !!currentDoc.querySelector(sel.tableRowCells || "table tr td");
    if (hasJobTable && /(job search|job title|organization|openings)/.test(bodyText)) {
      return true;
    }

    return false;
  }

  /**
   * Best-effort signal for telemetry / UI ("WW layout looks like we expect").
   */
  function health(doc, locationLike) {
    const currentDoc = doc || (typeof document !== "undefined" ? document : null);
    const loc = locationLike || (typeof location !== "undefined" ? location : { pathname: "" });
    const pageType = detectPageType(currentDoc, loc);
    const listingsOk = pageType === "listings" ? isSupportedCoopListingsPage(loc, currentDoc) : null;
    const anchorCount = currentDoc ? currentDoc.querySelectorAll(sel.jobLinkBroad || "a[href*='job']").length : 0;

    return {
      pageType,
      coopListingsSupported: listingsOk,
      jobAnchorCount: anchorCount,
      degraded: pageType === "listings" && listingsOk === false
    };
  }

  ns.wwDomAdapter = {
    detectPageType,
    isSupportedCoopListingsPage,
    health
  };
})(globalThis);
