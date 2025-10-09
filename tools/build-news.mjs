import fs from "fs/promises";
import OpenAI from "openai";
import * as cheerio from "cheerio";
import { SOURCES } from "./sources.mjs";
import { readFeedMaybe, dedupe } from "./rss-utils.mjs";

// --------- ENV ----------
const OPENAI_MODEL     = process.env.OPENAI_MODEL || "gpt-4o-mini";
const SCORE_THRESHOLD  = parseInt(process.env.NEWS_SCORE_MIN   ?? "65", 10);
const MAX_ITEMS_TOTAL  = parseInt(process.env.NEWS_MAX_ITEMS   ?? "100", 10);
const MIN_PUBLISH_DEF  = parseInt(process.env.NEWS_MIN_PUBLISH ?? "12", 10);
const OUTPUT_CAP_DEF   = parseInt(process.env.NEWS_OUTPUT_CAP  ?? "60", 10);
// Single profile fallback + multi-profiles list (comma-separated)
const PROFILE_DEFAULT  = (process.env.NEWS_PROFILE || "balanced").toLowerCase();
const PROFILES_RAW     = (process.env.NEWS_PROFILES || "").trim();
const PROFILES         = (PROFILES_RAW ? PROFILES_RAW : PROFILE_DEFAULT)
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

