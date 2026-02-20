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

  async function inflateDeflate(uint8) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("DecompressionStream is not available in this browser");
    }
    const ds = new DecompressionStream("deflate");
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

  function latin1ToUint8(text) {
    const src = String(text || "");
    const bytes = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i += 1) {
      bytes[i] = src.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  function sanitizePdfText(text) {
    return ns.normalizeText(String(text || "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, " "));
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

  async function extractPdfText(arrayBuffer) {
    const originalLatin = new TextDecoder("latin1", { fatal: false }).decode(arrayBuffer);
    const streamDescriptors = parsePdfStreamDescriptors(originalLatin);
    const streamTexts = [];

    for (const descriptor of streamDescriptors) {
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

      const decoded = new TextDecoder("latin1", { fatal: false }).decode(streamBytes);
      streamTexts.push(...extractPdfTextFromStreamContent(decoded));
    }

    const fallbackTexts = extractPdfTextFromStreamContent(originalLatin);
    const combined = streamTexts.length ? streamTexts : fallbackTexts;
    const text = sanitizePdfText(combined.join(""));

    if (!text || text.length < 20) {
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
