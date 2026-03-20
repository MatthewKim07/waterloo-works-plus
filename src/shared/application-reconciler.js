(function initApplicationReconciler(global) {
  const ns = (global.WWP = global.WWP || {});

  function inferStatusFromRowText(text) {
    const t = String(text || "").toLowerCase();
    if (/schedule|interview|screening/.test(t)) return ns.applicationStore.STATUS.INTERVIEW;
    if (/\boffer\b|extended an offer/.test(t)) return ns.applicationStore.STATUS.OFFER;
    if (/not selected|rejected|declined|cancelled|no longer|filled/.test(t)) return ns.applicationStore.STATUS.REJECTED;
    return null;
  }

  /**
   * Best-effort: scan job links in tables; if we already track that job, merge visible status text.
   */
  async function reconcileFromPage(doc, loc) {
    if (!ns.applicationStore || !ns.jobIdentity) return { updated: 0 };
    const origin = loc && loc.origin ? loc.origin : "";
    const anchors = (doc || document).querySelectorAll("a[href*='job'], a[href*='posting'], a[href*='JobID']");
    let updated = 0;
    const seen = new Set();

    for (const a of anchors) {
      const href = a.getAttribute("href") || "";
      if (!href) continue;
      let absolute;
      try {
        absolute = new URL(href, origin || location.origin).href;
      } catch (_e) {
        continue;
      }
      const row = a.closest("tr");
      if (!row) continue;
      const jobKey = ns.jobIdentity.makeJobKey({ postingUrl: absolute, fallback: href });
      if (seen.has(jobKey)) continue;
      seen.add(jobKey);

      const existing = await ns.applicationStore.getByJobKey(jobKey);
      if (!existing) continue;

      const status = inferStatusFromRowText(row.textContent || "");
      if (!status || status === existing.status) continue;

      await ns.applicationStore.appendEvent(existing.id, {
        type: "ww-table",
        at: Date.now(),
        source: "reconciler",
        setStatus: status
      });
      updated += 1;
    }
    return { updated };
  }

  ns.applicationReconciler = { reconcileFromPage, inferStatusFromRowText };
})(globalThis);
