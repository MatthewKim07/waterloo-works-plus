/**
 * WaterlooWorks-oriented patterns. Keep raw strings here; behavior lives in ww-dom-adapter.js.
 */
(function initWwSelectors(global) {
  const ns = (global.WWP = global.WWP || {});

  ns.WW_SELECTORS = {
    jobLinkBroad: "a[href*='job'], a[href*='posting'], a[href*='position']",
    tableRowCells: "table tr td",
    rowLike: "tr, .job-row, .posting-row, .job-listing-item, li, [role='row'], .row",
    sidebarLike: "nav, aside, [role='navigation'], .sidebar, .left-nav, .menu, .navbar"
  };

  ns.WW_PATH_PATTERNS = {
    coopJobsHtm: /\/myaccount\/co-op\/(direct|fullcycle|full-cycle)\/jobs\.htm/i,
    coopJobsAny: /\/myaccount\/co-op\/.*jobs/i,
    coopBase: /\/myaccount\/co-op\//i,
    workTermRatings: /worktermratings/i,
    jobPostingPath: /\/job\/|\/posting\//i,
    jobQuery: /jobid=|postingid=|\/posting\//i
  };
})(globalThis);
