import fs from "fs/promises";
import OpenAI from "openai";
import { SOURCES } from "./sources.mjs";
import { readFeedMaybe, dedupe } from "./rss-utils.mjs";

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SCORE_THRESHOLD = parseInt(process.env.NEWS_SCORE_MIN ?? "70", 10); // garde >= 70
const MAX_ITEMS_TOTAL = parseInt(process.env.NEWS_MAX_ITEMS ?? "60", 10); // borne haute agrégée
const OUTPUT_PATH = "public/news/feed.json";

function toISO(d) { try { return new Date(d).toISOString(); } catch { return null; } }

async function gatherAll() {
  const results = await Promise.all(SOURCES.map(readFeedMaybe));
  const all = results.flatMap(r => r.items);
  const unique = dedupe(all);
  // Tri par date (nulls en bas), garde une borne haute pour la requête OpenAI
  unique.sort((a,b) => (new Date(b.published || 0)) - (new Date(a.published || 0)));
  return unique.slice(0, MAX_ITEMS_TOTAL);
}

function buildBatchedInput(items) {
  // Entrées batched pour Responses API (JSON structuré)
  return items.map(it => ({
    role: "user",
    content: [
      { type: "text", text:
        "Tu es un assistant de veille pour l'éducation numérique/IA. " +
        "Retourne STRICTEMENT du JSON respectant le schéma: " +
        "{score:int[0..100], resume_fr:string[2-3 phrases], tags:string[2..5]}.\n" +
        "Grille de score: A) impact politique/réglementaire/standards (40), " +
        "B) portée internationale/institution majeure (25), " +
        "C) nouveauté étayée par source/rapport (20), " +
        "D) impact direct écoles/universités/enseignants (15). "
      },
      { type: "input_text", text:
        `${it.title}\n${it.url}\n${it.snippet || ""}`
      }
    ]
  }));
}

function safeParseArray(jsonText) {
  try { const v = JSON.parse(jsonText); return Array.isArray(v) ? v : null; }
  catch { return null; }
}

function extractJsonArrayFromResponses(resp) {
  // openai.responses.create => on tente différentes voies selon la version du SDK
  if (resp?.output_text) {
    const arr = safeParseArray(resp.output_text);
    if (arr) return arr;
  }
  // Parcours des blocs "output"
  try {
    const texts = [];
    for (const blk of resp.output || []) {
      for (const c of blk.content || []) {
        if (c.type === "output_text" || c.type === "text") {
          texts.push(c.text);
        }
      }
    }
    const joined = texts.join("\n");
    const arr = safeParseArray(joined);
    if (arr) return arr;
  } catch {}
  throw new Error("Impossible d'extraire le JSON structuré de la réponse OpenAI.");
}

async function analyzeWithOpenAI(items) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inputBlocks = buildBatchedInput(items);

  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: "Respecte exactement le schéma JSON demandé, sans texte hors JSON.",
    input: inputBlocks,
    max_output_tokens: 3500,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ActuEduList",
        schema: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["score", "resume_fr", "tags"],
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              resume_fr: { type: "string" },
              tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } }
            }
          }
        }
      }
    }
  });

  return extractJsonArrayFromResponses(resp);
}

function attachAnalyses(items, analyses) {
  return items.map((it, i) => {
    const a = analyses[i] || {};
    return {
      title: it.title,
      url: it.url,
      source: it.source,
      published: it.published ? toISO(it.published) : null,
      score: typeof a.score === "number" ? a.score : 0,
      resume_fr: a.resume_fr || it.snippet || "",
      tags: Array.isArray(a.tags) && a.tags.length ? a.tags.slice(0,5) : []
    };
  });
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquant (GitHub Secrets).");
  }

  const gathered = await gatherAll();
  let analyzed;
  try {
    const analyses = await analyzeWithOpenAI(gathered);
    analyzed = attachAnalyses(gathered, analyses);
  } catch (e) {
    console.error("OpenAI analysis failed:", e.message);
    // Fallback: pas de score, résumés = snippet
    analyzed = attachAnalyses(gathered, []);
  }

  const filtered = analyzed
    .filter(x => (x.score ?? 0) >= SCORE_THRESHOLD)
    .sort((a, b) => (new Date(b.published || 0)) - (new Date(a.published || 0)));

  const payload = {
    generatedAt: new Date().toISOString(),
    model: OPENAI_MODEL,
    threshold: SCORE_THRESHOLD,
    totalAnalyzed: analyzed.length,
    totalPublished: filtered.length,
    items: filtered.slice(0, 30)
  };

  await fs.mkdir("public/news", { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`OK: wrote ${filtered.length} items to ${OUTPUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
