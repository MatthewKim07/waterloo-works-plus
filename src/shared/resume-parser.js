(function initResumeParser(global) {
  const ns = (global.WWP = global.WWP || {});

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

  ns.parseResume = function parseResume(text) {
    const rawText = ns.normalizeText(text);
    const lower = rawText.toLowerCase();
    const tokens = ns.tokenize(lower);
    const ngrams = ns.generateNgrams(tokens, 1, 3);

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

        if (exactHits > 0 || gramHits > 0) {
          skillScore += (exactHits * 1.25 + gramHits) * baseWeight;
        }
      }

      if (skillScore > 0) {
        scores.set(entry.key, Number(skillScore.toFixed(2)));
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

  async function inflateDeflateRaw(uint8) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("DecompressionStream is not available in this browser");
    }
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([uint8]).stream().pipeThrough(ds);
    const ab = await readStreamToArrayBuffer(stream);
    return new Uint8Array(ab);
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
        const nodes = Array.from(xmlDoc.getElementsByTagName("w:t"));
        const text = nodes.map((node) => node.textContent || "").join(" ");
        return ns.normalizeText(text);
      }

      offset = dataEnd;
    }

    throw new Error("DOCX parsing failed: word/document.xml not found");
  }

  function extractPdfText(arrayBuffer) {
    const latin = new TextDecoder("latin1", { fatal: false }).decode(arrayBuffer);
    const chunks = [];
    const btEtBlocks = latin.match(/BT[\s\S]*?ET/g) || [];

    for (const block of btEtBlocks) {
      const textOps = block.match(/\((?:\\.|[^\\()])*\)\s*Tj/g) || [];
      for (const op of textOps) {
        const raw = op.match(/\((.*)\)\s*Tj/);
        if (!raw || !raw[1]) continue;
        const cleaned = raw[1]
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\n/g, " ")
          .replace(/\\r/g, " ")
          .replace(/\\t/g, " ")
          .replace(/\\\\/g, "\\");
        chunks.push(cleaned);
      }
    }

    const text = ns.normalizeText(chunks.join(" "));
    if (!text) {
      throw new Error("PDF text extraction failed. Try pasting resume text manually.");
    }
    return text;
  }

  ns.extractTextFromResumeFile = async function extractTextFromResumeFile(file) {
    if (!file) {
      throw new Error("No file selected");
    }

    const fileName = String(file.name || "").toLowerCase();
    const mime = String(file.type || "").toLowerCase();

    if (fileName.endsWith(".txt") || mime.includes("text/plain")) {
      return ns.normalizeText(await file.text());
    }

    if (fileName.endsWith(".docx") || mime.includes("officedocument.wordprocessingml.document")) {
      const buffer = await file.arrayBuffer();
      return extractDocxText(buffer);
    }

    if (fileName.endsWith(".pdf") || mime.includes("pdf")) {
      const buffer = await file.arrayBuffer();
      return extractPdfText(buffer);
    }

    return ns.normalizeText(await file.text());
  };
})(globalThis);
