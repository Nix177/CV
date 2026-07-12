const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const DEFAULT_LIVE_VOICE = "Sadaltager";
const TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 8;

const rateBuckets = globalThis.__cvLiveTokenRateBuckets || new Map();
globalThis.__cvLiveTokenRateBuckets = rateBuckets;

function envTrim(name) {
  return String(process.env[name] || "").trim();
}

function sanitizeForLog(value) {
  return String(value || "")
    .replace(/AIza[0-9A-Za-z_-]+/g, "AIza***")
    .replace(/AQ\.[0-9A-Za-z_-]+/g, "AQ.***")
    .slice(0, 4000);
}

function getClientId(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.socket?.remoteAddress || "unknown");
}

function isRateLimited(req) {
  const now = Date.now();
  const id = getClientId(req);
  const previous = rateBuckets.get(id) || [];
  const recent = previous.filter((time) => now - time < RATE_WINDOW_MS);
  recent.push(now);
  rateBuckets.set(id, recent);
  return recent.length > RATE_LIMIT;
}

function getAllowedOrigins(req) {
  const configured = envTrim("ALLOWED_ORIGINS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const host = String(req.headers.host || "").trim();
  if (host) configured.push(`https://${host}`, `http://${host}`);
  configured.push("http://localhost:3000", "http://127.0.0.1:3000");
  return new Set(configured);
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "").trim();
  if (!origin) return true;
  if (!getAllowedOrigins(req).has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

async function readErrorBody(response) {
  try {
    return await response.text();
  } catch (error) {
    return `[unable to read Gemini token error: ${error.message}]`;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (!applyCors(req, res)) {
    return res.status(403).json({ ok: false, error: "Origin not allowed" });
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (isRateLimited(req)) return res.status(429).json({ ok: false, error: "Too many live session requests" });

  const apiKey = envTrim("GOOGLE_API_KEY") || envTrim("GEMINI_API_KEY");
  if (!apiKey) {
    return res.status(503).json({
      ok: false,
      error: "Gemini Live is not configured on the server"
    });
  }

  const model = envTrim("GEMINI_LIVE_MODEL") || DEFAULT_LIVE_MODEL;
  const voice = envTrim("GEMINI_LIVE_VOICE") || DEFAULT_LIVE_VOICE;
  const now = Date.now();
  const expireTime = new Date(now + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(now + 60 * 1000).toISOString();

  try {
    const response = await fetch(`${TOKEN_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uses: 1,
        expireTime,
        newSessionExpireTime
      })
    });

    if (!response.ok) {
      const body = await readErrorBody(response);
      console.error("Gemini auth token upstream error", {
        status: response.status,
        body: sanitizeForLog(body)
      });
      return res.status(502).json({
        ok: false,
        error: response.status === 429
          ? "Gemini Live quota or rate limit reached"
          : "Unable to create a Gemini Live session"
      });
    }

    const token = await response.json();
    if (!token?.name) {
      console.error("Gemini auth token response did not contain a token name");
      return res.status(502).json({ ok: false, error: "Invalid Gemini Live token response" });
    }

    return res.status(200).json({
      ok: true,
      token: token.name,
      model,
      voice,
      expiresAt: expireTime
    });
  } catch (error) {
    console.error("Gemini auth token request failed", sanitizeForLog(error?.message));
    return res.status(502).json({ ok: false, error: "Gemini Live connection failed" });
  }
}

export { DEFAULT_LIVE_MODEL, DEFAULT_LIVE_VOICE };
