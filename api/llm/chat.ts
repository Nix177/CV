// api/llm/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

function norm(s?: string | string[]) {
  const v = (Array.isArray(s) ? s[0] : s) || '';
  return v.toLowerCase().replace(/\/$/, '');
}
function getOrigin(req: VercelRequest): string | null {
  const o = norm(req.headers.origin as any);
  if (o) return o;
  const ref = norm(req.headers.referer as any);
  if (!ref) return null;
  try { const u = new URL(ref); return `${u.protocol}//${u.host}`; } catch { return null; }
}
function getAllowed(): string[] {
  const raw = (process.env.ALLOWED_ORIGINS || '').toLowerCase();
  return raw.split(/[,\s]+/).map(s => s.replace(/\/$/, '')).filter(Boolean);
}
function sameHostSet(req: VercelRequest): string[] {
  const host = (req.headers.host || '').toString().toLowerCase();
  return host ? [`http://${host}`, `https://${host}`] : [];
}
function setCors(res: VercelResponse, origin: string) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Access-Code, X-User-Api-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = getOrigin(req);                // e.g. https://nicolastuor.ch
  const allowList = getAllowed();               // from ALLOWED_ORIGINS
  const sameHost = sameHostSet(req);

  // Stratégie : si ALLOWED_ORIGINS est vide → autorise seulement même hôte
  const allow =
    (origin && (allowList.includes('*') || allowList.includes(origin) || sameHost.includes(origin))) ||
    (!origin && allowList.includes('null'));    // permet file:// si 'null' est listé

  if (req.method === 'OPTIONS') {
    if (allow) { setCors(res, origin || '*'); return res.status(204).end(); }
    return res.status(403).json({ error: 'Forbidden origin (preflight)', seen: origin, allowed: allowList });
  }

  if (!allow) {
    return res.status(403).json({ error: 'Forbidden origin', seen: origin, allowed: allowList });
  }
  setCors(res, origin!);

  // Garde d’accès optionnelle
  const need = process.env.CV_ACCESS_CODE;
  if (need) {
    const got = (req.headers['x-access-code'] || '').toString();
    if (got !== need) return res.status(403).json({ error: 'Forbidden (access code)' });
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
