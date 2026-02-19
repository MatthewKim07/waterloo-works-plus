(function initRatingsParser(global) {
  const ns = (global.WWP = global.WWP || {});

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function toPercentEntries(items) {
    const dedup = new Map();
    for (const item of items) {
      if (!item || !item.label || !Number.isFinite(item.percent)) continue;
      const key = item.label.toLowerCase();
      if (!dedup.has(key) || dedup.get(key).percent < item.percent) {
        dedup.set(key, {
          label: item.label,
          percent: ns.clamp(item.percent, 0, 100)
        });
      }
    }
    return Array.from(dedup.values()).sort((a, b) => b.percent - a.percent);
  }

  function parseLabelPercent(text) {
    const clean = ns.normalizeText(text);
    if (!clean) return null;

    let m = clean.match(/^(.+?)\s*[:\-]\s*(\d+(?:\.\d+)?)\s*%$/);
    if (m) {
      return { label: m[1].trim(), percent: Number(m[2]) };
    }

    m = clean.match(/^(\d+(?:\.\d+)?)\s*%\s*(.+)$/);
    if (m) {
      return { label: m[2].trim(), percent: Number(m[1]) };
    }

    m = clean.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*%$/);
    if (m) {
      return { label: m[1].trim(), percent: Number(m[2]) };
    }

    return null;
  }

  function parseFromAria(container) {
    return Array.from(container.querySelectorAll("[aria-label]"))
      .map((el) => parseLabelPercent(el.getAttribute("aria-label")))
      .filter(Boolean);
  }

  function parseFromVisibleLegend(container) {
    const nodes = container.querySelectorAll("li, span, div, p, text");
    const entries = [];
    for (const node of nodes) {
      const txt = ns.getTextFromElement(node);
      if (!txt.includes("%") || txt.length > 80 || txt.length < 3) continue;
      const parsed = parseLabelPercent(txt);
      if (parsed) entries.push(parsed);
    }
    return entries;
  }

  function findSectionsByHeading(doc, headingRegex) {
    const candidates = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, strong, .title, .panel-title, .card-title"));
    return candidates
      .filter((node) => headingRegex.test(ns.getTextFromElement(node).toLowerCase()))
      .map((node) => node.closest("section, .panel, .card, .tab-pane, .content, div") || doc.body);
  }

  function parseFromScriptBlocks(doc, contextWord) {
    const scripts = Array.from(doc.querySelectorAll("script"));
    const out = [];

    for (const script of scripts) {
      const txt = script.textContent || "";
      if (!txt || !new RegExp(escapeRegex(contextWord), "i").test(txt)) continue;
      const labelsMatch = txt.match(/labels\s*[:=]\s*\[([^\]]+)\]/i);
      const dataMatch = txt.match(/data\s*[:=]\s*\[([^\]]+)\]/i);
      if (!labelsMatch || !dataMatch) continue;

      const labels = labelsMatch[1]
        .split(",")
        .map((x) => x.replace(/["'`]/g, "").trim())
        .filter(Boolean);
      const values = dataMatch[1]
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((x) => Number.isFinite(x));

      const total = values.reduce((sum, v) => sum + v, 0);
      if (!labels.length || !values.length || total <= 0) continue;

      for (let i = 0; i < Math.min(labels.length, values.length); i += 1) {
        out.push({
          label: labels[i],
          percent: (values[i] / total) * 100
        });
      }
    }

    return out;
  }

  function keepTermLabels(entries) {
    return entries.filter((x) => /(work\s*term|\bterm\b|\bwt\b|\b[1-9]\b)/i.test(x.label));
  }

  function keepFacultyLabels(entries) {
    return entries.filter(
      (x) => /(engineering|math|arts|science|environment|health|faculty)/i.test(x.label) || x.label.length <= 24
    );
  }

  function parseTableRows(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const results = [];

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("th, td"));
      if (cells.length < 2) continue;

      const rawValues = cells.map((cell) => ns.getTextFromElement(cell));
      if (rawValues.some((v) => /students\s*hired/i.test(v))) continue;

      const hiresCell = rawValues.find((v) => /^\d+$/.test(v.replace(/,/g, "")) || /\d+/.test(v));
      const hires = ns.numberFromText(hiresCell);
      if (!Number.isFinite(hires)) continue;

      const term = rawValues[0] || rawValues.find((v) => /(fall|winter|spring|term)/i.test(v)) || "Unknown";
      results.push({ term, hires: Math.max(0, Math.round(hires)) });
    }

    return results;
  }

  function parseStudentsHiredTable(doc) {
    const tables = Array.from(doc.querySelectorAll("table"));
    for (const table of tables) {
      const text = ns.getTextFromElement(table).toLowerCase();
      if (!text) continue;
      if (!/students\s*hired/.test(text) && !/hired/.test(text)) continue;
      const rows = parseTableRows(table);
      if (rows.length >= 3) {
        return rows.slice(0, 18);
      }
    }
    return [];
  }

  function parseDistribution(doc, sectionRegex, contextWord, labelFilter) {
    let entries = [];
    const sections = findSectionsByHeading(doc, sectionRegex);

    for (const section of sections) {
      entries = entries.concat(parseFromAria(section));
      entries = entries.concat(parseFromVisibleLegend(section));
    }

    if (!entries.length) {
      entries = entries.concat(parseFromAria(doc));
      entries = entries.concat(parseFromVisibleLegend(doc));
    }

    entries = entries.concat(parseFromScriptBlocks(doc, contextWord));
    entries = labelFilter(entries);

    return toPercentEntries(entries).slice(0, 20);
  }

  ns.parseRatingsPage = function parseRatingsPage(docLike) {
    const doc =
      typeof Document !== "undefined" && docLike instanceof Document
        ? docLike
        : new DOMParser().parseFromString(String(docLike || ""), "text/html");

    const termDist = parseDistribution(doc, /(work\s*term|hires\s*by\s*term)/i, "work term", keepTermLabels);
    const facultyDist = parseDistribution(doc, /(faculty|hires\s*by\s*faculty)/i, "faculty", keepFacultyLabels);
    const hiresByTermTable = parseStudentsHiredTable(doc);

    return {
      termDist,
      facultyDist,
      hiresByTermTable,
      chartDataUnavailable: {
        term: termDist.length === 0,
        faculty: facultyDist.length === 0
      }
    };
  };
})(globalThis);
