// /api/ff-chat.js — mini-chat pour la page Fun Facts
// Requiert process.env.OPENAI_API_KEY (modèle: gpt-4o-mini)

export const config = { runtime: 'nodejs' };

function jsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { q, lang = 'fr', cards = [] } = jsonBody(req);
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ answer: '(question manquante)' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ answer: '(Chat désactivé — clé API manquante)' });
  }

  const sys =
    `You are a concise assistant for a "Fun Facts / Misconceptions" page.
Answer in ${lang}. Be factual and neutral. If the question relates to the provided cards,
use them as primary context and, when relevant, mention the source domain (e.g., "en.wikipedia.org").
Keep answers under 120 words. Do not invent facts or sources.`;

  const context =
    cards && cards.length
      ? `Cards context (up to 12):
${cards
  .slice(0, 12)
  .map(
    (c, i) =>
      `${i + 1}. Claim: ${c.claim}
   Explain: ${c.explain}
   Source: ${c.source || ''}`
  )
  .join('\n')}`
      : 'No card context provided.';

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Question: ${q}\n\n${context}` },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(200).json({ answer: `(API indisponible) ${t.slice(0, 160)}` });
    }

    const j = await r.json();
    const answer = j?.choices?.[0]?.message?.content?.trim() || '(Pas de réponse)';
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(200).json({ answer: '(API indisponible)' });
  }
}
