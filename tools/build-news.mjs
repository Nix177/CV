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
const PROFILE_DEFAULT  = (process.env.NEWS_PROFILE || "balanced").toLowerCase();
const PROFILES_RAW     = (process.env.NEWS_PROFILES || "").trim();
const PROFILES         = (PROFILES_RAW ? PROFILES_RAW : PROFILE_DEFAULT)
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

// Option : override des poids (R,P,I,M), ex: "40,25,20,15"
const CUSTOM_WEIGHTS_RAW = (process.env.NEWS_CUSTOM_WEIGHTS || "").trim();

// --------- Labels/Descriptions/Keywords ----------
const LABELS = {
  research:     process.env.NEWS_LABEL_RESEARCH     || "Recherche",
  policy:       process.env.NEWS_LABEL_POLICY       || "Politiques",
  institution:  process.env.NEWS_LABEL_INSTITUTION  || "Institution",
  impact:       process.env.NEWS_LABEL_IMPACT       || "Impact",
};

const DESCS = {
  research:     process.env.NEWS_DESC_RESEARCH     || "articles/journaux, conférences, CFP, résultats scientifiques",
  policy:       process.env.NEWS_DESC_POLICY       || "lois, régulations, standards, cadres, gouvernance",
  institution:  process.env.NEWS_DESC_INSTITUTION  || "communiqués des grandes agences et autorités (UNESCO, OCDE, CNIL, ministères…)",
  impact:       process.env.NEWS_DESC_IMPACT       || "impact direct pour la classe/enseignants/universités/EdTech",
};

function splitKeys(s, fallback) {
  const base = (s && s.trim()) ? s : fallback;
  return base.split(",").map(x => x.trim()).filter(Boolean);
}

const KEYS = {
  research: splitKeys(process.env.NEWS_KEYS_RESEARCH,
    "arxiv,preprint,doi,journal,conference,proceedings,workshop,submission,cfp,acceptance,springer,wiley,nature,frontiers,acm,ieee"),
  policy: splitKeys(process.env.NEWS_KEYS_POLICY,
    "ai act,regulation,régulation,policy,politique,standard,framework,guidance,law,act,ordonnance,décret,ethics,ethical"),
  institution: splitKeys(process.env.NEWS_KEYS_INSTITUTION,
    "unesco,oecd,ocde,cnil,edps,ncsc,minist,commission,nsf,ukri,ies,european commission"),
  impact: splitKeys(process.env.NEWS_KEYS_IMPACT,
    "school,education,teacher,enseignant,k-12,universit,student,pupil,mooc,classroom,edtech"),
};

function mkRegex(keys){
  const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp("(" + escaped.join("|") + ")", "i");
}
const RX = {
  research: mkRegex(KEYS.research),
  policy:   mkRegex(KEYS.policy),
  institution: mkRegex(KEYS.institution),
  impact:   mkRegex(KEYS.impact),
};

