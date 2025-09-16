// /api/chat.js
import profile from '../data/profile.json' assert { type: 'json' };

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

    const body = (await req.json?.()) || req.body || {};
    const question = (body.question || '').trim();
    const lang = (body.lang || 'fr').toLowerCase();

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY missing' });
    }
    if (!question) {
      return res.status(400).json({ error: 'Missing question' });
    }

    // Faits → texte compact pour le "context grounding"
    const facts =
      `NAME: ${profile.name}\n` +
      `LOCATION: ${profile.location}\n` +
      `SUMMARY: ${profile.summary}\n` +
      `VALUES: ${profile.values.join(', ')}\n` +
      `SKILLS_PEDAGOGY: ${profile.skills.pedagogy.join(', ')}\n` +
      `SKILLS_TECH: ${profile.skills.tech.join(', ')}\n` +
      `SKILLS_AI: ${profile.skills.ai.join(', ')}\n` +
      `EXPERIENCE:\n` +
      profile.experience.map(e => `- ${e.period}: ${e.role} — ${e.org} (${e.focus})`).join('\n') +
      `\nNOTES: ${profile.notes.join(' | ')}`;

    const locales = {
      fr: {
        system: `Tu es un assistant de candidature STRICTEMENT borné aux faits fournis.
- Réponds en français, de façon brève, concrète et honnête.
- Utilise UNIQUEMENT les faits de la section FACTS ci-dessous.
- Si la question est hors sujet (recettes, météo, etc.), explique poliment que tu es dédié au profil professionnel de Nicolas.
- Si l'information n'est pas présente dans les faits, dis-le explicitement (pas d'invention).
- Mentionne quand c’est pertinent que Nicolas aime apprendre et apprend vite, sans en faire trop.
- Jamais de promesses exagérées, ni de superlatifs marketing.
FACTS:
${facts}`
      },
      en: {
        system: `You are a hiring assistant STRICTLY constrained to the provided facts.
- Answer in English, briefly and concretely.
- Use ONLY the FACTS below.
- If the question is unrelated (recipes, random topics), politely refuse and state you only discuss Nicolas's professional profile.
- If something is unknown, say so explicitly (no invention).
- When relevant, mention he enjoys learning and learns quickly, without overselling.
FACTS:
${facts}`
      },
      de: {
        system: `Du bist ein Bewerbungsassistent, der STRIKT an die bereitgestellten Fakten gebunden ist.
- Antworte auf Deutsch, kurz und konkret.
- Nutze NUR die untenstehenden FAKTEN.
- Bei fachfremden Fragen (Rezepte usw.) lehne höflich ab und erkläre den Fokus auf das berufliche Profil von Nicolas.
- Wenn etwas unbekannt ist, sage das deutlich (keine Erfindungen).
- Erwähne bei Bedarf, dass er gerne lernt und sich schnell einarbeitet – ohne zu übertreiben.
FAKTEN:
${facts}`
      }
    };

    const sys = (locales[lang] || locales.fr).system;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: question }
        ]
      })
    });

    const json = await r.json();
    if (!r.ok) {
      return res.status(500).json({ error: json.error?.message || 'OpenAI error' });
    }

    const answer = json.choices?.[0]?.message?.content?.trim() || '';
    return res.status(200).json({ answer });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
