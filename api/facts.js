// /api/facts.js
export const config = { runtime: 'edge' };

const ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const CORS_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function withCorsHeaders(origin) {
  const h = { ...CORS_HEADERS };
  if (!ORIGINS.length) {
    h['access-control-allow-origin'] = '*';
  } else {
    h['access-control-allow-origin'] = ORIGINS.includes(origin || '') ? origin : 'null';
  }
  return h;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: withCorsHeaders(req.headers.get('origin')) });
  }

  const url = new URL(req.url);
  const lang = (url.searchParams.get('lang') || 'fr').slice(0, 2).toLowerCase();
  const n = Math.min(Math.max(parseInt(url.searchParams.get('n') || url.searchParams.get('count') || '9', 10) || 9, 1), 12);
  const origin = req.headers.get('origin') || '';

  try {
    const items = await buildItems(lang, n);
    return new Response(JSON.stringify({ ok: true, items }, null, 2), {
      status: 200,
      headers: withCorsHeaders(origin),
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: withCorsHeaders(origin),
    });
  }
}

/* ===================== Data & helpers ===================== */

const SEEDS = {
  fr: [
    { key: 'brain10',   title: 'Mythe des 10 % du cerveau', url: 'https://fr.wikipedia.org/wiki/Mythe_des_10_%25_du_cerveau', claimHint: 'On n’utilise que 10 % de notre cerveau.' },
    { key: 'wallspace', title: 'Grande Muraille', url: 'https://fr.wikipedia.org/wiki/Grande_Muraille', claimHint: 'La Grande Muraille est visible à l’œil nu depuis l’espace.' },
    { key: 'bullsred',  title: 'Taureau', url: 'https://fr.wikipedia.org/wiki/Taureau', claimHint: 'Les taureaux s’énervent à cause du rouge.' },
    { key: 'chameleon', title: 'Caméléon', url: 'https://fr.wikipedia.org/wiki/Cam%C3%A9l%C3%A9on', claimHint: 'Les caméléons changent de couleur uniquement pour se camoufler.' },
    { key: 'catsfeet',  title: 'Chat', url: 'https://fr.wikipedia.org/wiki/Chat', claimHint: 'Un chat retombe toujours sur ses pattes, sans danger.' },
    { key: 'leftright', title: 'Latéralisation cérébrale', url: 'https://fr.wikipedia.org/wiki/Lat%C3%A9ralisation_c%C3%A9r%C3%A9brale', claimHint: 'On est cerveau gauche ou cerveau droit.' },
    { key: 'vikings',   title: 'Vikings', url: 'https://fr.wikipedia.org/wiki/Vikings', claimHint: 'Les Vikings portaient des casques à cornes.' },
    { key: 'seasons',   title: 'Saisons', url: 'https://fr.wikipedia.org/wiki/Saison', claimHint: 'Il fait plus chaud en été car la Terre est plus proche du Soleil.' },
    { key: 'venus',     title: 'Vénus', url: 'https://fr.wikipedia.org/wiki/V%C3%A9nus_(plan%C3%A8te)', claimHint: 'Mercure est la planète la plus chaude.' },
    { key: 'coriolis',  title: 'Force de Coriolis', url: 'https://fr.wikipedia.org/wiki/Force_de_Coriolis', claimHint: 'L’eau tourbillonne en sens inverse selon l’hémisphère.' },
    { key: 'glass',     title: 'Verre', url: 'https://fr.wikipedia.org/wiki/Verre', claimHint: 'Le verre est un liquide très visqueux qui coule.' },
    { key: 'blueblood', title: 'Sang', url: 'https://fr.wikipedia.org/wiki/Sang', claimHint: 'Le sang est bleu dans les veines.' },
    { key: 'goldfish',  title: 'Poisson rouge', url: 'https://fr.wikipedia.org/wiki/Carassius_auratus', claimHint: 'Les poissons rouges n’ont que trois secondes de mémoire.' },
    { key: 'lightning', title: 'Foudre', url: 'https://fr.wikipedia.org/wiki/Foudre', claimHint: 'Les petits objets métalliques attirent la foudre.' },
    { key: 'napoleon',  title: 'Napoléon Ier', url: 'https://fr.wikipedia.org/wiki/Napol%C3%A9on_Ier', claimHint: 'Napoléon était très petit.' },
  ],
  en: [
    { key: 'brain10',   title: 'Ten percent of the brain myth', url: 'https://en.wikipedia.org/wiki/Ten_percent_of_the_brain_myth', claimHint: 'We use only 10% of our brain.' },
    { key: 'wallspace', title: 'Great Wall of China', url: 'https://en.wikipedia.org/wiki/Great_Wall_of_China', claimHint: 'The Great Wall is visible from space with the naked eye.' },
    { key: 'bullsred',  title: 'Bull', url: 'https://en.wikipedia.org/wiki/Bull', claimHint: 'Bulls get angry because of the color red.' },
    { key: 'chameleon', title: 'Chameleon', url: 'https://en.wikipedia.org/wiki/Chameleon', claimHint: 'Chameleons change color only to camouflage.' },
    { key: 'catsfeet',  title: 'Cat', url: 'https://en.wikipedia.org/wiki/Cat', claimHint: 'A cat always lands on its feet without danger.' },
    { key: 'leftright', title: 'Lateralization of brain function', url: 'https://en.wikipedia.org/wiki/Lateralization_of_brain_function', claimHint: 'People are left-brained or right-brained.' },
    { key: 'vikings',   title: 'Viking Age', url: 'https://en.wikipedia.org/wiki/Vikings', claimHint: 'Vikings wore horned helmets.' },
    { key: 'seasons',   title: 'Season', url: 'https://en.wikipedia.org/wiki/Season', claimHint: 'Summer is hotter because Earth is closer to the Sun.' },
    { key: 'venus',     title: 'Venus', url: 'https://en.wikipedia.org/wiki/Venus', claimHint: 'Mercury is the hottest planet.' },
    { key: 'coriolis',  title: 'Coriolis effect', url: 'https://en.wikipedia.org/wiki/Coriolis_effect', claimHint: 'Toilets swirl opposite ways in each hemisphere.' },
    { key: 'glass',     title: 'Glass', url: 'https://en.wikipedia.org/wiki/Glass', claimHint: 'Glass is a supercooled liquid that flows.' },
    { key: 'blueblood', title: 'Blood', url: 'https://en.wikipedia.org/wiki/Blood', claimHint: 'Blood in veins is blue.' },
    { key: 'goldfish',  title: 'Goldfish', url: 'https://en.wikipedia.org/wiki/Goldfish', claimHint: 'Goldfish have a three-second memory.' },
    { key: 'lightning', title: 'Lightning', url: 'https://en.wikipedia.org/wiki/Lightning', claimHint: 'Small metal objects attract lightning.' },
    { key: 'napoleon',  title: 'Napoleon', url: 'https://en.wikipedia.org/wiki/Napoleon', claimHint: 'Napoleon was extremely short.' },
  ],
  de: [
    { key: 'brain10',   title: 'Zehn-Prozent-Mythos', url: 'https://de.wikipedia.org/wiki/Zehn-Prozent-Mythos', claimHint: 'Wir nutzen nur 10 % unseres Gehirns.' },
    { key: 'wallspace', title: 'Chinesische Mauer', url: 'https://de.wikipedia.org/wiki/Chinesische_Mauer', claimHint: 'Die Große Mauer ist mit bloßem Auge aus dem All sichtbar.' },
    { key: 'bullsred',  title: 'Stierkampf', url: 'https://de.wikipedia.org/wiki/Stierkampf', claimHint: 'Stiere reagieren auf die Farbe Rot.' },
    { key: 'chameleon', title: 'Chamäleons', url: 'https://de.wikipedia.org/wiki/Cham%C3%A4leons', claimHint: 'Chamäleons ändern die Farbe nur zur Tarnung.' },
    { key: 'catsfeet',  title: 'Hauskatze', url: 'https://de.wikipedia.org/wiki/Hauskatze', claimHint: 'Eine Katze landet immer ungefährlich auf den Pfoten.' },
    { key: 'leftright', title: 'Hemisphärenlateralisierung', url: 'https://de.wikipedia.org/wiki/Hemisph%C3%A4renlateralisierung', claimHint: 'Menschen sind links- oder rechtshemisphärisch.' },
    { key: 'vikings',   title: 'Wikinger', url: 'https://de.wikipedia.org/wiki/Wikinger', claimHint: 'Wikinger trugen Helme mit Hörnern.' },
    { key: 'seasons',   title: 'Jahreszeit', url: 'https://de.wikipedia.org/wiki/Jahreszeit', claimHint: 'Der Sommer ist wärmer, weil die Erde näher an der Sonne ist.' },
    { key: 'venus',     title: 'Venus (Planet)', url: 'https://de.wikipedia.org/wiki/Venus_(Planet)', claimHint: 'Merkur ist der heißeste Planet.' },
    { key: 'coriolis',  title: 'Corioliskraft', url: 'https://de.wikipedia.org/wiki/Corioliskraft', claimHint: 'Wasser dreht in jedem Hemisphären anders ab.' },
    { key: 'glass',     title: 'Glas', url: 'https://de.wikipedia.org/wiki/Glas', claimHint: 'Glas ist eine sehr zähflüssige Flüssigkeit.' },
    { key: 'blueblood', title: 'Blut', url: 'https://de.wikipedia.org/wiki/Blut', claimHint: 'Venenblut ist blau.' },
    { key: 'goldfish',  title: 'Goldfisch', url: 'https://de.wikipedia.org/wiki/Goldfisch', claimHint: 'Goldfische haben nur drei Sekunden Gedächtnis.' },
    { key: 'lightning', title: 'Blitz', url: 'https://de.wikipedia.org/wiki/Blitz', claimHint: 'Kleine Metallgegenstände ziehen Blitze an.' },
    { key: 'napoleon',  title: 'Napoleon Bonaparte', url: 'https://de.wikipedia.org/wiki/Napoleon_Bonaparte', claimHint: 'Napoleon war sehr klein.' },
  ],
};