// --------- HELPERS ----------
function toISO(d) { try { return new Date(d).toISOString(); } catch { return null; } }
function toHttps(u) { if (!u) return u; if (u.startsWith("//")) return "https:"+u; if (u.startsWith("http://")) return "https://"+u.slice(7); return u; }
function host(u) { try { return new URL(u).hostname; } catch { return ""; } }
function favicon(u, size=128) { const h=host(u); return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=${size}` : ""; }
function absUrl(pageUrl, src){ try{ return new URL(src, pageUrl).toString(); }catch{ return null; } }
const clamp = (x,a,b)=> Math.max(a, Math.min(b, x|0));

const DEFAULT_W = {
  research: { research: 40, policy: 25, institution: 20, impact: 15 },
  balanced: { research: 35, policy: 35, institution: 15, impact: 15 },
  policy:   { research: 25, policy: 40, institution: 20, impact: 15 },
};

function parseCustomWeights(raw){
  if (!raw) return null;
  const parts = raw.split(",").map(x => clamp(parseInt(x,10), 0, 100));
  if (parts.length !== 4) return null;
  const s = parts.reduce((a,b)=>a+b,0);
  if (s <= 0) return null;
  const k = 100/s;
  const [r,p,i,m] = parts.map(v => Math.round(v*k));
  return { research:r, policy:p, institution:i, impact:m };
}

function getWeights(profile){
  const override = parseCustomWeights(CUSTOM_WEIGHTS_RAW);
  if (override) return override;
  return DEFAULT_W[profile] || DEFAULT_W.balanced;
}

// --- gather feeds ---
async function gatherAll() {
  const results = await Promise.all(SOURCES.map(readFeedMaybe));
  const all = results.flatMap(r => r.items);
  const unique = dedupe(all);
  unique.sort((a,b) => (new Date(b.published || 0)) - (new Date(a.published || 0)));
  return unique.slice(0, MAX_ITEMS_TOTAL);
}

// --- LLM prompt helpers ---
function buildPromptWeights(W) {
  return `Pondérations (total 100) — ${LABELS.research}: ${W.research}, ${LABELS.policy}: ${W.policy}, ${LABELS.institution}: ${W.institution}, ${LABELS.impact}: ${W.impact}.` +
  `\nDéfinitions: ${LABELS.research} = ${DESCS.research}; ${LABELS.policy} = ${DESCS.policy}; ${LABELS.institution} = ${DESCS.institution}; ${LABELS.impact} = ${DESCS.impact}.`;
}

function buildBatchedInput(items, W) {
  return items.map(it => ({
    role: "user",
    content: [
      { type: "text", text:
        "Tu es un assistant de veille pour l'éducation numérique/IA.\n" +
        "Retourne STRICTEMENT un JSON par entrée, schéma:\n" +
        "{score:int[0..100], resume_fr:string(2-3 phrases), tags:string[2..5], " +
        " breakdown: object<number>, reason:string(1 phrase)}.\n" +
        "Le champ breakdown DOIT contenir les clés EXACTES: research, policy, institution, impact (entiers 0..100), " +
        "où les clés correspondent aux catégories décrites ci-dessous.\n" +
        buildPromptWeights(W) +
        "\nPriorise: (i) articles/journaux/conférences (résultats, CFP, proceedings), " +
        "(ii) politiques/régulation/standards/éthique/philosophie si configuré, " +
        "(iii) communiqués d'institutions de premier plan."
      },
      { type: "input_text", text: `${it.title}\n${it.url}\n${it.snippet || ""}` }
    ]
  }));
}

function safeParseArray(txt){ try{ const v=JSON.parse(txt); return Array.isArray(v) ? v : null; }catch{ return null; } }

function extractJsonArrayFromResponses(resp) {
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
              required: ["score", "resume_fr", "tags", "breakdown", "reason"],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                resume_fr: { type: "string" },
                tags: { type: "array", minItems: 2, maxItems: 5, items: { type: "string" } },
                reason: { type: "string" },
                breakdown: {
                  type: "object",
                  additionalProperties: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100
                  },
                  required: ["research","policy","institution","impact"]
                }
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
    const bd = a.breakdown || {};
    const score = typeof a.score === "number" ? a.score :
      Math.min(100, (bd.research|0)+(bd.policy|0)+(bd.institution|0)+(bd.impact|0));
    return {
      title: it.title,
      url: it.url,
      source: it.source,
      published: it.published ? toISO(it.published) : null,
      score,
      resume_fr: a.resume_fr || it.snippet || "",
      tags: Array.isArray(a.tags) && a.tags.length ? a.tags.slice(0,5) : [],
      breakdown: {
        research: bd.research|0,
        policy: bd.policy|0,
        institution: bd.institution|0,
        impact: bd.impact|0
      },
      reason: a.reason || ""
    };
  });
}

function makeHeuristic(W){
  return function scoreWithBreakdown(x) {
    const t = `${x.title} ${x.source}`.toLowerCase();
    const bd = { research:0, policy:0, institution:0, impact:0 };
    if (RX.research.test(t))    bd.research    += W.research;
    if (RX.policy.test(t))      bd.policy      += W.policy;
    if (RX.institution.test(t)) bd.institution += W.institution;
    if (RX.impact.test(t))      bd.impact      += W.impact;
    const score = Math.min(100, bd.research + bd.policy + bd.institution + bd.impact);
    const reason = `Heuristique: ${LABELS.research}=${bd.research}, ${LABELS.policy}=${bd.policy}, ${LABELS.institution}=${bd.institution}, ${LABELS.impact}=${bd.impact}.`;
    return { score, breakdown: bd, reason };
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
  const top = items.slice(0, 40);
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
  const W = getWeights(profile);
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

    const local = makeHeuristic(W);
    analyzed = gathered.map(it => {
      const s = local(it);
      return {
        title: it.title,
        url: it.url,
        source: it.source,
        published: it.published ? toISO(it.published) : null,
        score: s.score,
        resume_fr: it.snippet || "",
        tags: [],
        breakdown: s.breakdown,
        reason: s.reason
      };
    });
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
    debug: {
      analysisFailed,
      minPublish: MIN_PUBLISH,
      weightsUsed: W,
      labelsUsed: LABELS,
      descUsed: DESCS,
      keysUsed: KEYS
    },
    items: selected
  };

  await fs.mkdir("public/news", { recursive: true });

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
  console.log(`Gathered ${gathered.length} unique items (max=${MAX_ITEMS_TOTAL}).`);

  const wanted = Array.from(new Set(PROFILES)).filter(p => ["balanced","research","policy"].includes(p));
  if (!wanted.length) wanted.push(PROFILE_DEFAULT);

  for (const p of wanted) {
    await buildForProfile(p, gathered);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
