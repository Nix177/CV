import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const norm = (s?: string | string[]) =>
  ((Array.isArray(s) ? s[0] : s) || '').toLowerCase().replace(/\/$/, '');

function getOrigin(req: VercelRequest): string | null {
  const o = norm(req.headers.origin as any);
  if (o) return o;
  const ref = norm(req.headers.referer as any);
  if (!ref) return null;
  try { const u = new URL(ref); return `${u.protocol}//${u.host}`; } catch { return null; }
}

function parseAllowed(): string[] {
  return (process.env.ALLOWED_ORIGINS || '')
    .toLowerCase()
    .split(/[,\s]+/)
    .map(s => s.replace(/\/$/, ''))
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
  // wildcard *.domain.tld
  if (pattern.startsWith('*.')) {
    try {
      const oh = new URL(origin).host;
      const suffix = pattern.slice(2);
      return oh === suffix || oh.endsWith('.' + suffix);
    } catch { return false; }
  }
  return origin === pattern;
}

function setCors(res: VercelResponse, origin: string | '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code, X-User-Api-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getOrigin(req);                  // ex: https://nicolastuor.ch
  const allowList = parseAllowed();
  const same = sameHost(req);
  const isAllowed =
    (origin && (allowList.some(p => matchOrigin(origin, p)) || same.includes(origin))) ||
    (!origin && allowList.includes('null'));

  if (req.method === 'OPTIONS') {
    if (isAllowed) { setCors(res, origin || '*'); return res.status(204).end(); }
    return res.status(403).json({ error: 'Forbidden origin (preflight)', seen: origin, allowed: allowList });
  }

  if (!isAllowed) {
    return res.status(403).json({ error: 'Forbidden origin', seen: origin, allowed: allowList });
  }
  setCors(res, origin || '*');

  // Accès optionnel par code
  const required = process.env.CV_ACCESS_CODE;
  if (required) {
    const got = (req.headers['x-access-code'] || '').toString();
    if (got !== required) return res.status(403).json({ error: 'Forbidden (access code missing/wrong)' });
  }

  if (req.method !== 'POST') return res.status(405).send('POST only');

  try {
    const { messages = [], model = 'gpt-5', temperature = 0.2 } = req.body || {};
    const userKey = (req.headers['x-user-api-key'] || '').toString();
    const apiKey = userKey || process.env.OPENAI_API_KEY!;
    const r = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message || r.statusText);
    return res.status(200).json(j);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
