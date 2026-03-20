/**
 * Stable keys for the same job across overlay, cache, and tracker.
 */
(function initJobIdentity(global) {
  const ns = (global.WWP = global.WWP || {});

  function normalizePostingUrl(urlLike, originLike) {
    const origin = originLike || (typeof location !== "undefined" ? location.origin : "");
    try {
      const u = new URL(String(urlLike || ""), origin);
      u.hash = "";
      const sp = u.searchParams;
      ["wwp_probe", "sessionId", "conversationId"].forEach((k) => {
        try {
          sp.delete(k);
        } catch (_e) {}
      });
      return u.href;
    } catch (_e) {
      return String(urlLike || "").trim();
    }
  }

  /**
   * Prefer WW job id, then canonical posting URL, then fallback label (caller passes row index etc.).
   */
  function makeJobKey({ jobId, postingUrl, fallback } = {}) {
    const id = String(jobId || "").trim();
    if (id) return `jid:${id}`;
    const url = normalizePostingUrl(postingUrl);
    if (url) return `url:${url}`;
    const fb = String(fallback || "").trim();
    if (fb) return `fb:${fb}`;
    return `fb:unknown-${Date.now()}`;
  }

  ns.jobIdentity = {
    normalizePostingUrl,
    makeJobKey
  };
})(globalThis);
