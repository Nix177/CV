// pages/api/llm/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_MODEL = process.env.OPENAI_MODEL_DEFAULT || 'gpt-5';
const OPENAI_BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin as string | undefined;
  const allow = !origin || ALLOWED.length === 0 || ALLOWED.includes(origin) ? origin ?? '*' : '';
  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (ALLOWED.length && (!origin || !ALLOWED.includes(origin))) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server missing OPENAI_API_KEY' });

    const {
      system = 'You are a concise assistant.',
      user,
      context = '',
      temperature = 0.2,
      model = DEFAULT_MODEL,
      messages,
      max_tokens,
    } = (req.body || {}) as any;

    const totalLen = (system?.length || 0) + (user?.length || 0) + (context?.length || 0);
    if (totalLen > 80_000) return res.status(413).json({ error: 'Input too large' });

    const finalMessages =
      Array.isArray(messages) && messages.length
        ? messages
        : [
            { role: 'system', content: system },
            { role: 'user', content: context ? `CONTEXT:\n${context}\n\nUSER:\n${user}` : String(user || '') },
          ];

    const upstream = await fetch(`${OPENAI_BASE.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: finalMessages, temperature, max_tokens }),
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      return res.status(502).json({ error: `Upstream ${upstream.status}`, detail: txt });
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ text, raw: data });
  } catch (e: any) {
    return res.status(500).json({ error: 'Server error', detail: String(e?.message || e) });
  }
}
