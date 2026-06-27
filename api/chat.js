// api/chat.js — Backend RAG + Streaming + Multi-Model
// - RAG : index local simple basé sur public/cv-text.txt et public/portfolio-data.js.
// - Streaming : réponse OpenAI en flux texte direct.
// - Multi-Model : modèles configurables via OPENAI_CHAT_MODEL et GEMINI_CHAT_MODEL.

import fs from "node:fs";
import path from "node:path";

export const config = { runtime: "nodejs" }; // Vercel: Force Node.js runtime for fs access

const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.5";
const DEFAULT_GEMINI_CHAT_MODEL = "gemini-2.5-pro";

class UpstreamError extends Error {
  constructor(provider, status, body) {
    super(`${provider} upstream error: ${status}`);
    this.name = "UpstreamError";
    this.provider = provider;
    this.status = status;
    this.body = body;
  }
}

function envTrim(name) {
  return (process.env[name] || "").trim();
}

function getOpenAIChatModel() {
  return envTrim("OPENAI_CHAT_MODEL") || DEFAULT_OPENAI_CHAT_MODEL;
}

function getGeminiChatModel() {
  return envTrim("GEMINI_CHAT_MODEL") || DEFAULT_GEMINI_CHAT_MODEL;
}

function normalizeGeminiModel(model) {
  return String(model || "").trim().replace(/^models\//, "");
}

function sanitizeForLog(value) {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza***")
    .slice(0, 4000);
}

async function readUpstreamErrorBody(response) {
  try {
    return await response.text();
  } catch (e) {
    return `[unable to read upstream error body: ${e.message}]`;
  }
}

function logUpstreamError(provider, status, body) {
  console.error(`${provider} upstream error`, {
    status,
    body: sanitizeForLog(body)
  });
}

function toUserErrorMessage(error) {
  if (error instanceof UpstreamError) {
    if (error.status === 429) {
      return `${error.provider} a atteint une limite d'utilisation ou de quota (429). Réessayez plus tard, vérifiez le quota API, ou basculez vers l'autre fournisseur si disponible.`;
    }
    return `${error.provider} a renvoyé une erreur (${error.status}). Réessayez plus tard ou changez de fournisseur.`;
  }

  if (error?.message === "Missing OPENAI_API_KEY") {
    return "Clé OpenAI manquante côté serveur. Configurez OPENAI_API_KEY dans Vercel ou choisissez Gemini si GOOGLE_API_KEY est disponible.";
  }
  if (error?.message === "Missing GOOGLE_API_KEY") {
    return "Clé Google manquante côté serveur. Configurez GOOGLE_API_KEY dans Vercel ou choisissez OpenAI si OPENAI_API_KEY est disponible.";
  }

  return `Erreur serveur: ${error.message}`;
}

// --- Utils: Basic TF-IDF RAG (In-Memory) ---
function chunkText(text, sourceName) {
  if (!text) return [];
  return text.split(/\n\s*\n|===/)
    .map(t => t.trim())
    .filter(t => t.length > 30)
    .map(content => ({
      source: sourceName,
      content,
      tokens: content.toLowerCase().match(/\w+/g) || []
    }));
}

function computeTFIDF(query, chunks) {
  const qTokens = String(query || "").toLowerCase().match(/\w+/g) || [];
  if (!qTokens.length) return chunks.slice(0, 3);

  return chunks.map(chunk => {
    let score = 0;
    const chunkContent = chunk.content.toLowerCase();

    qTokens.forEach(qt => {
      if (chunkContent.includes(qt)) {
        score += 1;
        if (qt.length > 4) score += 2;
      }
    });

    return { ...chunk, score };
  }).sort((a, b) => b.score - a.score);
}

// --- Utils: File Reading ---
function safeReadPublic(rel) {
  try {
    const p = path.join(process.cwd(), "public", rel);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  } catch {
    // Ignore missing optional context files.
  }
  return "";
}

function getPortfolioData() {
  return safeReadPublic("portfolio-data.js");
}

// --- Providers ---

async function streamOpenAI(res, messages, temp, model = getOpenAIChatModel()) {
  const openAIKey = envTrim("OPENAI_API_KEY");
  const openAIUrl = "https://api.openai.com/v1/chat/completions";

  if (!openAIKey) throw new Error("Missing OPENAI_API_KEY");

  const r = await fetch(openAIUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openAIKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: temp,
      stream: true
    })
  });

  if (!r.ok) {
    const errBody = await readUpstreamErrorBody(r);
    logUpstreamError("OpenAI", r.status, errBody);
    throw new UpstreamError("OpenAI", r.status, errBody);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    for (const line of lines) {
      if (line.trim() === "data: [DONE]") continue;
      if (!line.startsWith("data: ")) continue;

      try {
        const json = JSON.parse(line.slice(6));
        const txt = json.choices?.[0]?.delta?.content || "";
        if (txt) res.write(txt);
      } catch (e) {
        console.error("OpenAI stream JSON parse error", e.message);
      }
    }
  }
}

