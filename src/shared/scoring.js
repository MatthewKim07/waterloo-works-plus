(function initScoring(global) {
  const ns = (global.WWP = global.WWP || {});
  let aliasToKeyCache = null;
  const SEMANTIC_VECTOR_DIM = 192;
  const SEMANTIC_EMBED_CACHE_MAX = 180;
  const SEMANTIC_MATCH_CACHE_MAX = 420;
  const semanticEmbedCache = new Map();
  const semanticMatchCache = new Map();

  const SKILL_EQUIVALENCE = {
    llm: ["openai api", "machine learning", "nlp"],
    "openai api": ["llm"],
    sql: ["postgresql", "mysql", "mongodb"],
    "backend engineering": ["fastapi", "node.js", "express", "flask", "django", "nestjs", "rest api"],
    "frontend engineering": ["react", "next.js", "vue", "angular", "tailwind css", "html", "css"],
    "ci/cd": ["git", "github actions"],
    authentication: ["oauth", "jwt"]
  };

  function escapeRegex(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function ensureAliasLookup() {
    if (aliasToKeyCache) return aliasToKeyCache;
    const map = new Map();
    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const key = String((entry && entry.key) || "").trim();
      if (!key) continue;
      const keyNorm = ns.normalizeToken(key);
      if (keyNorm) map.set(keyNorm, key);
      const aliases = ns.unique([key, ...((entry && entry.aliases) || [])]);
      aliases.forEach((aliasRaw) => {
        const alias = ns.normalizeToken(aliasRaw);
        if (!alias) return;
        if (!map.has(alias)) map.set(alias, key);
      });
    }
    aliasToKeyCache = map;
    return map;
  }

  function resolveSkillKey(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const dict = ns.SKILLS_DICTIONARY || [];
    const direct = dict.find((entry) => String(entry && entry.key) === raw);
    if (direct) return direct.key;

    const lookup = ensureAliasLookup();
    const norm = ns.normalizeToken(raw);
    if (norm && lookup.has(norm)) return lookup.get(norm);
    return raw;
  }

  function asSkillMap(skills) {
    if (skills instanceof Map) return skills;
    const map = new Map();
    if (skills && typeof skills === "object") {
      for (const [k, v] of Object.entries(skills)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) map.set(k, 1);
      }
    }
    return map;
  }

  function findSkillEntryByKey(key) {
    const resolved = resolveSkillKey(key);
    return (ns.SKILLS_DICTIONARY || []).find((item) => item.key === resolved) || null;
  }

  function buildResumeCanonicalSet(resumeMap) {
    const out = new Set();
    if (!resumeMap || typeof resumeMap.forEach !== "function") return out;

    const lookup = ensureAliasLookup();
    resumeMap.forEach((_value, rawSkill) => {
      const canonical = resolveSkillKey(rawSkill);
      if (canonical) out.add(canonical);

      const norm = ns.normalizeToken(rawSkill);
      if (norm && lookup.has(norm)) {
        out.add(lookup.get(norm));
      }
    });
    return out;
  }

  function hasResumeSkill(resumeCanonicalSet, skillKey) {
    const canonical = resolveSkillKey(skillKey);
    if (!canonical) return false;
    if (resumeCanonicalSet.has(canonical)) return true;

    const equivalents = SKILL_EQUIVALENCE[canonical] || [];
    return equivalents.some((alt) => resumeCanonicalSet.has(resolveSkillKey(alt)));
  }

  function extractSkillKeysFromText(text) {
    const lower = String(text || "").toLowerCase();
    if (!lower) return [];
    const found = [];

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const aliases = ns.unique([entry.key, ...((entry && entry.aliases) || [])]);
      const hit = aliases.some((aliasRaw) => {
        const alias = ns.normalizeToken(aliasRaw);
        if (!alias) return false;
        const match = lower.match(new RegExp(`\\b${escapeRegex(alias)}\\b`, "i"));
        return !!match;
      });
      if (hit) found.push(entry.key);
    }

    return ns.unique(found);
  }

  function computeLineCoverageScore(lines, resumeCanonicalSet, tone) {
    const list = Array.isArray(lines) ? lines : [];
    let total = 0;
    let achieved = 0;

    list.forEach((line) => {
      const text = String(line || "").trim();
      if (!text) return;
      const skills = extractSkillKeysFromText(text);
      if (!skills.length) return;

      const lower = text.toLowerCase();
      const hasOrGroup = /\bor\b|and\/or|\//.test(lower) && skills.length > 1;
      const matchedCount = skills.filter((skill) => hasResumeSkill(resumeCanonicalSet, skill)).length;
      const satisfaction = hasOrGroup ? (matchedCount > 0 ? 1 : 0) : matchedCount / skills.length;
      const baseWeight = tone === "required" ? 2.2 : 1.1;
      const lineWeight = baseWeight + Math.min(0.8, skills.length * 0.14);
      total += lineWeight;
      achieved += lineWeight * satisfaction;
    });

    if (!total) return null;
    return (achieved / total) * 100;
  }

  function countAliasHits(text, aliases) {
    let hits = 0;
    const lower = String(text || "").toLowerCase();
    for (const alias of aliases || []) {
      const token = ns.normalizeToken(alias);
      if (!token) continue;
      const escaped = escapeRegex(token);
      const match = lower.match(new RegExp(`\\b${escaped}\\b`, "g"));
      hits += match ? match.length : 0;
    }
    return hits;
  }

  function getCategoryMultiplier(entry) {
    const category = String((entry && entry.category) || "").toLowerCase();
    if (!category) return 1;
    if (category === "soft-skill") return 0.55;
    if (category === "process") return 0.5;
    if (category === "domain") return 0.75;
    return 1;
  }

  function deriveMentionWeightsFromText(text) {
    const lower = String(text || "").toLowerCase();
    const mentionWeights = new Map();
    if (!lower.trim()) return mentionWeights;

    for (const entry of ns.SKILLS_DICTIONARY || []) {
      const key = String(entry && entry.key ? entry.key : "").trim();
      if (!key) continue;

      const aliases = ns.unique([key, ...((entry && entry.aliases) || [])]);
      const hits = countAliasHits(lower, aliases);
      if (hits <= 0) continue;

      const baseWeight = Number(entry.baseWeight || 1);
      const categoryFactor = getCategoryMultiplier(entry);
      const mentionWeight = (0.75 + Math.min(2.4, hits * 0.42)) * baseWeight * categoryFactor;
      mentionWeights.set(key, Number(mentionWeight.toFixed(3)));
    }

    return mentionWeights;
  }

  function isTechnicalRequiredSkill(skillKey) {
    const entry = findSkillEntryByKey(skillKey);
    const category = String((entry && entry.category) || "").toLowerCase();
    return category !== "soft-skill" && category !== "process";
  }

  ns.computeSkillMatch = function computeSkillMatch(resumeSkills, jobRequired, jobPreferred, fullText, options) {
    const opts = options || {};
    const resumeMap = asSkillMap(resumeSkills);
    const required = ns.unique((jobRequired || []).map((skill) => resolveSkillKey(skill)).filter(Boolean));
    const preferred = ns
      .unique((jobPreferred || []).map((skill) => resolveSkillKey(skill)).filter(Boolean))
      .filter((skill) => !required.includes(skill));
    const fullTextValue = String(fullText || "");
    const hasExplicitSkills = required.length + preferred.length > 0;
    const resumeCanonicalSet = buildResumeCanonicalSet(resumeMap);
    const requiredLines = Array.isArray(opts.requiredLines) ? opts.requiredLines : [];
    const preferredLines = Array.isArray(opts.preferredLines) ? opts.preferredLines : [];

    const jobWeights = new Map();

    for (const key of required) {
      const entry = findSkillEntryByKey(key);
      const categoryFactor = getCategoryMultiplier(entry);
      jobWeights.set(key, (jobWeights.get(key) || 0) + 5.2 * categoryFactor);
    }

    for (const key of preferred) {
      const entry = findSkillEntryByKey(key);
      const categoryFactor = getCategoryMultiplier(entry);
      jobWeights.set(key, (jobWeights.get(key) || 0) + 1.65 * categoryFactor);
    }

    const mentionWeights = deriveMentionWeightsFromText(fullTextValue);

    for (const [key, weight] of Array.from(jobWeights.entries())) {
      const entry = findSkillEntryByKey(key);
      if (!entry) continue;
      const aliases = ns.unique([key, ...((entry && entry.aliases) || [])]);
      const hits = countAliasHits(fullTextValue, aliases);
      jobWeights.set(key, weight + Math.min(2.4, hits * 0.28));
    }

    for (const [key, mentionWeight] of mentionWeights.entries()) {
      const existing = jobWeights.get(key) || 0;
      if (existing > 0) {
        jobWeights.set(key, existing + Math.min(1.25, mentionWeight * 0.3));
      } else if (!hasExplicitSkills) {
        // Keep full-text inferred skills lighter than explicit required/preferred tags.
        jobWeights.set(key, Math.min(2.2, mentionWeight));
      }
    }

    if (jobWeights.size === 0) {
      let overlap = 0;
      for (const [skill] of resumeMap.entries()) {
        if (fullTextValue.toLowerCase().includes(skill.toLowerCase())) {
          overlap += 1;
        }
      }
      return ns.clamp(Math.round(Math.min(100, overlap * 8)), 0, 100);
    }

    let achieved = 0;
    let total = 0;

    for (const [skill, weight] of jobWeights.entries()) {
      total += weight;
      if (hasResumeSkill(resumeCanonicalSet, skill)) {
        achieved += weight;
      }
    }

    if (total <= 0) return 0;
    let score = (achieved / total) * 100;

    const requiredLineScore = computeLineCoverageScore(requiredLines, resumeCanonicalSet, "required");
    const preferredLineScore = computeLineCoverageScore(preferredLines, resumeCanonicalSet, "preferred");
    if (requiredLineScore != null) {
      score = score * 0.8 + requiredLineScore * 0.2;
    }
    if (preferredLineScore != null) {
      score = score * 0.9 + preferredLineScore * 0.1;
    }

    // When explicit technical required skills are present, coverage should drive score more strongly.
    const technicalRequired = required.filter((skill) => isTechnicalRequiredSkill(skill));
    if (technicalRequired.length >= 3) {
      const matchedRequired = technicalRequired.filter((skill) => hasResumeSkill(resumeCanonicalSet, skill)).length;
      const requiredCoverage = matchedRequired / technicalRequired.length;
      if (requiredCoverage >= 0.75) {
        score = Math.max(score, 44 + requiredCoverage * 50);
      } else if (requiredCoverage >= 0.55) {
        score = Math.max(score, 32 + requiredCoverage * 44);
      }
    }

    return ns.clamp(Math.round(score), 0, 100);
  };

  function trimCache(map, maxEntries) {
    if (!(map instanceof Map)) return;
    if (map.size <= maxEntries) return;
    const toDelete = map.size - maxEntries;
    let idx = 0;
    for (const key of map.keys()) {
      map.delete(key);
      idx += 1;
      if (idx >= toDelete) break;
    }
  }

  function hash32(input) {
    const text = String(input || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function textFingerprint(input) {
    const text = ns.normalizeText(String(input || "").toLowerCase()).slice(0, 12000);
    return hash32(text).toString(16);
  }

  function similarityToPercent(similarity) {
    const raw = Number(similarity);
    if (!Number.isFinite(raw)) return 0;
    const s = ns.clamp(raw, -1, 1);
    if (s <= 0) {
      return Math.round((s + 1) * 18);
    }
    return Math.round(18 + s * 82);
  }

  function buildSkillListFromText(text) {
    const inferred = extractSkillKeysFromText(text || "");
    return Array.isArray(inferred) ? inferred : [];
  }

  function buildSemanticTokenFeatures(text) {
    const normalized = ns.normalizeText(text).toLowerCase();
    if (!normalized) return new Map();

    const tokenCounts = new Map();
    const tokens = ns
      .tokenize(normalized)
      .map((token) => ns.simpleStem(token))
      .filter((token) => token && token.length >= 2)
      .slice(0, 2400);

    tokens.forEach((token) => {
      tokenCounts.set(`tok:${token}`, (tokenCounts.get(`tok:${token}`) || 0) + 1);

      if (token.length >= 4) {
        for (let i = 0; i <= token.length - 3; i += 1) {
          const tri = token.slice(i, i + 3);
          tokenCounts.set(`tri:${tri}`, (tokenCounts.get(`tri:${tri}`) || 0) + 1);
        }
      }
    });

    const grams = ns.generateNgrams(tokens.slice(0, 1600), 2, 2).slice(0, 1400);
    grams.forEach((gram) => {
      tokenCounts.set(`bg:${gram}`, (tokenCounts.get(`bg:${gram}`) || 0) + 1);
    });

    const inferredSkills = buildSkillListFromText(normalized);
    inferredSkills.forEach((skill) => {
      const canonical = resolveSkillKey(skill);
      if (canonical) {
        tokenCounts.set(`skill:${canonical}`, (tokenCounts.get(`skill:${canonical}`) || 0) + 2.4);
      }
    });

    return tokenCounts;
  }

  function buildSemanticEmbedding(text) {
    const fp = textFingerprint(text);
    if (semanticEmbedCache.has(fp)) {
      return semanticEmbedCache.get(fp);
    }

    const features = buildSemanticTokenFeatures(text);
    const vec = new Float32Array(SEMANTIC_VECTOR_DIM);

    for (const [feature, count] of features.entries()) {
      const baseWeight = Math.sqrt(Math.max(0, Number(count) || 0));
      if (baseWeight <= 0) continue;

      const h1 = hash32(feature);
      const i1 = h1 % SEMANTIC_VECTOR_DIM;
      const s1 = h1 & 1 ? 1 : -1;
      vec[i1] += s1 * baseWeight;

      const h2 = hash32(`${feature}::2`);
      const i2 = h2 % SEMANTIC_VECTOR_DIM;
      const s2 = h2 & 1 ? 1 : -1;
      vec[i2] += s2 * baseWeight * 0.5;
    }

    let norm = 0;
    for (let i = 0; i < vec.length; i += 1) {
      norm += vec[i] * vec[i];
    }
    const length = Math.sqrt(norm);
    if (length > 0) {
      for (let i = 0; i < vec.length; i += 1) {
        vec[i] /= length;
      }
    }

    semanticEmbedCache.set(fp, vec);
    trimCache(semanticEmbedCache, SEMANTIC_EMBED_CACHE_MAX);
    return vec;
  }

  function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dot = 0;
    for (let i = 0; i < vecA.length; i += 1) {
      dot += vecA[i] * vecB[i];
    }
    return ns.clamp(dot, -1, 1);
  }

  function computeConceptCoverage(resumeCanonicalSet, candidateSkills) {
    const skills = ns.unique((candidateSkills || []).map((skill) => resolveSkillKey(skill)).filter(Boolean));
    if (!skills.length) return null;
    const matched = skills.filter((skill) => hasResumeSkill(resumeCanonicalSet, skill)).length;
    return {
      matched,
      total: skills.length,
      ratio: skills.length ? matched / skills.length : 0
    };
  }

  function computeLocalSemanticSkillScore(payload) {
    const data = payload || {};
    const resumeMap = asSkillMap(data.resumeSkills);
    const resumeCanonicalSet = buildResumeCanonicalSet(resumeMap);
    const resumeSkillBlob = Array.from(resumeMap.keys()).join(" ");
    const resumeRawText = String(data.resumeRawText || "");
    const resumeCorpus = `${resumeSkillBlob} ${resumeRawText}`.trim().slice(0, 20000);

    const requiredLines = Array.isArray(data.requiredLines) ? data.requiredLines : [];
    const preferredLines = Array.isArray(data.preferredLines) ? data.preferredLines : [];
    const requiredSkillList = ns.unique((data.jobRequired || []).map((skill) => resolveSkillKey(skill)).filter(Boolean));
    const preferredSkillList = ns.unique((data.jobPreferred || []).map((skill) => resolveSkillKey(skill)).filter(Boolean));

    const requiredCorpus = `${requiredSkillList.join(" ")} ${requiredLines.join(" ")}`.trim();
    const preferredCorpus = `${preferredSkillList.join(" ")} ${preferredLines.join(" ")}`.trim();
    const fullText = String(data.fullText || "");
    const jobTitle = String(data.jobTitle || "");
    const targetRoleText = String(data.targetRoleText || "");

    if (!resumeCorpus || (!requiredCorpus && !preferredCorpus && !fullText)) {
      return { available: false, score: null };
    }

    const semanticKey = [
      textFingerprint(resumeCorpus),
      textFingerprint(requiredCorpus),
      textFingerprint(preferredCorpus),
      textFingerprint(fullText.slice(0, 4200)),
      textFingerprint(jobTitle),
      textFingerprint(targetRoleText),
      requiredSkillList.join("|"),
      preferredSkillList.join("|")
    ].join("::");
    if (semanticMatchCache.has(semanticKey)) {
      return semanticMatchCache.get(semanticKey);
    }

    const resumeVec = buildSemanticEmbedding(resumeCorpus);
    const requiredVec = buildSemanticEmbedding(requiredCorpus || fullText.slice(0, 2800));
    const preferredVec = buildSemanticEmbedding(preferredCorpus || fullText.slice(0, 2200));
    const fullVec = buildSemanticEmbedding(`${jobTitle} ${fullText}`.slice(0, 6000));

    const requiredCoverage =
      computeConceptCoverage(resumeCanonicalSet, requiredSkillList.length ? requiredSkillList : buildSkillListFromText(requiredCorpus));
    const preferredCoverage = computeConceptCoverage(
      resumeCanonicalSet,
      preferredSkillList.length ? preferredSkillList : buildSkillListFromText(preferredCorpus)
    );

    const requiredSimilarity = similarityToPercent(cosineSimilarity(resumeVec, requiredVec));
    const preferredSimilarity = similarityToPercent(cosineSimilarity(resumeVec, preferredVec));
    const fullSimilarity = similarityToPercent(cosineSimilarity(resumeVec, fullVec));

    let roleSimilarity = null;
    if (targetRoleText.trim()) {
      const roleVec = buildSemanticEmbedding(targetRoleText);
      roleSimilarity = similarityToPercent(cosineSimilarity(roleVec, fullVec));
    }

    const requiredCoveragePct = requiredCoverage ? requiredCoverage.ratio * 100 : null;
    const preferredCoveragePct = preferredCoverage ? preferredCoverage.ratio * 100 : null;

    let score = 0;
    if (requiredCoveragePct != null) {
      score += requiredCoveragePct * 0.58;
    } else {
      score += requiredSimilarity * 0.46;
    }
    if (preferredCoveragePct != null) {
      score += preferredCoveragePct * 0.14;
    } else {
      score += preferredSimilarity * 0.07;
    }
    score += requiredSimilarity * 0.14;
    score += fullSimilarity * 0.12;
    if (roleSimilarity != null) {
      score += roleSimilarity * 0.1;
    }

    if (requiredCoverage && requiredCoverage.total >= 4) {
      if (requiredCoverage.ratio >= 0.7) score += 9;
      else if (requiredCoverage.ratio >= 0.5) score += 4;
      else if (requiredCoverage.ratio < 0.3) score -= 10;
    }

    if (roleSimilarity != null && roleSimilarity < 30) {
      score -= 6;
    }

    const out = {
      available: true,
      score: ns.clamp(Math.round(score), 0, 100),
      requiredCoverage,
      preferredCoverage,
      requiredSimilarity,
      preferredSimilarity,
      fullSimilarity,
      roleSimilarity
    };
    semanticMatchCache.set(semanticKey, out);
    trimCache(semanticMatchCache, SEMANTIC_MATCH_CACHE_MAX);
    return out;
  }

  ns.computeHybridSkillMatch = function computeHybridSkillMatch(payload) {
    const data = payload || {};
    const baseSkillMatch = ns.computeSkillMatch(
      data.resumeSkills,
      data.jobRequired,
      data.jobPreferred,
      data.fullText,
      {
        requiredLines: data.requiredLines,
        preferredLines: data.preferredLines
      }
    );

    if (!data.localSemanticEnabled) {
      return {
        skillMatch: baseSkillMatch,
        baseSkillMatch,
        semanticSkillMatch: null,
        semanticApplied: false,
        semanticDelta: 0,
        semanticDetails: null
      };
    }

    const semantic = computeLocalSemanticSkillScore(data);
    if (!semantic || !semantic.available || !Number.isFinite(semantic.score)) {
      return {
        skillMatch: baseSkillMatch,
        baseSkillMatch,
        semanticSkillMatch: null,
        semanticApplied: false,
        semanticDelta: 0,
        semanticDetails: null
      };
    }

    let blended = Math.round(baseSkillMatch * 0.64 + semantic.score * 0.36);

    if (semantic.requiredCoverage && semantic.requiredCoverage.total >= 3) {
      if (semantic.requiredCoverage.ratio >= 0.65) {
        blended = Math.max(blended, Math.round(baseSkillMatch * 0.72 + semantic.score * 0.28 + 4));
      }
      if (semantic.requiredCoverage.ratio < 0.28 && baseSkillMatch > 36) {
        blended = Math.max(0, blended - 7);
      }
    }

    if (semantic.roleSimilarity != null && semantic.roleSimilarity < 28) {
      blended = Math.max(0, blended - 5);
    }

    blended = ns.clamp(blended, 0, 100);
    return {
      skillMatch: blended,
      baseSkillMatch,
      semanticSkillMatch: semantic.score,
      semanticApplied: true,
      semanticDelta: blended - baseSkillMatch,
      semanticDetails: semantic
    };
  };

  function parseTermFromLabel(label) {
    const text = String(label || "").toLowerCase();
    const match = text.match(/(?:work\s*term|term|wt)?\s*([1-9])/i);
    return match ? Number(match[1]) : null;
  }

  ns.computeTermCompatibility = function computeTermCompatibility(userTerm, termDist) {
    const term = Number(userTerm);
    if (!Number.isFinite(term) || term < 1) return 50;
    if (!Array.isArray(termDist) || termDist.length === 0) return 50;

    const maxShare = Math.max(...termDist.map((x) => Number(x.percent) || 0), 0);
    const matched = termDist.find((x) => parseTermFromLabel(x.label) === term);
    const share = matched ? Number(matched.percent) || 0 : 0;

    if (share <= 0) return 15;

    const relative = maxShare > 0 ? share / maxShare : 0;
    let score = 30 + share * 1.8;
    score += relative * 20;
    return ns.clamp(Math.round(score), 0, 100);
  };

  ns.computeFacultyAlignment = function computeFacultyAlignment(userFaculty, facultyDist) {
    const faculty = String(userFaculty || "").toLowerCase();
    if (!faculty) return 50;
    if (!Array.isArray(facultyDist) || facultyDist.length === 0) return 50;

    const maxShare = Math.max(...facultyDist.map((x) => Number(x.percent) || 0), 0);
    let matchedShare = 0;

    for (const row of facultyDist) {
      const label = String(row.label || "").toLowerCase();
      if (label.includes(faculty) || faculty.includes(label)) {
        matchedShare = Math.max(matchedShare, Number(row.percent) || 0);
      }
    }

    if (matchedShare <= 0) return 25;

    const relative = maxShare > 0 ? matchedShare / maxShare : 0;
    return ns.clamp(Math.round(35 + matchedShare * 1.2 + relative * 25), 0, 100);
  };

  function computeTrendSlope(values) {
    if (!values || values.length < 3) return 0;
    const n = values.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i += 1) {
      const x = i;
      const y = values[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (!denominator) return 0;
    return (n * sumXY - sumX * sumY) / denominator;
  }

  ns.computeSelectivity = function computeSelectivity(hiresByTermTable) {
    if (!Array.isArray(hiresByTermTable) || hiresByTermTable.length === 0) return 0;

    const hires = hiresByTermTable
      .map((row) => Number(row.hires))
      .filter((value) => Number.isFinite(value) && value >= 0);

    if (!hires.length) return 0;

    const avg = hires.reduce((sum, v) => sum + v, 0) / hires.length;
    let adjustment = 0;

    if (avg >= 20) adjustment = 20;
    else if (avg >= 12) adjustment = 10;
    else if (avg >= 6) adjustment = 0;
    else if (avg >= 3) adjustment = -10;
    else adjustment = -20;

    const slope = computeTrendSlope(hires);
    if (slope > 0.7) adjustment += 5;
    if (slope < -0.7) adjustment -= 5;

    return ns.clamp(Math.round(adjustment), -20, 20);
  };

  ns.computeViabilityScore = function computeViabilityScore(
    skillMatch,
    termCompatibility,
    facultyAlignment,
    selectivityAdjustment
  ) {
    const skill = ns.clamp(Number(skillMatch) || 0, 0, 100);
    const term = ns.clamp(Number(termCompatibility) || 0, 0, 100);
    const faculty = ns.clamp(Number(facultyAlignment) || 0, 0, 100);
    const selectivity = ns.clamp(Number(selectivityAdjustment) || 0, -20, 20);

    const base = skill * 0.5 + term * 0.25 + faculty * 0.15;
    const score = ns.clamp(Math.round(base + selectivity), 0, 100);

    return {
      score,
      breakdown: {
        skillMatch: skill,
        termCompatibility: term,
        facultyAlignment: faculty,
        selectivityAdjustment: selectivity,
        weightedBase: Math.round(base)
      }
    };
  };

  ns.recommendAction = function recommendAction(viability, flags) {
    const value = ns.clamp(Number(viability) || 0, 0, 100);
    const activeFlags = flags || {};

    if (activeFlags.hardDisqualifier) {
      const reasons = Array.isArray(activeFlags.hardReasons) ? activeFlags.hardReasons : [];
      return {
        label: "Do not apply",
        reasons: (reasons.length ? reasons : ["Posting has a hard eligibility requirement that does not match your profile."]).slice(
          0,
          2
        )
      };
    }

    let label = "Apply as a reach";

    if (value >= 80) label = "Apply aggressively";
    else if (value >= 65) label = "Apply if you have exceptional projects";
    else if (value >= 50) label = "Apply as a reach";
    else if (value >= 35) label = "Better suited next term";
    else label = "Consider alternative divisions";

    const reasons = [];

    if (activeFlags.termShareZero) {
      reasons.push("Historical hires for your work-term level appear near zero.");
    }
    if (activeFlags.facultyWeak) {
      reasons.push("Faculty alignment is weak in available hiring history.");
    }
    if (activeFlags.roleMismatch) {
      reasons.push("Target role alignment is weak for this posting.");
    }
    if (activeFlags.fieldMismatchRequired) {
      reasons.push("Required degree field appears misaligned with your profile.");
    } else if (activeFlags.fieldMismatchPreferred) {
      reasons.push("Preferred degree field leans away from your profile.");
    }
    if (activeFlags.eightMonthPreferred && activeFlags.userTermLength === "4") {
      reasons.push("Posting appears to prefer an 8-month commitment.");
    }
    if (activeFlags.highSkillMatch) {
      reasons.push("Your resume aligns strongly with listed technical requirements.");
    }
    if (activeFlags.lowSkillMatch) {
      reasons.push("Skill match is low relative to required qualifications.");
    }

    if (reasons.length < 2) {
      if (value >= 70) reasons.push("Composite overall match is favorable compared to baseline.");
      if (value < 50) reasons.push("Composite overall match indicates elevated mismatch risk.");
    }

    return {
      label,
      reasons: reasons.slice(0, 2)
    };
  };
})(globalThis);
