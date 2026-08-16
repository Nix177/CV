// api/llm.js
export const config = { runtime: 'nodejs' };

/* ---------------- CORS ---------------- */
const ALLOWED = (process.env.ALLOWED_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function setCORS(res, req) {
  const origin = req.headers?.origin || '*';
  const allow =
    ALLOWED.includes('*') || ALLOWED.includes(origin) ? origin : '*';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-api-key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
}

/* ---------------- utils ---------------- */
function baseURL() {
  return process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
}

function getApiKey(req) {
  // headers durcis (case-insensitive)
  const h = req.headers || {};
  const user =
    (h['x-user-api-key'] ??
      h['X-User-Api-Key'] ??
      h['x-User-Api-Key'] ??
      '') + '';
  const trimmed = user.trim();
  return trimmed || process.env.OPENAI_API_KEY || null;
}

async function readJSON(req) {
  if (!('body' in req) || req.body == null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

async function fetchJSON(url, init) {
  const r = await fetch(url, init);
  const text = await r.text();
  if (!r.ok) throw new Error(text || `${r.status} ${r.statusText}`);
  try { return JSON.parse(text); } catch { return text; }
}

async function urlToBase64(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Fetch image failed: ${r.status} ${r.statusText}`);
  const ab = await r.arrayBuffer();
  return Buffer.from(ab).toString('base64');
}

/* ---------------- handlers ---------------- */
async function handleChat(req, res, body) {
  const { messages = [], model = (process.env.MODEL_NAME || 'gpt-4o-mini') } = body || {};
  const key = getApiKey(req);

  if (!key) {
    // Demo sans clé serveur/visiteur
    const content = 'Demo mode: no API key (set OPENAI_API_KEY on Vercel or provide x-user-api-key).';
    return res.json({
      model: 'mock',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    });
  }

  // ⚠️ ne pas forcer temperature (certains modèles ne le supportent pas)
  const payload = { model, messages };
  const data = await fetchJSON(`${baseURL()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json(data);
}

async function handleImage(req, res, body) {
  // Par défaut on évite gpt-image-1 (souvent gated) → dall-e-3
  const {
    prompt,
    model: requestedModel = 'dall-e-3',
    size = '1024x1024',
    n = 1
  } = body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing "prompt" (string)' });
  }

  const key = getApiKey(req);
  if (!key) {
    // pixel transparent mock
    const blank = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAnMBcKk9S9oAAAAASUVORK5CYII=';
    return res.json({ mode: 'image', model: 'mock', image_base64: blank });
  }

  const tryGenerate = async (modelName) => {
    // IMPORTANT : ne PAS envoyer response_format (cause de 400 chez certains proxys)
    const payload = { model: modelName, prompt, size, n };
    const resp = await fetchJSON(`${baseURL()}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const first = resp?.data?.[0] || {};
    let b64 = first.b64_json;
    if (!b64 && first.url) b64 = await urlToBase64(first.url);
    if (!b64) throw new Error('No image returned from provider');
    return { image_base64: b64, used_model: modelName };
  };

  try {
    // 1) tenter le modèle demandé (peut être gpt-image-1 si l’utilisateur le force)
    const out = await tryGenerate(requestedModel);
    return res.json({ mode: 'image', model: out.used_model, image_base64: out.image_base64 });
  } catch (e) {
    const msg = String(e?.message || '');

    // 2) fallback automatique → dall-e-3 si gating / pas d’accès
    const shouldFallback =
      requestedModel !== 'dall-e-3' &&
      (msg.includes('must be verified') ||
       msg.includes('not available') ||
       msg.includes('do not have access') ||
       msg.includes('organization') ||
       msg.includes('forbidden'));

    if (shouldFallback) {
      try {
        const out2 = await tryGenerate('dall-e-3');
        return res.json({
          mode: 'image',
          model: out2.used_model,
          image_base64: out2.image_base64,
          fallbackFrom: requestedModel,
          note: 'Le modèle image demandé est indisponible pour cette clé ; utilisation de dall-e-3.'
        });
      } catch (e2) {
        return res.status(502).json({
          error: 'image_upstream_error',
          message: String(e2?.message || 'fallback failed'),
          original_error: msg
        });
      }
    }

    // 3) sinon, renvoyer une erreur claire
    if (msg.includes('must be verified')) {
      return res.status(403).json({
        error: 'image_model_unavailable',
        message: 'Le modèle image demandé est indisponible pour cette clé (organisation non vérifiée). Utilise dall-e-3 ou vérifie ton organisation.'
      });
    }
    return res.status(502).json({ error: 'image_upstream_error', message: msg });
  }
}

/* ---------------- entrypoint ---------------- */
export default async function handler(req, res) {
  setCORS(res, req);
  try {
    if (req.method === 'OPTIONS') return res.status(204).end();

    // GET health: vérifier que la clé serveur est visible par la Function
    if (req.method === 'GET') {
      const hasKey = !!process.env.OPENAI_API_KEY;
      return res.json({ ok: true, hasServerKey: hasKey });
    }

    if (req.method !== 'POST') return res.status(405).send('method not allowed');

    const body = await readJSON(req);
    if (body?.mode === 'image') return await handleImage(req, res, body);
    return await handleChat(req, res, body);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'server error' });
  }
}
