// public/fun-facts.js  — JS pur (sans <script>)
// Fun Facts (FR/EN/DE) : cartes recto/verso, GET Wikipédia en priorité (+ fallback), anti-répétition persistante.

(() => {
  const log = (...a) => console.debug('[fun-facts]', ...a);

  // ---------- Langue ----------
  const getLang = () => {
    const htmlLang = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    if (htmlLang) return htmlLang;
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    const m = path.match(/-(en|de)\.html?$/);
    return m ? m[1] : 'fr';
  };
  const LANG = getLang();

  // ---------- i18n ----------
  const LMAP = {
    fr: { myth: 'Mythe', fact: 'Fait vérifié', source: 'Source', newBatch: '🎲 Nouveau lot aléatoire', noData: 'Aucune donnée disponible pour le moment.' },
    en: { myth: 'Myth',  fact: 'Verified fact', source: 'Source', newBatch: '🎲 New random batch',      noData: 'No data available for now.' },
    de: { myth: 'Irrtum',fact: 'Belegter Fakt', source: 'Quelle', newBatch: '🎲 Neuer zufälliger Satz',  noData: 'Zurzeit keine Daten verfügbar.' },
  };
  const L = LMAP[LANG] || LMAP.fr;
  log('LANG =', LANG, 'labels =', L);

  // ---------- DOM helpers ----------
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => [...el.querySelectorAll(s)];

  const ensureGrid = () => {
    let grid = $('#facts-grid');
    if (!grid) {
      const main = $('main') || document.body;
      const sec = document.createElement('section');
      sec.className = 'ff-section';
      grid = document.createElement('div');
      grid.id = 'facts-grid';
      sec.appendChild(grid);
      main.appendChild(sec);
      log('#facts-grid manquait → créé dynamiquement.');
    } else {
      log('#facts-grid trouvé.');
    }
    return grid;
  };
  const GRID = ensureGrid();
  const COUNT = $('#ff_count');

  // ---------- Squelettes ----------
  const showSkeleton = (n=9) => {
    GRID.classList.add('ff-loading');
    GRID.setAttribute('aria-busy','true');
    GRID.innerHTML = '';
    for (let i=0;i<n;i++){
      const d=document.createElement('div');
      d.className='ff-skel';
      GRID.appendChild(d);
    }
  };
  const clearSkeleton = () => {
    GRID.classList.remove('ff-loading');
    GRID.removeAttribute('aria-busy');
    GRID.innerHTML='';
  };

  // ---------- Utils texte ----------
  const clampWords = (txt, max=30) => {
    if (!txt) return '';
    const w = txt.trim().split(/\s+/);
    return (w.length<=max) ? txt.trim() : (w.slice(0,max).join(' ')+'…');
  };
  const sentence = s => {
    if (!s) return '';
    const t = s.trim().replace(/\s+/g,' ');
    return t ? t[0].toUpperCase()+t.slice(1) : '';
  };
  const ensureDot = s => /[.!?…]$/.test(s) ? s : (s ? s+'.' : s);
  const domain = u => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };

  // ---------- Normalisation items pour cartes ----------
  const keyOf = (it) => (it?.id || it?.url || it?.claim || it?.title || JSON.stringify(it||{})).slice(0, 200);

  const normalize = (it) => {
    const type = (it.type || 'myth').toLowerCase();
    const claimRaw = it.claim || it.title || it.q || '';
    let explainRaw =
      it.explainShort || it.explanation || it.explain || it.truth || it.answer || '';

    // Front = assertion ; Back = explication ≤ 30 mots
    const claim   = ensureDot(sentence(claimRaw));
    const explain = ensureDot(sentence(clampWords(explainRaw, 30)));

    // Source prioritaire = sources[0].url | sources[0] | url | source
    let url = '';
    if (Array.isArray(it.sources) && it.sources.length) {
      const s0 = it.sources[0];
      url = (typeof s0 === 'string') ? s0 : (s0?.url || '');
    } else {
      url = it.url || it.source || '';
    }

    return { type, claim, explain, url, _k: keyOf(it) };
  };

  // ---------- Carte 3D ----------
  const card = (n) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;
    const inner = document.createElement('div');
    inner.className = 'inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head">
        <span class="badge">${n.type === 'fact' ? L.fact : L.myth}</span>
      </div>
      <p class="ff-text ff-claim">${n.claim || ''}</p>
      <div class="ff-actions"></div>
    `;

    const back = document.createElement('div');
    back.className = 'face back';
    const link = n.url ? `<a class="ff-link" href="${n.url}" target="_blank" rel="noopener">${L.source} · ${domain(n.url)}</a>` : '';
    back.innerHTML = `
      <p class="ff-text ff-explain">${n.explain || ''}</p>
      <div class="ff-actions">${link}</div>
    `;

    inner.append(front, back);
    wrap.appendChild(inner);

    const flip = () => wrap.classList.toggle('is-flipped');
    wrap.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
    wrap.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); }});
    return wrap;
  };

  // ---------- Fetch JSON (sécurisé) ----------
  const fetchJSON = async (url) => {
    log('fetch:', url);
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    return res.json();
  };

  // ---------- Anti-répétitions persistantes ----------
  const LS_SEEN = 'ff_seen_ids_v1';
  const loadSeen = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); }
    catch { return new Set(); }
  };
  const saveSeen = (set) => {
    // on garde une fenêtre raisonnable
    const arr = [...set];
    const MAX = 300;
    localStorage.setItem(LS_SEEN, JSON.stringify(arr.slice(-MAX)));
  };
  let seenIDs = loadSeen();
  let lastKeys = new Set(); // évite de répéter le lot précédent

  // ---------- Batch (priorité Wikipédia via /api/ff-batch) ----------
  const fetchBatch = async (n) => {
    const seenCsv = [...seenIDs].join(',');
    // 1) priorité au scraping Wikipédia (gros pool + exclude ?seen)
    try {
      const url1 = `/api/ff-batch?lang=${encodeURIComponent(LANG)}&count=${n*3}&seen=${encodeURIComponent(seenCsv)}`;
      const data1 = await fetchJSON(url1);         // renvoie un tableau
      if (Array.isArray(data1) && data1.length){
        return { arr: data1, meta: { source: 'ff-batch' } };
      }
    } catch (e) {
      log('ff-batch failed → fallback /api/facts', e);
    }
    // 2) fallback: /api/facts (REST summary Wikipédia à partir d’un petit SEED)
    const url2 = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data2 = await fetchJSON(url2);           // { ok, items } ou tableau
    const arr = Array.isArray(data2) ? data2
            : Array.isArray(data2?.items) ? data2.items
            : Array.isArray(data2?.facts) ? data2.facts
            : [];
    return { arr, meta: { source: 'facts' } };
  };

  // ---------- Reconstituer N cartes uniques ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const getFacts = async (n = 9, maxTries = 3) => {
    const picked = [];
    const seenNow = new Set([...lastKeys, ...seenIDs]); // évite lot précédent + historique

    for (let attempt = 1; attempt <= maxTries && picked.length < n; attempt++) {
      const { arr, meta } = await fetchBatch(n);
      log('batch', attempt, 'len=', arr.length, 'meta=', meta);

      for (const x of arr) {
        const k = keyOf(x);
        if (!seenNow.has(k)) {
          picked.push(x);
          seenNow.add(k);
          if (picked.length >= n) break;
        }
      }
      if (picked.length < n) await sleep(250); // petite pause puis retente
    }

    lastKeys = new Set(picked.map(keyOf));
    // met à jour l’historique persistant
    for (const k of lastKeys) seenIDs.add(k);
    saveSeen(seenIDs);

    log('uniques =', picked.length);
    return picked;
  };

  // ---------- Rendu ----------
  const render = (list) => {
    clearSkeleton();
    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.appendChild(card(normalize(it))));
    GRID.appendChild(frag);
    if (COUNT) COUNT.textContent = `${list.length} cards`;
    requestAnimationFrame(() => {
      const rect = GRID.getBoundingClientRect();
      if (!rect.height || !rect.width) {
        GRID.style.display = 'grid';
        GRID.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
        GRID.style.gap = '16px';
        GRID.style.minHeight = '180px';
        GRID.style.visibility = 'visible';
      }
    });
  };

  // ---------- Actions ----------
  const load = async () => {
    showSkeleton(9);
    try {
      const facts = await getFacts(9, 3);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
    }
  };

  const ensureNewBtn = () => {
    let btn = $('#ff_random') || $('#ff-random') || $('#ff-new');
    if (!btn) {
      const h1 = document.querySelector('h1') || document.body;
      btn = document.createElement('button');
      btn.id = 'ff_random';
      btn.className = 'btn primary';
      btn.textContent = L.newBatch;
      h1.parentNode.insertBefore(btn, h1.nextSibling);
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });
  };

  // ---------- Go ----------
  document.addEventListener('DOMContentLoaded', () => {
    ensureNewBtn();
    load();
  });
})();
