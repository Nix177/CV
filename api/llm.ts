// /api/llm.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_IMG_URL  = 'https://api.openai.com/v1/images/generations';

// normalise un origin
const norm = (s?: string | string[]) =>
  ((Array.isArray(s) ? s[0] : s) || '').toLowerCase().replace(/\/$/, '');

// récupère l’origine réelle
function getOrigin(req: VercelRequest): string | null {
  const o = norm(req.headers.origin as any);
  if (o) return o;
  const ref = norm(req.headers.referer as any);
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// ALLOWED_ORIGINS est une seule ligne séparée par des virgules
function parseAllowed(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim().toLowerCase().replace(/\/$/, ''))
    .filter(Boolean);
}

function sameHost(req: VercelRequest): string[] {
  const host = (req.headers.host || '').toString().toLowerCase();
  return host ? [`http://${host}`, `https://${host}`] : [];
}

function matchOrigin(origin: string | null, pattern: string): boolean {
  if (pattern === '*') return true;
  if (pattern === 'null') return origin === null;
  if (!origin) return false;

  // pattern *.domaine.tld
  if (pattern.startsWith('*.')) {
    try {
      const oh = new URL(origin).host;
      const suffix = pattern.slice(2);
      return oh === suffix || oh.endsWith('.' + suffix);
    } catch {
      return false;
    }
  }
  return origin === pattern;
}

function setCors(res: VercelResponse, origin: string | '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-User-Api-Key'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getOrigin(req);
  const allowList = parseAllowed();
  const same = sameHost(req);

  const isAllowed =
    (origin &&
      (allowList.some(p => matchOrigin(origin, p)) ||
        same.includes(origin))) ||
    (!origin && allowList.includes('null'));

  // préflight
  if (req.method === 'OPTIONS') {
    if (isAllowed) {
      setCors(res, origin || '*');
      return res.status(204).end();
    }
    return res
      .status(403)
      .json({ error: 'Forbidden origin (preflight)', seen: origin, allowed: allowList });
  }

  if (!isAllowed) {
    return res
      .status(403)
      .json({ error: 'Forbidden origin', seen: origin, allowed: allowList });
  }

  setCors(res, origin || '*');

  if (req.method !== 'POST') {
    return res.status(405).send('POST only');
  }

  // on regarde la "sous-route"
  // /api/llm            -> chat
  // /api/llm/image      -> image
  const path = (req.url || '').split('?')[0] || '/api/llm';
  const isImage = path.endsWith('/image');

  try {
    // ---- CAS IMAGE ---------------------------------------------------------
    if (isImage) {
      const { prompt, model = 'gpt-image-1', size = '1024x1024' } =
        (req.body as any) || {};

      const userKey = (req.headers['x-user-api-key'] || '').toString();
      const apiKey = userKey || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

      const r = await fetch(OPENAI_IMG_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
        }),
      });

      const j = await r.json();
      if (!r.ok) {
        throw new Error(j?.error?.message || r.statusText);
      }
      return res.status(200).json(j);
    }

    // ---- CAS CHAT ---------------------------------------------------------
    const { messages = [], model = 'gpt-5' } = (req.body as any) || {};

    // tu es sur gpt-5 → pas de temperature
    const userKey = (req.headers['x-user-api-key'] || '').toString();
    const apiKey = userKey || process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY');

    const r = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        // pas de temperature ici pour éviter l’erreur Vercel/OpenAI “unsupported value”
      }),
    });

    const j = await r.json();
    if (!r.ok) {
      throw new Error(j?.error?.message || r.statusText);
    }

    return res.status(200).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
