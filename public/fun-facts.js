
(() => {
  // --------- Détection langue ----------
  const detectLang = () => {
    const path = (location.pathname.split('/').pop() || 'fun-facts.html').toLowerCase();
    const m = path.match(/-(en|de)\.html?$/);
    return m ? m[1] : 'fr';
  };
  const LANG = detectLang();

  // --------- i18n minimal ----------
  const T = {
    fr: { myth: 'Idée reçue', fact: 'Fait vérifié', source: 'Source', newBatch: 'Nouveau lot aléatoire' },
    en: { myth: 'Misconception', fact: 'Verified fact', source: 'Source', newBatch: 'New random batch' },
    de: { myth: 'Irrtum',     fact: 'Bewiesene Tatsache', source: 'Quelle', newBatch: 'Neuer zufälliger Satz' },
  }[LANG] || T.fr;

  // --------- Sélecteurs / helpers DOM ----------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // Garantit un conteneur #facts-grid
  const ensureMount = () => {
    let mount = $('#facts-grid');
    if (!mount) {
      console.warn('[fun-facts] Aucun conteneur trouvé. Création de #facts-grid…');
      const main = $('main') || document.body;
      mount = document.createElement('section');
      mount.id = 'facts-grid';
      main.appendChild(mount);
    }
    return mount;
  };

  const GRID = ensureMount();

  // --------- Helpers texte ----------
  const clampWords = (txt, maxWords) => {
    if (!txt) return '';
    const words = txt.trim().split(/\s+/);
    if (words.length <= maxWords) return txt.trim();
    return words.slice(0, maxWords).join(' ') + '…';
  };

  const sentenceCase = (s) => {
    if (!s) return '';
    const t = s.trim().replace(/\s+/g, ' ');
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  const ensurePeriod = (s) => {
    if (!s) return '';
    return /[.!?…]$/.test(s) ? s : s + '.';
  };

  const domainFrom = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ''); }
    catch { return ''; }
  };

  // --------- Skeletons ----------
  const renderSkeletons = (n = 9) => {
    GRID.classList.add('ff-loading');
    GRID.setAttribute('aria-busy', 'true');
    GRID.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const sk = document.createElement('div');
      sk.className = 'ff-skel';
      GRID.appendChild(sk);
    }
  };

  const clearSkeletons = () => {
    GRID.classList.remove('ff-loading');
    GRID.removeAttribute('aria-busy');
    GRID.innerHTML = '';
  };

  // --------- Normalisation des items ----------
  const normalizeItem = (it) => {
    if (!it || typeof it !== 'object') return null;

    // Champs possibles
    const rawClaim = it.claim || it.front || it.title || it.myth || it.question || '';
    const rawExplain = it.explain || it.back || it.answer || it.fact || it.summary || it.snippet || '';
    const url = it.url || it.link || it.source || '';
    const stitle = it.sourceTitle || it.title || '';

    // Heuristique : si le "title" est très encyclopédique, on tente d’en faire une phrase mythe propre
    let claim = rawClaim || '';
    claim = claim
      .replace(/^myth\s*[:\-]\s*/i, '')
      .replace(/^misconception\s*[:\-]\s*/i, '')
      .replace(/^fausse? idée\s*[:\-]\s*/i, '')
      .replace(/^-+\s*/, '');

    // Nettoyage simple
    claim = sentenceCase(claim);
    // Pas de point final au recto (souvent mieux en titre)
    claim = claim.replace(/[.!?…]+$/,''); 

    // Limite de longueur visuelle au recto (le CSS gère beaucoup, mais on aide un peu)
    if (claim.length > 160) claim = clampWords(claim, 22);

    // Verso : ≤ 30 mots, avec point final si manquant
    let explain = rawExplain ? clampWords(rawExplain, 30) : '';
    explain = ensurePeriod(sentenceCase(explain));

    // Si on n’a vraiment rien au verso, mettre un placeholder doux (rare mais safe)
    if (!explain || explain.length < 3) {
      explain = {
        fr: 'Voir la source pour le détail.',
        en: 'See the source for details.',
        de: 'Siehe Quelle für Details.'
      }[LANG];
    }

    return {
      claim,
      explain,
      url,
      sourceTitle: stitle || (url ? domainFrom(url) : '')
    };
  };

  // --------- Fabrication DOM d’une carte ----------
  const cardEl = (item) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('aria-pressed', 'false');

    // Front
    const inner = document.createElement('div');
    inner.className = 'inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head">
        <span class="badge">${T.myth}</span>
      </div>
      <p class="ff-text ff-claim">${item.claim}</p>
    `;

    // Back
    const back = document.createElement('div');
    back.className = 'face back';
    back.innerHTML = `
      <div class="ff-head">
        <span class="badge">${T.fact}</span>
      </div>
      <p class="ff-text ff-explain">${item.explain}</p>
      <div class="ff-actions">
        ${item.url ? `<a class="ff-link badge" href="${item.url}" target="_blank" rel="noopener">${T.source}${item.sourceTitle ? ' — ' + item.sourceTitle : ''}</a>` : ''}
      </div>
    `;

    inner.appendChild(front);
    inner.appendChild(back);
    wrap.appendChild(inner);

    // Flip handlers
    const toggle = () => {
      const flipped = wrap.classList.toggle('is-flipped');
      wrap.setAttribute('aria-pressed', flipped ? 'true' : 'false');
    };
    wrap.addEventListener('click', (e) => {
      // éviter que le clic sur le lien source retourne immédiatement la carte
      const a = e.target.closest('a');
      if (a) return;
      toggle();
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });

    return wrap;
  };

  // --------- Rendu d’un lot ----------
  const renderFacts = (list) => {
    clearSkeletons();
    const frag = document.createDocumentFragment();
    list.forEach((raw) => {
      const norm = normalizeItem(raw);
      if (!norm) return;
      frag.appendChild(cardEl(norm));
    });
    GRID.appendChild(frag);
  };

  // --------- Fetch JSON safe ----------
  const fetchJson = async (url) => {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Protéger contre un retour HTML (erreurs proxifiées)
    const ct = res.headers.get('Content-Type') || '';
    if (!/json/i.test(ct)) {
      const text = await res.text();
      throw new Error(`Réponse non-JSON (Content-Type="${ct}"): ${text.slice(0, 120)}…`);
    }
    return res.json();
  };

  // --------- API load avec replis ----------
  let lastKeys = new Set(); // pour éviter de répéter le même lot
  const itemKey = (it) => (it.url || it.claim || it.title || JSON.stringify(it)).slice(0, 200);

  const getFacts = async (n = 9) => {
    // 1) API principale
    try {
      const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${encodeURIComponent(n)}&t=${Date.now()}`;
      let data = await fetchJson(url);
      let arr = Array.isArray(data) ? data
              : Array.isArray(data?.facts) ? data.facts
              : Array.isArray(data?.items) ? data.items
              : [];

      // Filtre “nouveaux” vs dernier lot
      if (arr.length) {
        const filtered = arr.filter(x => !lastKeys.has(itemKey(x)));
        if (filtered.length >= Math.min(n, 3)) {
          arr = filtered;
        }
      }

      // Mise à jour des clés vues
      lastKeys = new Set(arr.slice(0, n).map(itemKey));
      return arr.slice(0, n);
    } catch (e) {
      console.warn('[fun-facts] API principale en échec → repli. Raison:', e.message);
    }

    // 2) Repli global si présent
    if (Array.isArray(window.FUN_FACTS) && window.FUN_FACTS.length) {
      const pool = window.FUN_FACTS.slice();
      pool.sort(() => Math.random() - 0.5);
      const arr = pool.slice(0, n);
      lastKeys = new Set(arr.map(itemKey));
      return arr;
    }

    // 3) Repli JSON statique (optionnel)
    try {
      const data = await fetchJson('/facts-data.json'); // si présent
      const arr = Array.isArray(data) ? data
                : Array.isArray(data?.facts) ? data.facts
                : [];
      lastKeys = new Set(arr.slice(0, n).map(itemKey));
      return arr.slice(0, n);
    } catch (e) {
      console.warn('[fun-facts] Repli JSON statique indisponible.');
    }

    return [];
  };

  // --------- Chargement principal ----------
  const N = 9; // nombre de cartes
  const load = async () => {
    renderSkeletons(N);
    try {
      const facts = await getFacts(N);
      renderFacts(facts);
    } catch (e) {
      clearSkeletons();
      GRID.innerHTML = `<div class="muted">Aucune donnée disponible pour le moment.</div>`;
      console.error(e);
    }
  };

  // --------- Nouveau lot ----------
  const bindNewBatch = () => {
    const btn = $('#ff-new') || $('#ff-btn-new') || $('[data-ff-new]');
    if (!btn) return;
    const label = btn.textContent.trim();
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy');
      btn.setAttribute('aria-busy', 'true');
      try {
        await load();
      } finally {
        btn.classList.remove('is-busy');
        btn.removeAttribute('aria-busy');
        if (!btn.textContent.trim()) btn.textContent = label || T.newBatch;
      }
    });
  };

  // --------- Go ----------
  document.addEventListener('DOMContentLoaded', () => {
    load();
    bindNewBatch();
  });
})();
