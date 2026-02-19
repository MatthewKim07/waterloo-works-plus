(function initUtils(global) {
  const ns = (global.WWP = global.WWP || {});

  ns.clamp = function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  };

  ns.normalizeText = function normalizeText(input) {
    return String(input || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  ns.normalizeToken = function normalizeToken(token) {
    return String(token || "")
      .toLowerCase()
      .replace(/[^a-z0-9#+.\-/ ]+/g, "")
      .trim();
  };

  ns.simpleStem = function simpleStem(token) {
    const word = ns.normalizeToken(token);
    if (word.length <= 3) return word;
    return word
      .replace(/(ing|edly|edly|edly|ed|ly|es|s)$/i, "")
      .replace(/\btechnolog\b/i, "technology");
  };

  ns.tokenize = function tokenize(input) {
    const clean = ns.normalizeText(input).toLowerCase();
    if (!clean) return [];
    return clean
      .split(/[^a-z0-9#+.\-/]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  };

  ns.generateNgrams = function generateNgrams(tokens, minN, maxN) {
    const grams = [];
    const lo = Number.isFinite(minN) ? minN : 1;
    const hi = Number.isFinite(maxN) ? maxN : 3;
    for (let n = lo; n <= hi; n += 1) {
      for (let i = 0; i <= tokens.length - n; i += 1) {
        grams.push(tokens.slice(i, i + n).join(" "));
      }
    }
    return grams;
  };

  ns.unique = function unique(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  };

  ns.toSentenceList = function toSentenceList(text) {
    const normalized = ns.normalizeText(text);
    if (!normalized) return [];
    return normalized
      .split(/(?<=[.!?])\s+|\n+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  ns.percentFromText = function percentFromText(text) {
    const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*%/);
    return match ? Number(match[1]) : null;
  };

  ns.numberFromText = function numberFromText(text) {
    const match = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  };

  ns.wait = function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  ns.runWithConcurrency = async function runWithConcurrency(items, limit, worker) {
    const max = Math.max(1, Number(limit) || 1);
    const list = Array.isArray(items) ? items : [];
    const results = new Array(list.length);
    let index = 0;

    async function consume() {
      while (index < list.length) {
        const i = index;
        index += 1;
        try {
          results[i] = await worker(list[i], i);
        } catch (error) {
          results[i] = { error: String(error && error.message ? error.message : error) };
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(max, list.length) }, consume));
    return results;
  };

  ns.getTextFromElement = function getTextFromElement(element) {
    if (!element) return "";
    return ns.normalizeText(element.textContent || "");
  };

  ns.csvToArray = function csvToArray(text) {
    return String(text || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  };
})(globalThis);
