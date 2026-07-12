const SOURCE_URLS = [
  { name: "CV", url: "/cv-text.txt" },
  { name: "Portfolio", url: "/portfolio-data.js" }
];

const STOP_WORDS = new Set([
  "avec", "dans", "des", "les", "une", "pour", "que", "qui", "son", "ses", "sur", "est", "sont",
  "the", "and", "for", "with", "what", "his", "about", "does", "ist", "und", "der", "die", "das",
  "mit", "was", "wie", "von", "zu", "ein", "eine", "auf", "nicolas", "tuor"
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value) {
  return normalize(value)
    .match(/[a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) || [];
}

function cleanChunk(value) {
  return String(value || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCv(text) {
  return String(text || "")
    .split(/(?=^=== .+ ===$)/gm)
    .map(cleanChunk)
    .filter((chunk) => chunk.length > 60);
}

function splitPortfolio(text) {
  return String(text || "")
    .split(/\n\s{2}\{\s*\n(?=\s{4}id:)/)
    .map(cleanChunk)
    .filter((chunk) => chunk.length > 80);
}

export class RagRetriever {
  constructor() {
    this.chunks = [];
    this.ready = false;
  }

  async load() {
    const responses = await Promise.all(SOURCE_URLS.map(async (source) => {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Unable to load ${source.name} source`);
      return { ...source, text: await response.text() };
    }));

    this.chunks = responses.flatMap((source) => {
      const parts = source.name === "CV" ? splitCv(source.text) : splitPortfolio(source.text);
      return parts.map((content, index) => ({
        id: `${source.name.toLowerCase()}-${index + 1}`,
        source: source.name,
        content,
        normalized: normalize(content),
        tokens: tokenize(content)
      }));
    });
    this.ready = this.chunks.length > 0;
    return this;
  }

  retrieve(query, limit = 5) {
    const queryTokens = tokenize(query);
    if (!this.ready || queryTokens.length === 0) {
      return { query, context: "", sources: [], found: false };
    }

    const ranked = this.chunks.map((chunk) => {
      let score = 0;
      for (const token of queryTokens) {
        const occurrences = chunk.normalized.split(token).length - 1;
        if (occurrences > 0) score += 1.5 + Math.min(occurrences, 4) * 0.45 + (token.length > 6 ? 0.8 : 0);
      }
      const phrase = normalize(query).trim();
      if (phrase.length > 8 && chunk.normalized.includes(phrase)) score += 6;
      return { ...chunk, score };
    }).filter((chunk) => chunk.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const context = ranked
      .map((chunk) => `[Source: ${chunk.source}; passage: ${chunk.id}]\n${chunk.content.slice(0, 2200)}`)
      .join("\n\n---\n\n")
      .slice(0, 9000);

    return {
      query,
      context,
      sources: [...new Set(ranked.map((chunk) => chunk.source))],
      found: ranked.length > 0,
      passageIds: ranked.map((chunk) => chunk.id)
    };
  }
}
