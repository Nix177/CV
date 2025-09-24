<!-- public/fun-facts.js -->
<script>
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
  const $ = (s, el=document) => el.querySelector(s);
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

  // ---------- Squelette ----------
  const showSkeleton = (n=9) => {
    log('showSkeleton', n);
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
    log('clearSkeleton');
    GRID.classList.remove('ff-loading');
    GRID.removeAttribute('aria-busy');
    GRID.innerHTML='';
  };

  // ---------- Utils texte ----------
  const clampWords = (txt, max) => {
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

  // ---------- Normalisation item {claim, explain, url} ----------
  const normalize = (it, i=-1) => {
    let claim   = it?.claim   ?? it?.front ?? it?.title ?? it?.myth ?? it?.question ?? '';
    let explain = it?.explain ?? it?.back  ?? it?.fact  ?? it?.answer   ?? it?.summary ?? '';
    const url   = it?.source  ?? it?.url   ?? it?.link  ?? '';

    // Recto propre
    claim = String(claim||'')
      .replace(/^mythe?\s*[:\-]\s*/i,'')
      .replace(/^myth\s*[:\-]\s*/i,'')
      .replace(/^misconception\s*[:\-]\s*/i,'')
      .replace(/^-+\s*/,'');

    claim = sentence(claim).replace(/[.!?…]+$/,'');
    if (claim.length>160) claim = clampWords(claim, 22);

    // Verso ≤ 30 mots
    if (explain) explain = ensureDot(sentence(clampWords(String(explain||''), 30)));

    if (!explain) {
      explain = { fr:'Voir la source pour le détail.',
                  en:'See the source for details.',
                  de:'Siehe Quelle für Details.' }[LANG];
    }

    const out = { claim, explain, url, sourceTitle: it?.sourceTitle || domain(url) };
    log('normalize @', i, '→', out);
    return out;
  };

  // ---------- Carte ----------
  const card = (item) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;
    wrap.setAttribute('role','button');

    const inner = document.createElement('div');
    inner.className='inner';

    const front = document.createElement('div');
    front.className='face front';
    front.innerHTML = `
      <div class="ff-head"><span class="badge">${L.myth}</span></div>
      <p class="ff-text ff-claim">${item.claim}</p>
    `;

    const back  = document.createElement('div');
    back.className='face back';
    back.innerHTML = `
      <div class="ff-head"><span class="badge">${L.fact}</span></div>
      <p class="ff-text ff-explain">${item.explain}</p>
      <div class="ff-actions">
        ${item.url ? `<a class="ff-link badge" href="${item.url}" target="_blank" rel="noopener">${L.source}${item.sourceTitle?` — ${item.sourceTitle}`:''}</a>` : ''}
      </div>
    `;

    inner.append(front, back);
    wrap.appendChild(inner);

    const flip = () => wrap.classList.toggle('is-flipped');
    wrap.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
    wrap.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); }});

    return wrap;
  };

  // ---------- Fetch JSON safe ----------
  const fetchJSON = async (url) => {
    log('fetchJSON:', url);
    const t0 = performance.now();
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    const dt = (performance.now() - t0).toFixed(1);
    const ct = res.headers.get('content-type') || '';
    log(`fetch in ${dt}ms → status =`, res.status, 'content-type =', ct);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    const j = await res.json();
    log('payload keys =', Object.keys(j), 'payload preview =', Array.isArray(j.items)? j.items.slice(0,2) : j);
    return j;
  };

  // ---------- Récupération avec “9 uniques” ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  let lastKeys = new Set();
  const keyOf = it => (it?.url || it?.claim || JSON.stringify(it||{})).slice(0, 200);

  // un batch brut
  const fetchBatch = async (n) => {
    const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data = await fetchJSON(url);
    let arr = Array.isArray(data) ? data
            : Array.isArray(data?.items) ? data.items
            : Array.isArray(data?.facts) ? data.facts
            : [];
    return { arr, meta: data?.meta || null };
  };

  // reconstitue jusqu’à n cartes uniques
  const getFacts = async (n = 9, maxTries = 3) => {
    const picked = [];
    const seen = new Set([...lastKeys]); // évite de répéter le lot précédent

    for (let attempt = 1; attempt <= maxTries && picked.length < n; attempt++) {
      const { arr, meta } = await fetchBatch(n);
      log('getFacts: batch', attempt, 'len=', arr.length, 'meta=', meta);

      for (const x of arr) {
        const k = keyOf(x);
        if (!seen.has(k)) {
          picked.push(x);
          seen.add(k);
          if (picked.length >= n) break;
        }
      }
      if (picked.length < n) await sleep(250); // petite pause, on retente
    }

    lastKeys = new Set(picked.map(keyOf));
    log('getFacts: uniques =', picked.length);
    return picked;
  };

  // ---------- Rendu ----------
  const render = (list) => {
    clearSkeleton();

    const frag = document.createDocumentFragment();
    list.forEach((it, i) => {
      const n = normalize(it, i);
      frag.appendChild(card(n));
    });
    GRID.appendChild(frag);

    // sécurité d'affichage (certaines mises en page tardent)
    requestAnimationFrame(() => {
      const rect = GRID.getBoundingClientRect();
      log('post-render: #cards =', $$('#facts-grid .card3d').length, 'rect =', `${rect.width}×${rect.height}`);
      if (!rect.height || !rect.width) {
        log('cartes invisibles → application de styles d’affichage de secours');
        GRID.style.display = 'grid';
        GRID.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
        GRID.style.gap = '16px';
        GRID.style.minHeight = '180px';
        GRID.style.visibility = 'visible';
      }
    });
  };

  const load = async () => {
    log('load()');
    showSkeleton(9);
    try {
      const facts = await getFacts(9, 3); // jusqu’à 3 tentatives pour avoir 9 uniques
      log('render: items =', facts.length);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
    }
  };

  // ---------- Bouton "Nouveau lot" ----------
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
    log('Bouton "Nouveau lot" trouvé.');
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });
  };

  // ---------- Go ----------
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');
    ensureNewBtn();
    load();
  });
})();
</script>
