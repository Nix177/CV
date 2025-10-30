// /api/llm.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMG_URL  = 'https://api.openai.com/v1/images/generations';

// util petit
const norm = (s?: string | string[]) =>
  ((Array.isArray(s) ? s[0] : s) || '').toLowerCase().replace(/\/$/, '');

function getOrigin(req: VercelRequest): string | null {
  const o = norm(req.headers.origin as any);
  if (o) return o;
  const r = norm(req.headers.referer as any);
  if (!r) return null;
  try { const u = new URL(r); return `${u.protocol}//${u.host}`; } catch { return null; }
}

function setCors(res: VercelResponse, origin: string | '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Api-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getOrigin(req);
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(s => s.toLowerCase().replace(/\/$/, ''));

  const sameHost = (req.headers.host || '').toString().toLowerCase();
  const thisHostHTTP  = sameHost ? `http://${sameHost}`  : '';
  const thisHostHTTPS = sameHost ? `https://${sameHost}` : '';
  const isAllowed =
    !origin ||
    allowed.includes(origin) ||
    origin === thisHostHTTP ||
    origin === thisHostHTTPS;

  if (req.method === 'OPTIONS') {
    if (isAllowed) {
      setCors(res, origin || '*');
      return res.status(204).end();
    }
    return res.status(403).json({ error: 'Forbidden origin (preflight)', seen: origin, allowed });
  }

  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden origin', seen: origin, allowed });
  }

  setCors(res, origin || '*');

  if (req.method !== 'POST')
    return res.status(405).send('POST only');

  try {
    const {
      mode = 'chat',
      model = 'gpt-5',
      messages = [],
      prompt,
      size = '1024x1024'
    } = req.body || {};

    // clé : user > env
    const userKey = (req.headers['x-user-api-key'] || '').toString().trim();
    const apiKey = userKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OpenAI API key (server side)' });
    }

    // --- MODE IMAGE --------------------------------------------------------
    if (mode === 'image') {
      // on attend un prompt
      const finalPrompt = prompt || (messages?.[0]?.content ?? 'A cute cat');
      const r = await fetch(OPENAI_IMG_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: finalPrompt,
          size,
          n: 1,
          response_format: 'b64_json'
        })
      });

      const j = await r.json();
      if (!r.ok) {
        return res.status(r.status).json(j);
      }
      // on renvoie direct b64
      return res.status(200).json({
        mode: 'image',
        prompt: finalPrompt,
        image_base64: j.data?.[0]?.b64_json || null
      });
    }

    // --- MODE TEXTE (par défaut) -------------------------------------------
    // IMPORTANT : ton environnement a remonté une erreur si on mettait temperature=0.2
    // → on n’envoie PAS temperature, on laisse le défaut du modèle.
    const rr = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages
      })
    });

    const jj = await rr.json();
    if (!rr.ok) {
      return res.status(rr.status).json(jj);
    }
    return res.status(200).json(jj);

  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
