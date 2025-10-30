// api/llm.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

/* ---------------- CORS helpers ---------------- */
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function setCORS(res: VercelResponse, req: VercelRequest) {
  const origin = (req.headers?.origin as string) || '*';
  const allow =
    ALLOWED.includes('*') || ALLOWED.includes(origin) ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, x-user-api-key'
  );
}

/* ---------------- utils ---------------- */
function baseURL() {
  return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}

function getApiKey(req: VercelRequest): string | null {
  // durci: supporte différentes casses + headers manquants
  const h = (req.headers || {}) as Record<string, any>;
  const user =
    (h['x-user-api-key'] ??
      h['X-User-Api-Key'] ??
      h['x-User-Api-Key'] ??
      '') + '';
  const trimmed = user.trim();
  return trimmed || process.env.OPENAI_API_KEY || null;
}

async function readJSON(req: VercelRequest) {
  if (!('body' in req) || req.body == null) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body as any;
}

async function fetchJSON(url: string, init: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(text || `${r.status} ${r.statusText}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function urlToBase64(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch image failed: ${r.status} ${r.statusText}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab).toString('base64');
}

/* ---------------- handlers ---------------- */
async function handleChat(
  req: VercelRequest,
  res: VercelResponse,
  body: any
) {
  const { messages = [], model = process.env.MODEL_NAME || 'gpt-4o-mini' } =
    body || {};
  const key = getApiKey(req);

  if (!key) {
    // demo sans clé
    const content = 'Demo mode: no API key.';
    return res.json({
      model: 'mock',
      choices: [
        { index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }

  // ⚠️ pas de temperature si modèle ne le supporte pas
  const payload: any = { model, messages };
  const data = await fetchJSON(`${baseURL()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json(data);
}

async function handleImage(
  req: VercelRequest,
  res: VercelResponse,
  body: any
) {
  const { prompt, model = 'gpt-image-1', size = '1024x1024', n = 1 } =
    body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing "prompt" (string)' });
  }

  const key = getApiKey(req);
  if (!key) {
    // pixel transparent mock
    const blank =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAnMBcKk9S9oAAAAASUVORK5CYII=';
    return res.json({ mode: 'image', model: 'mock', image_base64: blank });
  }

  // IMPORTANT : ne PAS envoyer response_format (c’était la cause du 400)
  const payload: any = { model, prompt, size, n };
  const resp = await fetchJSON(`${baseURL()}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // Normaliser en base64
  const first = resp?.data?.[0] || {};
  let b64: string | undefined = first.b64_json;
  if (!b64 && first.url) b64 = await urlToBase64(first.url as string);
  if (!b64) return res.status(502).json({ error: 'No image returned from provider' });

  return res.json({ mode: 'image', model, image_base64: b64 });
}

/* ---------------- single entry ---------------- */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    setCORS(res, req);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).send('method not allowed');

    const body = await readJSON(req); // on lit une fois
    if (body?.mode === 'image') return await handleImage(req, res, body);
    return await handleChat(req, res, body);
  } catch (e: any) {
    // éviter 500 silencieux
    res.status(500).json({ error: e?.message || 'server error' });
  }
}
