import fs from "fs/promises";
import OpenAI from "openai";
import { SOURCES } from "./sources.mjs";
import { readFeedMaybe, dedupe } from "./rss-utils.mjs";

const OPENAI_MODEL     = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SCORE_THRESHOLD  = parseInt(process.env.NEWS_SCORE_MIN  ?? "70", 10); // Score mini “haute importance”
const MAX_ITEMS_TOTAL  = parseInt(process.env.NEWS_MAX_ITEMS  ?? "60", 10); // Limite d’items analysés
const MIN_PUBLISH      = parseInt(process.env.NEWS_MIN_PUBLISH ?? "8", 10); // **Nouveau**: minimum d’items publiés (fallback)
const OUTPUT_PATH      = "public/news/feed.json";

function toISO(d) { try { return new Date(d).toISOString(); } catch { return null; } }

async function gatherAll() {
  const results = await Promise.all(SOURCES.map(readFeedMaybe));
  const all = results.flatMap(r => r.items);
  const unique = dedupe(all);
  // Tri par date (nulls en bas), borne haute
  unique.sort((a,b) => (new Date(b.published || 0)) - (new Date(a.published || 0)));
  return unique.slice(0, MAX_ITEMS_TOTAL);
}

function buildBatchedInput(items) {
  return items.map(it => ({
    role: "user",
    content: [
      { type: "text", text:
        "Tu es un assistant de veille pour l'éducation numérique/IA. " +
        "Retourne STRICTEMENT du JSON pour CHAQUE entrée, conformément à ce schéma: " +
        "{score:int[0..100], resume_fr:string(2-3 phrases), tags:string[2..5]}.\n" +
        "Grille: A) impact politique/réglementaire/standards (40), " +
        "B) portée internationale/institution majeure (25), " +
        "C) nouveauté étayée par source/rapport (20), " +
        "D) impact direct écoles/universités/enseignants (15)."
      },
      { type: "input_text", text: `${it.title}\n${it.url}\n${it.snippet || ""}` }
    ]
  }));
}

function safeParseArray(txt) {
  try { const v = JSON.parse(txt); return Array.isArray(v) ? v : null; }
  catch { return null; }
}

function extractJsonArrayFromResponses(resp) {
  // 1) Certaines versions exposent directement output_text
  if (resp?.output_text) {
    const arr = safeParseArray(resp.output_text);
    if (arr) return arr;
  }
  // 2) Sinon on agrège les blocs output[].content[].text
  try {
    const texts = [];
    for (const blk of resp.output || []) {
      for (const c of blk.content || []) {
        if (c.type === "output_text" || c.type === "text") texts.push(c.text);
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
    instructions: "Respecte EXACTEMENT le schéma JSON demandé, sans texte hors JSON.",
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
    const a = analyses?.[i] || {};
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

function localHeuristicScore(x) {
  // Heuristique simple si OpenAI échoue : mots-clés + source
  const t = `${x.title} ${x.source}`.toLowerCase();
  let s = 0;
  if (/\b(ai act|regulation|régulation|policy|politi(que|cs)|strategie|strategy|guideline|standard|framework)\b/.test(t)) s += 40;
  if (/\b(oecd|unesco|european commission|cnil|edps|ncsc|federal|minist(er|ry)|university|educause)\b/.test(t)) s += 25;
  if (/\b(report|rapport|study|étude|white ?paper|guidance|decision|décision|announcement)\b/.test(t)) s += 20;
  if (/\b(school|education|teacher|enseignant|universit|student|pupil|école)\b/.test(t)) s += 15;
  return Math.min(100, s);
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquant (GitHub Secrets).");
  }

  const gathered = await gatherAll();

  let analyzed = [];
  let analysisFailed = false;
  try {
    const analyses = await analyzeWithOpenAI(gathered);
    analyzed = attachAnalyses(gathered, analyses);
  } catch (e) {
    console.error("OpenAI analysis failed:", e.message);
    analysisFailed = true;
    // Fallback : scoring heuristique local pour ne pas tout filtrer à 0
    analyzed = gathered.map(it => ({
      title: it.title,
      url: it.url,
      source: it.source,
      published: it.published ? toISO(it.published) : null,
      score: localHeuristicScore(it),
      resume_fr: it.snippet || "",
      tags: []
    }));
  }

  // Tri par score décroissant, puis date
  const scored = [...analyzed].sort((a,b) => (b.score - a.score) || ((new Date(b.published||0)) - (new Date(a.published||0))));

  // 1) Filtre principal (seuil)
  let selected = scored.filter(x => (x.score ?? 0) >= SCORE_THRESHOLD);

  // 2) Fallback contrôlé : si rien (ou trop peu), on complète avec les meilleurs restants
  let fallbackUsed = false;
  if (selected.length < MIN_PUBLISH) {
    const need = MIN_PUBLISH - selected.length;
    const rest = scored.filter(x => !selected.includes(x)).slice(0, need);
    if (rest.length > 0) {
      fallbackUsed = true;
      selected = selected.concat(rest);
    }
  }

  // Cap de sécurité (30)
  selected = selected.slice(0, 30);

  const payload = {
    generatedAt: new Date().toISOString(),
    model: OPENAI_MODEL,
    threshold: SCORE_THRESHOLD,
    totalAnalyzed: analyzed.length,
    totalPublished: selected.length,
    debug: { analysisFailed, fallbackUsed, minPublish: MIN_PUBLISH },
    items: selected
  };

  await fs.mkdir("public/news", { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`OK: wrote ${selected.length} items to ${OUTPUT_PATH} (failed=${analysisFailed}, fallback=${fallbackUsed})`);
}

main().catch(err => { console.error(err); process.exit(1); });
