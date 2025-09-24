/* public/fun-facts.js */
(() => {
  const log = (...a) => console.debug('[fun-facts]', ...a);

  // ---------- Langue ----------
  const getLang = () => {
    const h = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    if (h) return h;
    const m = (location.pathname.split('/').pop()||'').match(/-(en|de)\.html?$/i);
    return m ? m[1] : 'fr';
  };
  const LANG = getLang();

  // ---------- i18n ----------
  const L = {
    fr: { myth:'Mythe', fact:'Fait vérifié', source:'Source', newBatch:'🎲 Nouveau lot aléatoire', noData:'Aucune donnée disponible pour le moment.' },
    en: { myth:'Myth',  fact:'Verified fact', source:'Source', newBatch:'🎲 New random batch',      noData:'No data available for now.' },
    de: { myth:'Irrtum',fact:'Belegter Fakt', source:'Quelle', newBatch:'🎲 Neuer zufälliger Satz',  noData:'Zurzeit keine Daten verfügbar.' },
  }[LANG];

  log('LANG =', LANG, 'labels =', L);

  // ---------- DOM helpers ----------
  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const ensureGrid = () => {
    let grid = $('#facts-grid');
    if (!grid) {
      const main = $('main') || document.body;
      const sec = document.createElement('section');
      sec.className = 'section ff-section';
      grid = document.createElement('div');
      grid.id = 'facts-grid';
      sec.appendChild(grid);
      main.appendChild(sec);
      log('#facts-grid manquait, créé dynamiquement.');
    } else {
      log('#facts-grid trouvé.');
    }

    // S’il n’a pas de layout, on le force (sécurise l’affichage même sans CSS)
    grid.classList.add('flip-grid');
    grid.style.minHeight = '40px'; // assure qu’on verra le squelette
    return grid;
  };
  const GRID = ensureGrid();

  // ---------- Skeleton ----------
  const showSkeleton = (n=9) => {
    log('showSkeleton', n);
    GRID.classList.add('ff-loading');
    GRID.setAttribute('aria-busy','true');
    GRID.innerHTML = '';
    for (let i=0;i<n;i++){
      const d = document.createElement('div');
      d.className = 'ff-skel';
      GRID.appendChild(d);
    }
    // Fallback dur si la CSS n’est pas appliquée
    GRID.style.display = GRID.style.display || 'grid';
    GRID.style.gridTemplateColumns = GRID.style.gridTemplateColumns || 'repeat(auto-fit,minmax(220px,1fr))';
    GRID.style.gap = GRID.style.gap || '16px';
  };
  const clearSkeleton = () => {
    log('clearSkeleton');
    GRID.classList.remove('ff-loading');
    GRID.removeAttribute('aria-busy');
    GRID.innerHTML = '';
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

  // ---------- Normalisation ----------
  const normalize = it => {
    let claim   = it?.claim   ?? it?.front ?? it?.title ?? it?.myth ?? it?.question ?? '';
    let explain = it?.explain ?? it?.back  ?? it?.fact  ?? it?.answer  ?? it?.summary ?? '';
    const url   = it?.source  ?? it?.url   ?? it?.link  ?? '';

    // Recto propre
    claim = (claim||'')
      .replace(/^mythe?\s*[:\-]\s*/i,'')
      .replace(/^myth\s*[:\-]\s*/i,'')
      .replace(/^misconception\s*[:\-]\s*/i,'')
      .replace(/^-+\s*/,'');

    claim = sentence(claim).replace(/[.!?…]+$/,'');
    if (claim.length>160) claim = clampWords(claim, 22);

    // Verso ≤ 30 mots
    if (explain) explain = ensureDot(sentence(clampWords(explain, 30)));
    if (!explain) {
      explain = { fr:'Voir la source pour le détail.',
                  en:'See the source for details.',
                  de:'Siehe Quelle für Details.' }[LANG];
    }

    const n = { claim, explain, url, sourceTitle: it?.sourceTitle || domain(url) };
    return n;
  };

  // ---------- Carte ----------
  const card = item => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;
    wrap.setAttribute('role','button');

    const inner = document.createElement('div');
    inner.className = 'inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head"><span class="badge">${L.myth}</span></div>
      <p class="ff-text ff-claim">${item.claim}</p>
    `;

    const back = document.createElement('div');
    back.className = 'face back';
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

  // ---------- Fetch JSON sécurisé ----------
  const fetchJSON = async (url) => {
    log('fetchJSON:', url);
    const t0 = performance.now();
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    const t1 = performance.now();
    log('fetch in', (t1-t0).toFixed(1)+'ms', '→ status =', res.status, 'content-type =', res.headers.get('content-type'));

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    const payload = await res.json();
    const keys = payload && typeof payload==='object' ? Object.keys(payload) : [];
    log('payload keys =', keys, 'payload preview =', Array.isArray(payload?.items)?payload.items.slice(0,2):payload);
    return payload;
  };

  // ---------- Charge un lot ----------
  let lastKeys = new Set();
  const keyOf = it => (it?.url || it?.claim || JSON.stringify(it)).slice(0,200);

  const getFacts = async (n=9) => {
    const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data = await fetchJSON(url);
    let arr =
      Array.isArray(data)        ? data :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data?.facts) ? data.facts :
      [];

    log('getFacts: type=', Array.isArray(arr)?'array':typeof arr, 'len=', arr.length);

    // filtrage anti-répétition immédiate
    if (arr.length){
      const filtered = arr.filter(x => !lastKeys.has(keyOf(x)));
      log('filtered unique =', filtered.length);
      if (filtered.length >= Math.min(n,3)) arr = filtered;
    }
    lastKeys = new Set(arr.slice(0,n).map(keyOf));
    return arr.slice(0,n);
  };

  const render = (list) => {
    log('render: items =', list.length);
    clearSkeleton();

    // Filets de sécurité d’affichage du grid
    GRID.style.display = 'grid';
    GRID.style.gridTemplateColumns = 'repeat(auto-fit,minmax(220px,1fr))';
    GRID.style.gap = '16px';

    const frag = document.createDocumentFragment();
    list.forEach((it, i) => {
      const n = normalize(it);
      log(`normalize @ ${i} →`, n);
      if (n) frag.appendChild(card(n));
    });
    GRID.appendChild(frag);

    requestAnimationFrame(() => {
      const nCards = $$('.card3d', GRID).length;
      log('post-render: #cards =', nCards);
      const rect = GRID.getBoundingClientRect();
      if (nCards === 0 || rect.height < 10) {
        console.warn('[fun-facts] cartes invisibles → application de styles de secours');
        GRID.style.display = 'grid';
        GRID.style.gridTemplateColumns = 'repeat(auto-fit,minmax(220px,1fr))';
        GRID.style.gap = '16px';
        const first = $('.card3d', GRID);
        if (first) first.style.minHeight = '180px';
      }
    });
  };

  const load = async () => {
    log('load()');
    showSkeleton(9);
    const t0 = performance.now();
    try {
      const facts = await getFacts(9);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
    } finally {
      const t1 = performance.now();
      log('load() total in', (t1-t0).toFixed(1)+'ms');
    }
  };

  // ---------- Bouton "Nouveau lot" ----------
  const ensureNewBtn = () => {
    let btn = $('#ff_random') || $('#ff-random') || $('#ff-new');
    if (!btn) {
      const h1 = document.querySelector('h1') || document.body.firstElementChild || document.body;
      btn = document.createElement('button');
      btn.id = 'ff_random';
      btn.className = 'btn primary';
      btn.textContent = L.newBatch;
      (h1.parentNode || document.body).insertBefore(btn, h1.nextSibling);
      log('Bouton "Nouveau lot" injecté.');
    } else {
      log('Bouton "Nouveau lot" trouvé.');
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });
  };

  // ---------- GO ----------
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');
    ensureNewBtn();
    load();
  });
})();