function pickN(arr, n) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

async function fetchWikiSummary(lang, seed) {
  // REST summary is stable & short
  const base = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/`;
  const titleForUrl = encodeURIComponent(seed.title);
  const res = await fetch(base + titleForUrl, { headers: { 'accept': 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${lang} summary failed for ${seed.title}`);
  const data = await res.json();
  const extract = [data.title, data.description, data.extract].filter(Boolean).join('. ');
  const pageUrl = (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || seed.url;
  return { extract, source: pageUrl };
}

function sanitize(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function langLabel(lang, fr, en, de) {
  if (lang === 'fr') return fr;
  if (lang === 'de') return de;
  return en;
}

const FALLBACKS = {
  brain10: {
    fr: { claim: 'On n’utilise que 10 % de notre cerveau.', explain: 'Les imageries montrent une activité répartie ; le cerveau est largement sollicité selon les tâches.', },
    en: { claim: 'We use only 10% of our brain.', explain: 'Neuroimaging shows widespread activity; the brain is broadly engaged depending on tasks.', },
    de: { claim: 'Wir nutzen nur 10 % unseres Gehirns.', explain: 'Bildgebung zeigt weit verbreitete Aktivität; Nutzung hängt von Aufgaben ab.', },
  },
  wallspace: {
    fr: { claim: 'La Grande Muraille est visible à l’œil nu depuis l’espace.', explain: 'Trop étroite et couleur du sol ; visible seulement avec optiques et conditions idéales.', },
    en: { claim: 'The Great Wall is visible from space with the naked eye.', explain: 'Too narrow and earth-colored; needs optics and ideal conditions.', },
    de: { claim: 'Die Große Mauer ist mit bloßem Auge aus dem All sichtbar.', explain: 'Zu schmal und erdfarben; nur mit Optik/Idealbedingungen.', },
  },
  bullsred: {
    fr: { claim: 'Les taureaux s’énervent à cause du rouge.', explain: 'Ils distinguent mal le rouge-vert ; le mouvement excite, pas la couleur.', },
    en: { claim: 'Bulls get angry because of red.', explain: 'They are red-green color-blind; movement, not color, triggers attack.', },
    de: { claim: 'Stiere reagieren wegen Rot.', explain: 'Rot-Grün-Sehschwäche; Auslöser ist Bewegung, nicht die Farbe.', },
  },
  // (on garde assez de fallbacks implicites via claimHint + explications courtes)
};

async function llmClaimExplain(lang, text, source, seed) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing');

  const sys = langLabel(
    lang,
    'Tu es un assistant qui extrait des idées reçues (mythes) et fournit une réfutation très courte (≤30 mots).',
    'You are an assistant that extracts common misconceptions and provides a very short refutation (≤30 words).',
    'Du bist ein Assistent, der Irrtümer erkennt und eine sehr kurze Widerlegung (≤30 Wörter) liefert.',
  );

  const user = [
    langLabel(lang, 'Texte source Wikipédia :', 'Wikipedia source text:', 'Wikipedia-Quellentext:'),
    text,
    '',
    langLabel(lang,
      `Produis un JSON strict {"claim": "...","explain":"..."} dans la langue ${lang.toUpperCase()}. 
- "claim": formuler la croyance (mythe) en une phrase simple (grand public).
- "explain": réfute en ≤30 mots. Pas d’emoji, pas de markdown.
Indice possible: ${seed.claimHint}`,
      `Return strict JSON {"claim":"...","explain":"..."} in ${lang.toUpperCase()}.
- "claim": the misconception as a short, simple statement.
- "explain": refute in ≤30 words. No emoji/markdown.
Hint: ${seed.claimHint}`,
      `Gib striktes JSON {"claim":"...","explain":"..."} auf ${lang.toUpperCase()} aus.
- "claim": Irrtum als kurzer, einfacher Satz.
- "explain": Widerlege in ≤30 Wörtern. Keine Emojis/Markdown.
Hinweis: ${seed.claimHint}`
    )
  ].join('\n');

  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user }
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' }
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`OpenAI error ${r.status}`);
  const data = await r.json();
  const raw = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);

  return {
    claim: sanitize(parsed.claim || seed.claimHint),
    explain: sanitize(parsed.explain || ''),
    source,
  };
}

async function buildItems(lang, n) {
  const seeds = SEEDS[lang] || SEEDS.fr;
  const picks = pickN(seeds, n);
  const out = [];

  for (const s of picks) {
    try {
      const { extract, source } = await fetchWikiSummary(lang, s);
      const { claim, explain } = await llmClaimExplain(lang, extract, source, s);
      out.push({ lang, claim: sanitize(claim), explain: sanitize(explain), source });
    } catch (err) {
      // Fallback propre
      const fb = FALLBACKS[s.key]?.[lang] || FALLBACKS[s.key]?.fr || { claim: s.claimHint, explain: '' };
      out.push({ lang, claim: sanitize(fb.claim), explain: sanitize(fb.explain), source: s.url });
    }
  }
  return out;
}
