(function initResumeParser(global) {
  const ns = (global.WWP = global.WWP || {});
  let cachedPdfJsModulePromise = null;

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function countPattern(text, pattern) {
    const match = text.match(pattern);
    return match ? match.length : 0;
  }

  function sortMapByValue(map) {
    return new Map(Array.from(map.entries()).sort((a, b) => b[1] - a[1]));
  }

  const BROAD_SKILL_DAMPENERS = {
    "rest api": 0.62,
    "software engineering": 0.72,
    "backend engineering": 0.76,
    "full stack": 0.78,
    "data analysis": 0.78,
    communication: 0.45,
    leadership: 0.5,
    "problem solving": 0.55,
    agile: 0.75
  };

  const PDF_ARTIFACT_REPLACEMENTS = [
    [/\bTECHNICALSKILLS\b/gi, "TECHNICAL SKILLS"],
    [/\bFRAMEWORKS\s*&\s*LIBRARIES\b/gi, "Frameworks & Libraries"],
    [/\bTailwin\s+d\b/gi, "Tailwind"],
    [/\bDocke\s+r\b/gi, "Docker"],
    [/\bSupabas\s+e\b/gi, "Supabase"],
    [/\bIntegrat\s+e\b/gi, "Integrate"],
    [/\bCollaborat\s+ed\b/gi, "Collaborated"],
    [/\biterati\s+ve\b/gi, "iterative"],
    [/\bpri\s+nter\b/gi, "printer"],
    [/\bPantry\s+Pa\s+l\b/gi, "Pantry Pal"],
    [/\bFide\s+x\b/gi, "Fidex"],
    [/\bun\s+available\b/gi, "unavailable"]
  ];

  function normalizeForCompactMatch(input) {
    return String(input || "")
      .toLowerCase()
      .replace(/[^a-z0-9#+]/g, "");
  }

  function normalizeResumeText(input) {
    let text = String(input || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ");

    // Merge hard-wrapped hyphenations from PDF/docx layout.
    text = text
      .replace(/([A-Za-z]{2,})-\n([a-z]{2,})/g, "$1-$2")
      .replace(/([A-Za-z]{2,})\n([a-z]{2,})/g, "$1 $2")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Add readable section boundaries for common resume headings.
    text = text.replace(
      /\b(TECHNICAL SKILLS|SKILLS|EXPERIENCE|WORK EXPERIENCE|PROJECTS|EDUCATION|SUMMARY)\b/g,
      "\n$1\n"
    );
    text = text.replace(/\n{3,}/g, "\n\n").trim();

    return text;
  }

  function extractTechnicalSection(text) {
    const source = String(text || "");
    const start = source.search(/\btechnical\s*skills\b/i);
    if (start < 0) return "";
    const window = source.slice(start, start + 2500);
    const end = window.search(/\b(experience|work experience|projects|education)\b/i);
    return end > 0 ? window.slice(0, end) : window;
  }

  function buildSkillAliasIndex() {
    const byNormalized = new Map();
    const byCompact = new Map();

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const key = String(entry && entry.key ? entry.key : "").trim();
      if (!key) continue;
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];

      for (const aliasRaw of aliases) {
        const alias = ns.normalizeToken(aliasRaw);
        if (!alias) continue;

        if (!byNormalized.has(alias)) byNormalized.set(alias, new Set());
        byNormalized.get(alias).add(key);

        const compact = normalizeForCompactMatch(alias);
        if (compact.length >= 3) {
          if (!byCompact.has(compact)) byCompact.set(compact, new Set());
          byCompact.get(compact).add(key);
        }
      }
    }

    return { byNormalized, byCompact };
  }

  function collectLookupKeys(set) {
    return set ? Array.from(set) : [];
  }

  function resolveSkillKeysFromCandidate(candidate, aliasIndex) {
    const out = new Set();
    const candidateText = String(candidate || "").trim();
    if (!candidateText) return out;

    const norm = ns.normalizeToken(candidateText);
    if (!norm) return out;

    const variants = new Set([norm]);
    if (norm.endsWith("s") && norm.length > 4) variants.add(norm.replace(/s$/, ""));
    variants.add(norm.replace(/\s*\/\s*/g, "/"));
    variants.add(norm.replace(/\s*-\s*/g, "-"));

    for (const variant of variants) {
      for (const key of collectLookupKeys(aliasIndex.byNormalized.get(variant))) {
        out.add(key);
      }
      const compact = normalizeForCompactMatch(variant);
      for (const key of collectLookupKeys(aliasIndex.byCompact.get(compact))) {
        out.add(key);
      }
    }

    return out;
  }

  function extractDelimitedSkillCandidates(technicalSectionRaw) {
    const source = String(technicalSectionRaw || "");
    if (!source) return [];

    const cleaned = source
      .replace(/\u2022|•|·|▪|◦|●/g, ", ")
      .replace(/\b(technical skills|languages|frameworks\s*&\s*libraries|frameworks|libraries|tools|technologies|platforms|databases)\s*:/gi, "\n")
      .replace(/\s+[|]\s+/g, ", ")
      .replace(/\s{2,}/g, " ");

    const parts = cleaned
      .split(/[\n,;]+/g)
      .map((part) => part.trim())
      .filter(Boolean);

    const candidates = [];
    for (const part of parts) {
      if (part.length < 2 || part.length > 80) continue;
      candidates.push(part);

      // Split slash-separated list segments when they are likely separate items.
      if (/\s\/\s/.test(part) && !/c\/c\+\+|can\/lin/i.test(part)) {
        for (const sub of part.split(/\s\/\s/)) {
          const value = sub.trim();
          if (value && value.length >= 2) candidates.push(value);
        }
      }
    }

    return candidates;
  }

  function normalizePdfArtifacts(input) {
    let text = String(input || "");
    for (const [pattern, replacement] of PDF_ARTIFACT_REPLACEMENTS) {
      text = text.replace(pattern, replacement);
    }

    // Re-join common PDF split fragments:
    // "Docke r" -> "Docker", "Integrat e" -> "Integrate".
    text = text.replace(/\b([A-Za-z]{4,})\s+([b-hj-z])\b/g, "$1$2");
    text = text.replace(/\b([A-Za-z]{4,})\s+(ed|er|ers|ing|ive|ion|ions|al|ally|ment|ments|able|ably)\b/gi, "$1$2");
    text = text.replace(/\bun\s+([a-z]{4,})\b/g, "un$1");
    text = text.replace(
      /linkedin\.com\/in\/([a-z0-9]+)\s*-\s*([a-z0-9]+)\s*-\s*([a-z0-9]+)/gi,
      "linkedin.com/in/$1-$2-$3"
    );

    // Common PDF glyph substitutions: standalone "x" bullets and mangled dash separators.
    text = text.replace(/(?:^|[\n.])\s*[xX]\s+(?=[A-Z])/g, (match) => match.replace(/[xX]\s+/, " - "));
    text = text.replace(/\s+[xX]\s+(?=[A-Za-z])/g, " - ");
    text = text.replace(
      /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})\s+[tT]\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present|Current)\b/gi,
      "$1 - $2"
    );
    text = text.replace(/\b([A-Za-z]{3,})\s+t\s+(University|College|Institute|School)\b/g, "$1 - $2");
    text = text.replace(/\bPresen-\b/gi, "Present ");

    // Tighten spaced hyphen compounds: "long - term" -> "long-term".
    text = text.replace(/\b([A-Za-z]{2,})\s*-\s*([A-Za-z]{2,})\b/g, "$1-$2");
    text = text.replace(/\b([A-Za-z]+(?:-[A-Za-z]+)+)\s*-\s*([A-Za-z]{2,})\b/g, "$1-$2");
    return text;
  }

  ns.parseResume = function parseResume(text) {
    const cleanedResumeText = normalizeResumeText(normalizePdfArtifacts(text));
    const rawText = cleanedResumeText;
    const lower = ns.normalizeText(cleanedResumeText).toLowerCase();
    const tokens = ns.tokenize(lower);
    const ngrams = ns.generateNgrams(tokens, 1, 3);
    const compactResume = normalizeForCompactMatch(lower);
    const technicalSectionRaw = extractTechnicalSection(cleanedResumeText);
    const technicalSection = technicalSectionRaw.toLowerCase();
    const aliasIndex = buildSkillAliasIndex();
    const sectionCandidates = extractDelimitedSkillCandidates(technicalSectionRaw);
    const sectionCandidateBoosts = new Map();

    for (const candidate of sectionCandidates) {
      const keys = resolveSkillKeysFromCandidate(candidate, aliasIndex);
      for (const key of keys) {
        sectionCandidateBoosts.set(key, (sectionCandidateBoosts.get(key) || 0) + 1);
      }
    }

    const gramCount = new Map();
    for (const gram of ngrams) {
      gramCount.set(gram, (gramCount.get(gram) || 0) + 1);
    }

    const scores = new Map();
    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const baseWeight = Number(entry.baseWeight || 1);
      let skillScore = 0;

      for (const alias of entry.aliases || []) {
        const normalizedAlias = ns.normalizeToken(alias);
        if (!normalizedAlias) continue;

        const aliasRegex = new RegExp(`\\b${escapeRegex(normalizedAlias)}\\b`, "g");
        const exactHits = countPattern(lower, aliasRegex);
        const gramHits = gramCount.get(normalizedAlias) || 0;
        const sectionHits = technicalSection ? countPattern(technicalSection, aliasRegex) : 0;
        const lexicalHits = exactHits * 1.25 + gramHits;

        let compactFallbackHits = 0;
        const compactAlias = normalizeForCompactMatch(normalizedAlias);
        const compactEligible = /[+#/.\-\s]/.test(String(alias || "")) || compactAlias.length >= 6;
        if (compactEligible && compactResume && compactAlias) {
          const compactRegex = new RegExp(escapeRegex(compactAlias), "g");
          const compactHitsRaw = countPattern(compactResume, compactRegex);
          if (compactHitsRaw > 0) {
            if (lexicalHits <= 0) {
              compactFallbackHits = compactHitsRaw * 0.9;
            } else if (compactHitsRaw > lexicalHits) {
              compactFallbackHits = (compactHitsRaw - lexicalHits) * 0.4;
            }
          }
        }

        const sectionBoost = sectionHits > 0 ? sectionHits * 0.9 : 0;
        if (lexicalHits > 0 || compactFallbackHits > 0 || sectionBoost > 0) {
          skillScore += (lexicalHits + compactFallbackHits + sectionBoost) * baseWeight;
        }
      }

      const explicitSectionHits = sectionCandidateBoosts.get(entry.key) || 0;
      if (explicitSectionHits > 0) {
        skillScore += explicitSectionHits * 2.2 * baseWeight;
      }

      if (skillScore > 0) {
        const dampener = BROAD_SKILL_DAMPENERS[entry.key] || 1;
        scores.set(entry.key, Number((skillScore * dampener).toFixed(2)));
      }
    }

    return {
      rawText,
      skills: sortMapByValue(scores)
    };
  };

  async function readStreamToArrayBuffer(stream) {
    return new Response(stream).arrayBuffer();
  }

  function getFflateLib() {
    const lib = global && global.fflate;
    if (!lib || typeof lib !== "object") return null;
    return lib;
  }

  function toUint8Array(input) {
    if (input instanceof Uint8Array) return input;
    if (input && input.buffer instanceof ArrayBuffer) {
      return new Uint8Array(input.buffer, input.byteOffset || 0, input.byteLength || input.length || 0);
    }
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    return new Uint8Array(0);
  }

  function getRuntimeUrl(path) {
    const cleanPath = String(path || "").replace(/^\/+/, "");
    if (global.chrome && global.chrome.runtime && typeof global.chrome.runtime.getURL === "function") {
      return global.chrome.runtime.getURL(cleanPath);
    }
    return `/${cleanPath}`;
  }

  function resolvePdfJsModule(nsModule) {
    if (!nsModule || typeof nsModule !== "object") return null;
    if (typeof nsModule.getDocument === "function") return nsModule;
    if (nsModule.default && typeof nsModule.default.getDocument === "function") return nsModule.default;
    if (nsModule.pdfjsLib && typeof nsModule.pdfjsLib.getDocument === "function") return nsModule.pdfjsLib;
    return null;
  }

  async function loadPdfJsModule() {
    if (cachedPdfJsModulePromise) return cachedPdfJsModulePromise;

    if (global.pdfjsLib && typeof global.pdfjsLib.getDocument === "function") {
      cachedPdfJsModulePromise = Promise.resolve(global.pdfjsLib);
      return cachedPdfJsModulePromise;
    }

    const moduleUrl = getRuntimeUrl("src/vendor/pdf.mjs");
    cachedPdfJsModulePromise = import(moduleUrl)
      .then((nsModule) => {
        const resolved = resolvePdfJsModule(nsModule);
        if (!resolved) {
          throw new Error("pdf.js module loaded but getDocument() was not found");
        }
        return resolved;
      })
      .catch((error) => {
        cachedPdfJsModulePromise = null;
        throw error;
      });

    return cachedPdfJsModulePromise;
  }

  async function inflateDeflateRaw(uint8) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Blob([uint8]).stream().pipeThrough(ds);
        const ab = await readStreamToArrayBuffer(stream);
        return new Uint8Array(ab);
      } catch (_error) {
        // fall back to fflate below
      }
    }

    const fflate = getFflateLib();
    if (fflate && typeof fflate.inflateSync === "function") {
      try {
        return toUint8Array(fflate.inflateSync(uint8));
      } catch (_error) {
        // keep falling through to final throw
      }
    }

    throw new Error("Deflate-raw decompression unavailable in this browser");
  }

  async function inflateDeflate(uint8) {
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate");
        const stream = new Blob([uint8]).stream().pipeThrough(ds);
        const ab = await readStreamToArrayBuffer(stream);
        return new Uint8Array(ab);
      } catch (_error) {
        // fall back to fflate below
      }
    }

    const fflate = getFflateLib();
    if (fflate) {
      if (typeof fflate.unzlibSync === "function") {
        try {
          return toUint8Array(fflate.unzlibSync(uint8));
        } catch (_error) {
          // try inflateSync next
        }
      }
      if (typeof fflate.inflateSync === "function") {
        try {
          return toUint8Array(fflate.inflateSync(uint8));
        } catch (_error) {
          // fall through to final throw
        }
      }
    }

    throw new Error("Deflate decompression unavailable in this browser");
  }

  function uint8ToString(uint8) {
    return new TextDecoder("utf-8", { fatal: false }).decode(uint8);
  }

  async function extractDocxText(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const dv = new DataView(arrayBuffer);
    let offset = 0;

    while (offset + 30 < bytes.length) {
      const signature = dv.getUint32(offset, true);
      if (signature !== 0x04034b50) {
        offset += 1;
        continue;
      }

      const flags = dv.getUint16(offset + 6, true);
      const method = dv.getUint16(offset + 8, true);
      const compSize = dv.getUint32(offset + 18, true);
      const fileNameLen = dv.getUint16(offset + 26, true);
      const extraLen = dv.getUint16(offset + 28, true);

      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLen;
      const fileName = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(nameStart, nameEnd));

      const dataStart = nameEnd + extraLen;
      if (flags & 0x08) {
        throw new Error("DOCX parsing failed: unsupported ZIP data descriptor format");
      }

      const dataEnd = dataStart + compSize;
      if (dataEnd > bytes.length) {
        break;
      }

      if (fileName === "word/document.xml") {
        let xmlBytes = bytes.slice(dataStart, dataEnd);
        if (method === 8) {
          xmlBytes = await inflateDeflateRaw(xmlBytes);
        } else if (method !== 0) {
          throw new Error(`DOCX compression method ${method} is not supported`);
        }

        const xmlText = uint8ToString(xmlBytes);
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");
        const paragraphs = Array.from(xmlDoc.getElementsByTagName("w:p"));
        const paragraphTexts = [];

        for (const para of paragraphs) {
          const runs = Array.from(para.getElementsByTagName("w:t"));
          const line = runs
            .map((node) => node.textContent || "")
            .join("")
            .trim();
          if (line) paragraphTexts.push(line);
        }

        // Fallback for unusual DOCX structures.
        if (!paragraphTexts.length) {
          const nodes = Array.from(xmlDoc.getElementsByTagName("w:t"));
          const fallbackText = nodes.map((node) => node.textContent || "").join(" ");
          return normalizeResumeText(fallbackText);
        }

        return normalizeResumeText(paragraphTexts.join("\n"));
      }

      offset = dataEnd;
    }

    throw new Error("DOCX parsing failed: word/document.xml not found");
  }

  function latin1ToUint8(text) {
    const src = String(text || "");
    const bytes = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i += 1) {
      bytes[i] = src.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function sanitizePdfText(text) {
    let out = String(text || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " ");

    // Collapse spaced single-letter sequences ("M a t t h e w" -> "Matthew")
    out = out.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (match) => match.replace(/\s+/g, ""));

    // Normalize common PDF bullet artifacts and spacing noise.
    out = out
      .replace(/[•·▪◦●]/g, " ")
      .replace(/\s+[|]\s+/g, " | ")
      .replace(/\b(\d{3})\s+(\d)\b/g, "$1$2")
      .replace(/\b([B-HJ-Z])\s+([a-z]{4,})\b/g, "$1$2")
      .replace(/\b(\d{4})\s+[tT]\s+(Present|Current)\b/g, "$1 - $2")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\s{2,}/g, " ");

    out = normalizePdfArtifacts(out);
    return normalizeResumeText(out);
  }

  function buildPdfPageText(items) {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return "";

    const lines = [];
    let current = null;
    const lineTolerance = 2.4;

    function flushCurrent() {
      if (!current) return;
      const lineText = String(current.text || "").trim();
      if (lineText) lines.push(lineText);
      current = null;
    }

    for (const item of list) {
      const str = item && typeof item.str === "string" ? item.str : "";
      if (!str) continue;
      const transform = item && Array.isArray(item.transform) ? item.transform : null;
      const x = transform && Number.isFinite(transform[4]) ? transform[4] : null;
      const y = transform && Number.isFinite(transform[5]) ? transform[5] : null;
      const width = item && Number.isFinite(item.width) ? item.width : str.length * 5;

      if (!current) {
        current = { y, text: str, lastXEnd: x != null ? x + width : null };
        continue;
      }

      const sameLine = y != null && current.y != null ? Math.abs(y - current.y) <= lineTolerance : false;
      if (!sameLine) {
        flushCurrent();
        current = { y, text: str, lastXEnd: x != null ? x + width : null };
        continue;
      }

      const gap = x != null && current.lastXEnd != null ? x - current.lastXEnd : null;
      const needsSpace =
        gap == null
          ? !/[\s(\/-]$/.test(current.text) && !/^[,.;:!?/)\]-]/.test(str)
          : gap > 1.6 && !/[\s(\/-]$/.test(current.text) && !/^[,.;:!?/)\]-]/.test(str);
      if (needsSpace) {
        current.text += " ";
      }
      current.text += str;
      current.lastXEnd = x != null ? x + width : current.lastXEnd;
    }
    flushCurrent();

    return normalizeResumeText(lines.join("\n"));
  }

  function countRegexMatches(text, pattern) {
    const source = String(text || "");
    if (!source || !(pattern instanceof RegExp)) return 0;
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const match = source.match(new RegExp(pattern.source, flags));
    return match ? match.length : 0;
  }

  function getPdfNoiseMetrics(text) {
    const source = String(text || "");
    const words = source.split(/\s+/).filter(Boolean);
    const letterCount = countRegexMatches(source, /[A-Za-z]/g);
    const digitCount = countRegexMatches(source, /\d/g);
    const slashTokenCount = countRegexMatches(source, /\/[A-Za-z][A-Za-z0-9-]{1,}/g);
    const metadataTokenCount =
      countRegexMatches(source, /\bFontDescriptor\b/gi) +
      countRegexMatches(source, /\bFontName\b/gi) +
      countRegexMatches(source, /\bFontBBox\b/gi) +
      countRegexMatches(source, /\bBaseFont\b/gi) +
      countRegexMatches(source, /\bCapHeight\b/gi) +
      countRegexMatches(source, /\bAvgWidth\b/gi) +
      countRegexMatches(source, /\bMaxWidth\b/gi) +
      countRegexMatches(source, /\bStemV\b/gi) +
      countRegexMatches(source, /\bAscent\b/gi) +
      countRegexMatches(source, /\bDescent\b/gi) +
      countRegexMatches(source, /\bItalicAngle\b/gi) +
      countRegexMatches(source, /\bFlateDecode\b/gi) +
      countRegexMatches(source, /\bType0\b/gi) +
      countRegexMatches(source, /\bCIDFont\b/gi);
    const pdfOpsCount = countRegexMatches(source, /\b(?:obj|endobj|stream|endstream|xref|trailer|startxref)\b/gi);
    const numericWordCount = words.filter((word) => /^\d+(?:[.-]\d+)*$/.test(word)).length;

    return {
      words,
      letterCount,
      digitCount,
      slashTokenCount,
      metadataTokenCount,
      pdfOpsCount,
      numericWordCount
    };
  }

  function isPdfMetadataNoise(text) {
    const source = String(text || "");
    if (!source) return true;
    const metrics = getPdfNoiseMetrics(source);
    const wordCount = metrics.words.length || 1;
    const slashDensity = metrics.slashTokenCount / wordCount;

    if (metrics.metadataTokenCount >= 2) return true;
    if (metrics.pdfOpsCount >= 2) return true;
    if (slashDensity > 0.2 && metrics.metadataTokenCount > 0) return true;
    if (/\/Type\/FontDescriptor/i.test(source)) return true;
    return false;
  }

  function isLikelyResumeText(text, options) {
    const normalized = sanitizePdfText(text);
    if (!normalized) return false;
    if (isPdfMetadataNoise(normalized)) return false;

    const strict = !!(options && options.strict);
    const metrics = getPdfNoiseMetrics(normalized);
    const words = metrics.words;
    if (words.length < (strict ? 40 : 20)) return false;

    const alphaWords = words.filter((word) => /[A-Za-z]{2,}/.test(word)).length;
    const alphaRatio = alphaWords / Math.max(words.length, 1);
    const slashDensity = metrics.slashTokenCount / Math.max(words.length, 1);
    const numericDominance = metrics.digitCount > metrics.letterCount * 0.92;
    const numericWordRatio = metrics.numericWordCount / Math.max(words.length, 1);

    if (alphaRatio < 0.45) return false;
    if (slashDensity > 0.18) return false;
    if (numericDominance && alphaRatio < 0.7) return false;
    if (numericWordRatio > 0.45 && alphaRatio < 0.72) return false;

    const resumeSignals = countRegexMatches(
      normalized,
      /\b(?:education|experience|employment|skills|projects|work|intern|developer|engineer|university|bachelor|summary|linkedin|github|portfolio)\b/gi
    );
    const hasContactSignal = /@|linkedin\.com|github\.com/i.test(normalized);
    if (strict) {
      return hasContactSignal || resumeSignals >= 2;
    }

    return hasContactSignal || resumeSignals >= 1 || words.length >= 120;
  }

  function decodePdfBytes(bytes) {
    if (!bytes || !bytes.length) return "";

    const hasUtf16Bom = bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;
    if (hasUtf16Bom) {
      try {
        return new TextDecoder("utf-16be", { fatal: false }).decode(bytes.slice(2));
      } catch (_error) {
        return new TextDecoder("latin1", { fatal: false }).decode(bytes);
      }
    }

    let zeroCount = 0;
    for (let i = 0; i < bytes.length; i += 1) {
      if (bytes[i] === 0) zeroCount += 1;
    }

    if (bytes.length >= 4 && zeroCount / bytes.length >= 0.25) {
      try {
        return new TextDecoder("utf-16be", { fatal: false }).decode(bytes);
      } catch (_error) {
        // fallback below
      }
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch (_error) {
      return new TextDecoder("latin1", { fatal: false }).decode(bytes);
    }
  }

  function decodePdfLiteralString(raw) {
    const input = String(raw || "");
    const out = [];

    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (ch !== "\\") {
        out.push(ch.charCodeAt(0) & 0xff);
        continue;
      }

      if (i + 1 >= input.length) {
        break;
      }

      const next = input[i + 1];
      const escapedMap = {
        n: 10,
        r: 13,
        t: 9,
        b: 8,
        f: 12,
        "(": 40,
        ")": 41,
        "\\": 92
      };

      if (Object.prototype.hasOwnProperty.call(escapedMap, next)) {
        out.push(escapedMap[next]);
        i += 1;
        continue;
      }

      if (next === "\n") {
        i += 1;
        continue;
      }

      if (next === "\r") {
        if (input[i + 2] === "\n") i += 2;
        else i += 1;
        continue;
      }

      if (/[0-7]/.test(next)) {
        let octal = next;
        let j = i + 2;
        while (j < input.length && octal.length < 3 && /[0-7]/.test(input[j])) {
          octal += input[j];
          j += 1;
        }
        out.push(parseInt(octal, 8) & 0xff);
        i = j - 1;
        continue;
      }

      out.push(next.charCodeAt(0) & 0xff);
      i += 1;
    }

    return decodePdfBytes(new Uint8Array(out));
  }

  function decodePdfHexString(raw) {
    const normalized = String(raw || "")
      .replace(/[^0-9a-f]/gi, "")
      .toLowerCase();
    if (!normalized) return "";
    const evenHex = normalized.length % 2 === 0 ? normalized : `${normalized}0`;
    const bytes = new Uint8Array(evenHex.length / 2);
    for (let i = 0; i < evenHex.length; i += 2) {
      bytes[i / 2] = parseInt(evenHex.slice(i, i + 2), 16);
    }
    return decodePdfBytes(bytes);
  }

  function extractPdfTextFromStreamContent(content) {
    const chunks = [];
    const textBlocks = String(content || "").match(/BT[\s\S]*?ET/g) || [];

    for (const block of textBlocks) {
      const arrayOps = block.match(/\[(?:[^\[\]]|\[[^\]]*\])*\]\s*TJ/g) || [];
      for (const op of arrayOps) {
        const arrayBodyMatch = op.match(/^\s*\[([\s\S]*?)\]\s*TJ$/);
        if (!arrayBodyMatch) continue;
        const body = arrayBodyMatch[1];
        const tokens = body.match(/\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>|-?\d+(?:\.\d+)?/g) || [];
        for (const token of tokens) {
          if (token.startsWith("(") && token.endsWith(")")) {
            chunks.push(decodePdfLiteralString(token.slice(1, -1)));
            continue;
          }
          if (token.startsWith("<") && token.endsWith(">")) {
            chunks.push(decodePdfHexString(token.slice(1, -1)));
            continue;
          }
          const value = Number(token);
          if (Number.isFinite(value) && value < -120) {
            chunks.push(" ");
          }
        }
        chunks.push(" ");
      }

      const directOps = block.match(/(\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>)\s*(?:Tj|'|")/g) || [];
      for (const op of directOps) {
        const operandMatch = op.match(/^(\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]+>)/);
        if (!operandMatch) continue;
        const token = operandMatch[1];
        if (token.startsWith("(") && token.endsWith(")")) {
          chunks.push(decodePdfLiteralString(token.slice(1, -1)));
        } else if (token.startsWith("<") && token.endsWith(">")) {
          chunks.push(decodePdfHexString(token.slice(1, -1)));
        }
        chunks.push(" ");
      }
    }

    return chunks;
  }

  function extractReadableAsciiRuns(text) {
    const source = String(text || "");
    if (!source) return "";

    const runs = source.match(/[A-Za-z0-9@._+()&,:%$#'"][A-Za-z0-9@._+\-/()&,:%$#'"]{1,}(?:\s+[A-Za-z0-9@._+\-/()&,:%$#'"]{2,}){6,}/g) || [];
    if (!runs.length) return "";
    const filtered = runs.filter((run) => !isPdfMetadataNoise(run));
    if (!filtered.length) return "";
    return sanitizePdfText(filtered.join(" "));
  }

  function parsePdfStreamDescriptors(pdfLatin) {
    const descriptors = [];
    const source = String(pdfLatin || "");
    const objRegex = /\b\d+\s+\d+\s+obj\b/g;
    const endObjToken = "endobj";
    const endStreamToken = "endstream";
    let objMatch;

    while ((objMatch = objRegex.exec(source))) {
      const objBodyStart = objRegex.lastIndex;
      const endObjIndex = source.indexOf(endObjToken, objBodyStart);
      if (endObjIndex < 0) break;

      const objText = source.slice(objBodyStart, endObjIndex);
      const streamIndex = objText.indexOf("stream");
      if (streamIndex < 0) {
        objRegex.lastIndex = endObjIndex + endObjToken.length;
        continue;
      }

      const streamKeywordEnd = streamIndex + "stream".length;
      let streamStart = streamKeywordEnd;
      if (objText[streamStart] === "\r" && objText[streamStart + 1] === "\n") {
        streamStart += 2;
      } else if (objText[streamStart] === "\n" || objText[streamStart] === "\r") {
        streamStart += 1;
      } else {
        objRegex.lastIndex = endObjIndex + endObjToken.length;
        continue;
      }

      const dictEnd = objText.lastIndexOf(">>", streamIndex);
      const dictStart = dictEnd >= 0 ? objText.lastIndexOf("<<", dictEnd) : -1;
      const dict = dictStart >= 0 ? objText.slice(dictStart, dictEnd + 2) : "";
      const lengthMatch = dict.match(/\/Length\s+(\d+)\b/);
      const explicitLength = lengthMatch ? Number(lengthMatch[1]) : NaN;

      let streamData = "";
      if (Number.isFinite(explicitLength) && explicitLength > 0 && streamStart + explicitLength <= objText.length) {
        streamData = objText.slice(streamStart, streamStart + explicitLength);
      } else {
        const endStreamIndex = objText.indexOf(endStreamToken, streamStart);
        if (endStreamIndex < 0) {
          objRegex.lastIndex = endObjIndex + endObjToken.length;
          continue;
        }
        streamData = objText.slice(streamStart, endStreamIndex).replace(/\r?\n$/, "");
      }

      descriptors.push({ dict, streamData });
      objRegex.lastIndex = endObjIndex + endObjToken.length;
    }

    return descriptors;
  }

  function parsePdfStreamDescriptorsLoose(pdfLatin) {
    const descriptors = [];
    const source = String(pdfLatin || "");
    const streamRegex = /(\d+)\s+(\d+)\s+obj\s*(<<[\s\S]*?>>)\s*stream\r?\n/g;
    let match;

    while ((match = streamRegex.exec(source))) {
      const dict = match[3] || "";
      const contentStart = streamRegex.lastIndex;
      const lengthMatch = dict.match(/\/Length\s+(\d+)\b/);
      const explicitLength = lengthMatch ? Number(lengthMatch[1]) : NaN;

      let end = -1;
      if (Number.isFinite(explicitLength) && explicitLength > 0 && contentStart + explicitLength <= source.length) {
        end = contentStart + explicitLength;
      } else {
        end = source.indexOf("endstream", contentStart);
      }
      if (end < 0) break;

      const streamData = source.slice(contentStart, end).replace(/\r?\n$/, "");
      descriptors.push({ dict, streamData });

      const endTokenIndex = source.indexOf("endstream", end);
      streamRegex.lastIndex = endTokenIndex >= 0 ? endTokenIndex + "endstream".length : end;
    }

    return descriptors;
  }

  function scoreExtractedPdfText(text) {
    const normalized = sanitizePdfText(text);
    if (!normalized) return 0;
    if (!isLikelyResumeText(normalized)) return 0;

    const metrics = getPdfNoiseMetrics(normalized);
    const words = metrics.words;
    const alphaWords = words.filter((w) => /[a-zA-Z]{2,}/.test(w)).length;
    const longWords = words.filter((w) => /[a-zA-Z]{4,}/.test(w)).length;
    const signals =
      (/\b(education|experience|skills|projects|work|resume|developer|engineer|intern)\b/i.test(normalized) ? 20 : 0) +
      (/@/.test(normalized) ? 10 : 0) +
      (/\b(github|linkedin|university|waterloo)\b/i.test(normalized) ? 12 : 0);
    const metadataPenalty = metrics.metadataTokenCount * 10 + metrics.pdfOpsCount * 8;
    const slashPenalty = Math.max(0, metrics.slashTokenCount - words.length * 0.08) * 3.5;
    const numericPenalty = metrics.digitCount > metrics.letterCount * 0.75 ? 25 : 0;
    const rawScore = alphaWords + longWords * 0.5 + signals - metadataPenalty - slashPenalty - numericPenalty;

    return Math.max(0, rawScore);
  }

  function pickBestExtractedPdfText(candidates) {
    const list = Array.isArray(candidates) ? candidates : [];
    let bestText = "";
    let bestScore = 0;

    for (const candidate of list) {
      const cleaned = sanitizePdfText(candidate);
      if (!cleaned || cleaned.length < 30) continue;
      if (!isLikelyResumeText(cleaned)) continue;
      const score = scoreExtractedPdfText(cleaned);
      if (score > bestScore) {
        bestScore = score;
        bestText = cleaned;
      }
    }

    if (!bestText) return "";
    if (bestText.length >= 200 && bestScore >= 30) return bestText;
    if (bestText.length >= 120 && bestScore >= 22) return bestText;
    return "";
  }

  async function extractPdfTextFromDescriptors(descriptors) {
    const chunks = [];
    let decodedStreams = 0;
    const list = Array.isArray(descriptors) ? descriptors : [];

    for (const descriptor of list) {
      let streamBytes = latin1ToUint8(descriptor.streamData);
      const dict = descriptor.dict || "";
      const isFlate = /\/FlateDecode\b/.test(dict);

      if (isFlate) {
        try {
          streamBytes = await inflateDeflate(streamBytes);
        } catch (_error) {
          try {
            streamBytes = await inflateDeflateRaw(streamBytes);
          } catch (_fallbackError) {
            continue;
          }
        }
      }

      decodedStreams += 1;
      const decoded = new TextDecoder("latin1", { fatal: false }).decode(streamBytes);
      chunks.push(...extractPdfTextFromStreamContent(decoded));
    }

    return {
      text: sanitizePdfText(chunks.join("")),
      decodedStreams
    };
  }

  async function extractPdfTextWithPdfJs(arrayBuffer) {
    const pdfjs = await loadPdfJsModule();
    if (!pdfjs || typeof pdfjs.getDocument !== "function") {
      throw new Error("pdf.js is unavailable");
    }

    const workerUrl = getRuntimeUrl("src/vendor/pdf.worker.min.mjs");
    if (pdfjs.GlobalWorkerOptions) {
      try {
        if (typeof Worker !== "undefined") {
          global.__WWP_PDF_WORKER_PORT__ = global.__WWP_PDF_WORKER_PORT__ || new Worker(workerUrl, { type: "module" });
          pdfjs.GlobalWorkerOptions.workerPort = global.__WWP_PDF_WORKER_PORT__;
        }
      } catch (_error) {
        // workerPort path failed; fall back to workerSrc below.
      }

      try {
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch (_error) {
        // If this fails, getDocument will surface a clear error we propagate.
      }
    }

    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      isEvalSupported: false,
      useSystemFonts: true,
      verbosity: 0
    });

    const chunks = [];
    let documentProxy = null;
    try {
      documentProxy = await loadingTask.promise;
      const pageCount = Number(documentProxy.numPages || 0);
      for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
        const page = await documentProxy.getPage(pageNum);
        const textContent = await page.getTextContent({
          disableCombineTextItems: false,
          includeMarkedContent: false
        });
        const pageText = buildPdfPageText(textContent.items || []);
        if (pageText) {
          chunks.push(pageText);
        }
      }
    } catch (error) {
      try {
        if (loadingTask && typeof loadingTask.destroy === "function") {
          loadingTask.destroy();
        }
      } catch (_cleanupError) {
        // ignore cleanup failure
      }
      throw error;
    } finally {
      if (documentProxy && typeof documentProxy.destroy === "function") {
        try {
          await documentProxy.destroy();
        } catch (_cleanupError) {
          // ignore cleanup failure
        }
      }
    }

    const extracted = sanitizePdfText(chunks.join("\n\n"));
    if (!isLikelyResumeText(extracted, { strict: true })) {
      throw new Error("pdf.js extracted low-confidence text");
    }
    return extracted;
  }

  async function extractPdfText(arrayBuffer) {
    const originalLatin = new TextDecoder("latin1", { fatal: false }).decode(arrayBuffer);
    const descriptorsA = parsePdfStreamDescriptors(originalLatin);
    const descriptorsB = parsePdfStreamDescriptorsLoose(originalLatin);

    const resultA = await extractPdfTextFromDescriptors(descriptorsA);
    const resultB = await extractPdfTextFromDescriptors(descriptorsB);
    const rawTextOps = sanitizePdfText(extractPdfTextFromStreamContent(originalLatin).join(""));
    const asciiRuns = extractReadableAsciiRuns(originalLatin);

    let pdfJsText = "";
    let pdfJsError = "";
    try {
      pdfJsText = await extractPdfTextWithPdfJs(arrayBuffer);
    } catch (error) {
      pdfJsError = error && error.message ? error.message : String(error);
    }

    const best = pickBestExtractedPdfText([pdfJsText, resultA.text, resultB.text, rawTextOps, asciiRuns]);
    if (best) return best;

    const details = `streamsA=${descriptorsA.length}, streamsB=${descriptorsB.length}, decodedA=${resultA.decodedStreams}, decodedB=${resultB.decodedStreams}, decomp=${typeof DecompressionStream !== "undefined"}`;
    const pdfJsDetails = pdfJsError ? `; pdfjs=${pdfJsError}` : "";
    throw new Error(`PDF text extraction failed. ${details}${pdfJsDetails}`);
  }

  ns.extractTextFromResumeFile = async function extractTextFromResumeFile(file) {
    if (!file) {
      throw new Error("No file selected");
    }

    const fileName = String(file.name || "").toLowerCase();
    const mime = String(file.type || "").toLowerCase();

    if (fileName.endsWith(".txt") || mime.includes("text/plain")) {
      return normalizeResumeText(await file.text());
    }

    if (fileName.endsWith(".docx") || mime.includes("officedocument.wordprocessingml.document")) {
      const buffer = await file.arrayBuffer();
      return extractDocxText(buffer);
    }

    if (fileName.endsWith(".pdf") || mime.includes("pdf")) {
      const buffer = await file.arrayBuffer();
      try {
        return extractPdfText(buffer);
      } catch (error) {
        // Last-resort fallback for edge-case PDFs; avoids hard failure when some readable text exists.
        const latinText = new TextDecoder("latin1", { fatal: false }).decode(buffer);
        const asciiRuns = extractReadableAsciiRuns(latinText);
        if (asciiRuns && isLikelyResumeText(asciiRuns, { strict: true })) {
          return asciiRuns;
        }

        const fallbackText = sanitizePdfText(String(await file.text()).replace(/[\u0000-\u001f\u007f-\u009f]/g, " "));
        if (fallbackText && isLikelyResumeText(fallbackText, { strict: true })) {
          return fallbackText;
        }
        throw error;
      }
    }

    return normalizeResumeText(await file.text());
  };
})(globalThis);
