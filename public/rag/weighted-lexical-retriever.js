const STOP_WORDS = new Set([
  "avec", "dans", "des", "les", "une", "pour", "que", "qui", "son", "ses", "sur", "est", "sont", "aux", "par",
  "the", "and", "for", "with", "what", "his", "about", "does", "from", "this", "that", "into",
  "ist", "und", "der", "die", "das", "mit", "was", "wie", "von", "zum", "zur", "ein", "eine", "auf",
  "nicolas", "tuor", "projet", "project"
]);

export function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokenizeSearchText(value) {
  return normalizeSearchText(value)
    .match(/[a-z0-9_./-]+/g)
    ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) || [];
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

export function rankLexicalChunks(query, chunks, options = {}) {
  const limit = Math.max(1, Number(options.limit) || 5);
  const projectId = normalizeSearchText(options.projectId).trim();
  const queryText = normalizeSearchText(query).trim();
  const queryTokens = tokenizeSearchText(query);
  if (!queryTokens.length) return [];

  return (Array.isArray(chunks) ? chunks : [])
    .map((chunk) => {
      const content = String(chunk.content || chunk.text || "");
      const normalizedContent = chunk.normalized || normalizeSearchText(content);
      const path = normalizeSearchText(chunk.path || "");
      const symbol = normalizeSearchText(chunk.symbolName || "");
      const metadataText = normalizeSearchText([
        chunk.projectId,
        chunk.repository,
        chunk.language,
        chunk.chunkType,
        chunk.implementationStatus
      ].join(" "));
      let score = 0;

      for (const token of queryTokens) {
        const occurrences = countOccurrences(normalizedContent, token);
        if (occurrences) score += 1.4 + Math.min(occurrences, 5) * 0.45 + (token.length > 6 ? 0.7 : 0);
        if (path.includes(token)) score += 2.2;
        if (symbol.includes(token)) score += 3.2;
        if (metadataText.includes(token)) score += 1.1;
      }

      if (queryText.length > 8 && normalizedContent.includes(queryText)) score += 7;
      if (projectId && normalizeSearchText(chunk.projectId) === projectId) score += 8;
      if (/test|spec/.test(path)) score += 0.5;
      if (["source", "route", "function", "class", "component", "test", "config"].includes(chunk.chunkType)) score += 0.6;
      if (chunk.chunkType === "readme") score -= 0.8;

      return { ...chunk, score };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || String(a.path || "").localeCompare(String(b.path || "")))
    .slice(0, limit);
}

export function formatRetrievedChunks(chunks, options = {}) {
  const maxChars = Math.max(1000, Number(options.maxChars) || 9000);
  let remaining = maxChars;
  const blocks = [];

  for (const chunk of chunks || []) {
    if (remaining <= 0) break;
    const header = [
      `project=${chunk.projectId || "profile"}`,
      chunk.repository ? `repository=${chunk.repository}` : null,
      chunk.branch ? `branch=${chunk.branch}` : null,
      chunk.path ? `path=${chunk.path}` : null,
      chunk.symbolName ? `symbol=${chunk.symbolName}` : null,
      chunk.implementationStatus ? `status=${chunk.implementationStatus}` : null,
      chunk.sourceUrl ? `source=${chunk.sourceUrl}` : null
    ].filter(Boolean).join("; ");
    const available = Math.max(0, remaining - header.length - 6);
    const body = String(chunk.content || chunk.text || "").slice(0, Math.min(available, 2400));
    const block = `[${header}]\n${body}`;
    blocks.push(block);
    remaining -= block.length + 7;
  }

  return blocks.join("\n\n---\n\n");
}

export function detectTechnicalQuestion(question) {
  const normalized = normalizeSearchText(question);
  return /architecture|code|fonction|class|route|api|backend|frontend|base de donnees|database|test|implemented|implementation|function|how does|wie funktioniert|quellcode|technolog|collect|scrap|vote|deploi|deploy|mock|simul/.test(normalized);
}
