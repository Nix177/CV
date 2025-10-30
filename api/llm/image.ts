// api/llm/image.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_IMG_URL = 'https://api.openai.com/v1/images/generations';

// mêmes helpers que ton chat.ts
const norm = (s?: string | string[]) =>
  ((Array.isArray(s) ? s[0] : s) || '').toLowerCase().replace(/\/$/, '');

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

function parseAllowed(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .toLowerCase()
    .split(/[,\s]+/)
    .map((s) => s.replace(/\/$/, ''))
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
    'Content-Type, X-User-Api-Key, X-Access-Code'
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getOrigin(req);
  const allowList = parseAllowed();
  const same = sameHost(req);
  const isAllowed =
    (origin && (allowList.some((p) => matchOrigin(origin, p)) || same.includes(origin))) ||
    (!origin && allowList.includes('null'));

  // CORS préflight
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
    return res.status(403).json({ error: 'Forbidden origin', seen: origin, allowed: allowList });
  }
  setCors(res, origin || '*');

  if (req.method !== 'POST') return res.status(405).send('POST only');

  try {
    const {
      prompt,
      model = 'dall-e-3',  // ou 'gpt-image-1' selon ce que tu as
      size = '1024x1024',
      quality = 'standard',
      n = 1,
    } = (req.body as any) || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    // clé : soit celle de l’utilisateur, soit celle du serveur
    const userKey = (req.headers['x-user-api-key'] || '').toString();
    const apiKey = userKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing OPENAI_API_KEY on server' });
    }

    const resp = await fetch(OPENAI_IMG_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        n,
      }),
    });

    const json = await resp.json();
    if (!resp.ok) {
      // renvoyer l’erreur brute pour debug
      return res.status(resp.status).json(json);
    }

    // on renvoie tel quel : {data:[{url:...}]}
    return res.status(200).json(json);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