function buildGeminiPayload(messages, temp) {
  const systemText = messages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .join("\n\n")
    .trim();

  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

  return {
    contents,
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    generationConfig: { temperature: temp }
  };
}

async function generateGoogleText(messages, temp, model = getGeminiChatModel()) {
  const googleKey = envTrim("GOOGLE_API_KEY");
  if (!googleKey) throw new Error("Missing GOOGLE_API_KEY");

  const selectedModel = normalizeGeminiModel(model) || DEFAULT_GEMINI_CHAT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent?key=${encodeURIComponent(googleKey)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildGeminiPayload(messages, temp))
  });

  if (!r.ok) {
    const errBody = await readUpstreamErrorBody(r);
    logUpstreamError("Google", r.status, errBody);
    throw new UpstreamError("Google", r.status, errBody);
  }

  const json = await r.json();
  const parts = json.candidates?.[0]?.content?.parts || [];
  const txt = parts.map(p => p.text || "").join("").trim();
  return txt || "Gemini n'a pas renvoyé de texte exploitable.";
}

function getTemperature(liberty) {
  return Number(liberty) === 2 ? 0.7 : 0.3;
}

function buildMessages({ message, liberty, concise, lang }) {
  const cvText = safeReadPublic("cv-text.txt");
  const portfolioText = getPortfolioData();
  const allChunks = [
    ...chunkText(cvText, "CV"),
    ...chunkText(portfolioText, "Portfolio")
  ];

  const relevantChunks = computeTFIDF(message, allChunks).slice(0, 5);
  const contextText = relevantChunks.map(c => `[Source: ${c.source}]\n${c.content}`).join("\n---\n");

  const localizedInstructions = {
    fr: `Tu es l'assistant de recrutement de Nicolas Tuor. Réponds en français. ${concise ? "Sois concis." : ""} Utilise exclusivement le contexte ci-dessous. Si l'information n'y est pas, dis que tu ne sais pas ou propose de contacter Nicolas.`,
    en: `You are Nicolas Tuor's recruiting assistant. Answer in English. ${concise ? "Be concise." : ""} Use only the context below. If the information is missing, say you do not know or suggest contacting Nicolas.`,
    de: `Du bist der Rekrutierungsassistent von Nicolas Tuor. Antworte auf Deutsch. ${concise ? "Fasse dich kurz." : ""} Nutze nur den untenstehenden Kontext. Wenn die Information fehlt, sage, dass du es nicht weißt, oder schlage vor, Nicolas zu kontaktieren.`
  };

  const instructions = localizedInstructions[lang] || localizedInstructions.fr;
  const systemPrompt = `${instructions}\n\n=== CONTEXTE STRICT (RAG) ===\n${contextText}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: message }
  ];
}

function setStreamHeaders(res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
}

async function writeGoogleResponse(res, messages, temp) {
  const txt = await generateGoogleText(messages, temp);
  res.write(txt);
}

async function writeOpenAIResponseWithFallback(res, messages, temp) {
  try {
    await streamOpenAI(res, messages, temp);
  } catch (e) {
    if (e instanceof UpstreamError && e.provider === "OpenAI" && e.status === 429 && envTrim("GOOGLE_API_KEY")) {
      res.write(`${toUserErrorMessage(e)}\nBascule automatique vers Gemini disponible, tentative en cours...\n\n`);
      await writeGoogleResponse(res, messages, temp);
      return;
    }
    throw e;
  }
}

// Handler Main
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).json({ ok: true, ping: "pong" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { message, liberty = 2, concise = false, lang = "fr", provider = "openai" } = body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ ok: false, error: "Missing message" });
    }

    const messages = buildMessages({ message, liberty, concise, lang });
    const temp = getTemperature(liberty);

    setStreamHeaders(res);

    if (provider === "google") {
      await writeGoogleResponse(res, messages, temp);
    } else {
      await writeOpenAIResponseWithFallback(res, messages, temp);
    }

    res.end();
  } catch (e) {
    if (e instanceof UpstreamError) {
      console.error("Chat upstream failure", { provider: e.provider, status: e.status });
    } else {
      console.error("Chat handler error", e);
    }

    if (!res.headersSent) setStreamHeaders(res);
    res.write(`\n[${toUserErrorMessage(e)}]`);
    res.end();
  }
}

export {
  DEFAULT_OPENAI_CHAT_MODEL,
  DEFAULT_GEMINI_CHAT_MODEL,
  UpstreamError,
  buildGeminiPayload,
  getOpenAIChatModel,
  getGeminiChatModel,
  normalizeGeminiModel,
  toUserErrorMessage
};