// --------- HELPERS ----------
function toISO(d) { try { return new Date(d).toISOString(); } catch { return null; } }
function toHttps(u) { if (!u) return u; if (u.startsWith("//")) return "https:"+u; if (u.startsWith("http://")) return "https://"+u.slice(7); return u; }
function host(u) { try { return new URL(u).hostname; } catch { return ""; } }
function favicon(u, size=128) { const h=host(u); return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${size}` : ""; }
function absUrl(pageUrl, src){ try{ return new URL(src, pageUrl).toString(); }catch{ return null; } }

const WEIGHTS = {
  research: { research: 40, policy: 25, institution: 20, impact: 15 },
  balanced: { research: 35, policy: 35, institution: 15, impact: 15 },
  policy:   { research: 25, policy: 40, institution: 20, impact: 15 },
};

async function gatherAll() {
  const results = await Promise.all(SOURCES.map(readFeedMaybe));
  const all = results.flatMap(r => r.items);
  const unique = dedupe(all);
  unique.sort((a,b) => (new Date(b.published || 0)) - (new Date(a.published || 0)));
  return unique.slice(0, MAX_ITEMS_TOTAL);
}

function buildPromptWeights(W) {
  return `Pondérations (total 100): RECHERCHE ${W.research}, POLITIQUES/RÉGULATION ${W.policy}, ` +
         `INSTITUTION ${W.institution}, IMPACT direct écoles/universités/enseignants ${W.impact}.`;
}

function buildBatchedInput(items, W) {
  return items.map(it => ({
    role: "user",
    content: [
      { type: "text", text:
        "Tu es un assistant de veille pour l'éducation numérique/IA. " +
        "Retourne STRICTEMENT du JSON pour CHAQUE entrée, schéma: " +
        "{score:int[0..100], resume_fr:string(2-3 phrases), tags:string[2..5]}.\n" +
        buildPromptWeights(W) +
        " Priorise: (i) articles/journaux/conférences (résultats, CFP, proceedings), " +
        "(ii) politiques/régulation majeures, (iii) communiqués d'institutions de premier plan."
      },
      { type: "input_text", text: `${it.title}\n${it.url}\n${it.snippet || ""}` }
    ]
  }));
}

function safeParseArray(txt){ try{ const v=JSON.parse(txt); return Array.isArray(v) ? v : null; }catch{ return null; } }

function extractJsonArrayFromResponses(resp) {
  // SDK Responses API: output_text (flat) OU output[].content[].text
  if (resp?.output_text) {
    const arr = safeParseArray(resp.output_text);
    if (arr) return arr;
  }
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

async function analyzeWithOpenAI(items, W) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const inputBlocks = buildBatchedInput(items, W);

  // ⚠️ Responses API : le format est maintenant sous text.format (plus sous response_format)
  // https://platform.openai.com/docs/assistants/migration (voir 'Text inputs and outputs' / Structured Outputs)
  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: "Respecte EXACTEMENT le schéma JSON demandé, sans texte hors JSON.",
    input: inputBlocks,
    max_output_tokens: 3500,
    text: {
      format: {
        type: "json_schema",
        json_schema: {
          name: "ActuEduList",
          strict: true,
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

function makeHeuristic(W){
  return function localHeuristicScore(x) {
    const t = `${x.title} ${x.source}`.toLowerCase();
    let s = 0;
    if (/\b(arxiv|preprint|doi|journal|conference|proceedings|workshop|submission|cfp|acceptance|springer|wiley|nature|frontiers|acm|ieee)\b/.test(t)) s += W.research;
    if (/\b(ai act|regulation|régulation|policy|politi(que|cs)|standard|framework|guidance|law|act|ordonnance|décret)\b/.test(t)) s += W.policy;
    if (/\b(unesc|oecd|cnil|edps|ncsc|minist|commission|solar|solaresearch|ies|us dept|edm|sigcse)\b/.test(t)) s += W.institution;
    if (/\b(school|education|teacher|enseignant|k-?12|universit|student|pupil|mooc|classroom|edtech)\b/.test(t)) s += W.impact;
    return Math.min(100, s);
  };
}

// --- Thumbnails (HTTPS only) ---
async function fetchHtml(url, ms = 7000) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "EduNewsBot/1.0" } });
    const ct = r.headers.get("content-type") || "";
    if (!r.ok || !ct.includes("text/html")) return null;
    return await r.text();
  } catch { return null; }
  finally { clearTimeout(tid); }
}

async function findThumbnail(u) {
  const html = await fetchHtml(u);
  if (!html) return favicon(u);
  const $ = cheerio.load(html);
  const cand = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('link[rel="image_src"]').attr("href")
  ].filter(Boolean).map(x => toHttps(absUrl(u, x)));
  const httpsImg = cand.find(x => x && x.startsWith("https://"));
  return httpsImg || favicon(u);
}

async function enrichThumbnails(items, concurrency = 10) {
  const top = items.slice(0, 40); // limite requêtes
  let i = 0;
  async function worker() {
    while (i < top.length) {
      const idx = i++;
      const it = top[idx];
      try { it.image = await findThumbnail(it.url); }
      catch { it.image = favicon(it.url); }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  items.slice(40).forEach(it => { it.image = favicon(it.url); });
}

// --------- BUILD FOR ONE PROFILE ----------
async function buildForProfile(profile, gathered) {
  const W = WEIGHTS[profile] || WEIGHTS.balanced;
  const localScore = makeHeuristic(W);
  const MIN_PUBLISH = MIN_PUBLISH_DEF;
  const OUTPUT_CAP  = OUTPUT_CAP_DEF;

  let analyzed = [];
  let analysisFailed = false;

  try {
    const analyses = await analyzeWithOpenAI(gathered, W);
    analyzed = attachAnalyses(gathered, analyses);
  } catch (e) {
    console.error(`[${profile}] OpenAI analysis failed:`, e?.message || e);
    analysisFailed = true;
    analyzed = gathered.map(it => ({
      title: it.title,
      url: it.url,
      source: it.source,
      published: it.published ? toISO(it.published) : null,
      score: localScore(it),
      resume_fr: it.snippet || "",
      tags: []
    }));
  }

  const ranked = [...analyzed].sort((a,b) =>
    (b.score - a.score) || ((new Date(b.published||0)) - (new Date(a.published||0)))
  );

  let selected = ranked.filter(x => (x.score ?? 0) >= SCORE_THRESHOLD);
  if (selected.length < MIN_PUBLISH) {
    selected = selected.concat(ranked.filter(x => !selected.includes(x)).slice(0, MIN_PUBLISH - selected.length));
  }
  selected = selected.slice(0, OUTPUT_CAP);

  await enrichThumbnails(selected);

  const payload = {
    generatedAt: new Date().toISOString(),
    model: OPENAI_MODEL,
    profile,
    threshold: SCORE_THRESHOLD,
    totalAnalyzed: analyzed.length,
    totalPublished: selected.length,
    debug: { analysisFailed, minPublish: MIN_PUBLISH },
    items: selected
  };

  await fs.mkdir("public/news", { recursive: true });

  // balanced => écrit 2 fichiers (compat)
  if (profile === "balanced") {
    await fs.writeFile("public/news/feed.json", JSON.stringify(payload, null, 2), "utf8");
    await fs.writeFile("public/news/feed-balanced.json", JSON.stringify(payload, null, 2), "utf8");
    console.log(`OK: wrote ${selected.length} items to public/news/feed.json (+ feed-balanced.json)`);
  } else {
    await fs.writeFile(`public/news/feed-${profile}.json`, JSON.stringify(payload, null, 2), "utf8");
    console.log(`OK: wrote ${selected.length} items to public/news/feed-${profile}.json`);
  }
}

// --------- MAIN ----------
async function main() {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant (GitHub Secrets).");

  const gathered = await gatherAll();

  // déduplique et journalise
  console.log(`Gathered ${gathered.length} unique items (max=${MAX_ITEMS_TOTAL}).`);

  // profils à produire
  const wanted = Array.from(new Set(PROFILES)).filter(p => ["balanced","research","policy"].includes(p));
  if (!wanted.length) wanted.push(PROFILE_DEFAULT);

  for (const p of wanted) {
    await buildForProfile(p, gathered);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
