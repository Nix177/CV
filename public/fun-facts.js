/* public/fun-facts.js */
(() => {
  const log = (...a) => console.log('[fun-facts]', ...a);

  // ---------- Langue ----------
  const getLang = () => {
    const htmlLang = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    if (htmlLang) return htmlLang;
    const m = (location.pathname.split('/').pop() || '').match(/-(en|de)\.html?$/i);
    return m ? m[1].toLowerCase() : 'fr';
  };
  const LANG = getLang();
  const LMAP = {
    fr: { myth:'Mythe', fact:'Fait vérifié', source:'Source', newBatch:'🎲 Nouveau lot aléatoire', noData:'Aucune donnée disponible pour le moment.' },
    en: { myth:'Myth', fact:'Verified fact', source:'Source', newBatch:'🎲 New random batch', noData:'No data available for now.' },
    de: { myth:'Irrtum', fact:'Belegter Fakt', source:'Quelle', newBatch:'🎲 Neuer zufälliger Satz', noData:'Zurzeit keine Daten verfügbar.' },
  };
  const L = LMAP[LANG] || LMAP.fr;
  log('LANG =', LANG, 'labels =', L);

  // ---------- DOM helpers ----------
  const $ = (s, el=document) => el.querySelector(s);

  // Monte #facts-grid DANS .container si possible, sinon dans <main>, sinon <body>.
  const ensureGrid = () => {
    let grid = $('#facts-grid');
    if (grid) {
      log('#facts-grid trouvé.');
      return grid;
    }

    const mount =
      $('main .container') ||
      $('main') ||
      document.body;

    const sec = document.createElement('section');
    sec.className = 'ff-section';

    grid = document.createElement('div');
    grid.id = 'facts-grid';
    grid.setAttribute('aria-live', 'polite');
    grid.setAttribute('aria-busy', 'true');
    sec.appendChild(grid);
    mount.appendChild(sec);

    log('#facts-grid manquait → créé et monté sous', mount === document.body ? '<body>' : mount.tagName + (mount.className ? '.' + mount.className : ''));

    // Forçage de styles de base pour éviter la boîte 0×0
    grid.style.display = 'grid';
    grid.style.gap = '16px';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    grid.style.minHeight = '180px';

    // Si le parent n’occupe pas d’espace, assure une mise en page simple
    const parent = grid.parentElement;
    if (parent) {
      parent.style.display = parent.style.display || 'block';
      parent.style.width   = parent.style.width   || '100%';
    }
    return grid;
  };

  const GRID = ensureGrid();

  // Squelette visible
  const showSkeleton = (n=9) => {
    log('showSkeleton', n);
    GRID.classList.add('ff-loading');
    GRID.setAttribute('aria-busy','true');
    GRID.innerHTML = '';
    for (let i=0;i<n;i++){
      const d=document.createElement('div');
      d.className='ff-skel';
      d.style.height='188px';
      d.style.borderRadius='14px';
      d.style.border='1px solid var(--border)';
      d.style.background='linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.12) 37%, rgba(255,255,255,.05) 63%)';
      d.style.backgroundSize='400% 100%';
      d.style.animation='ff-shine 1.1s ease-in-out infinite';
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
  const normalize = it => {
    let claim   = it?.claim   ?? it?.front   ?? it?.title ?? it?.myth ?? it?.question ?? '';
    let explain = it?.explain ?? it?.back    ?? it?.fact  ?? it?.answer ?? it?.summary ?? '';
    const url   = it?.source  ?? it?.url     ?? it?.link  ?? '';

    claim = (claim || '')
      .replace(/^mythe?\s*[:\-]\s*/i,'')
      .replace(/^myth\s*[:\-]\s*/i,'')
      .replace(/^misconception\s*[:\-]\s*/i,'')
      .replace(/^-+\s*/,'');

    claim = sentence(claim).replace(/[.!?…]+$/,'');
    if (claim.length>160) claim = clampWords(claim,22);

    if (explain) explain = ensureDot(sentence(clampWords(explain,30)));
    if (!explain) {
      explain = { fr:'Voir la source pour le détail.',
                  en:'See the source for details.',
                  de:'Siehe Quelle für Details.' }[LANG];
    }

    const norm = { claim, explain, url, sourceTitle: it?.sourceTitle || domain(url) };
    return norm;
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
    log('fetch in', (performance.now()-t0).toFixed(1)+'ms', '→ status =', res.status, 'content-type =', res.headers.get('content-type'));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    return res.json();
  };

  // ---------- Charge un lot ----------
  let lastKeys = new Set();
  const keyOf = it => (it?.url || it?.claim || JSON.stringify(it || '')).slice(0,200);

  const getFacts = async (n=9) => {
    const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data = await fetchJSON(url);
    log('payload keys =', Object.keys(data || {}), 'payload preview =', Array.isArray(data?.items) ? data.items.slice(0,2) : data);
    let arr =
      Array.isArray(data)        ? data :
      Array.isArray(data?.items) ? data.items :
      Array.isArray(data?.facts) ? data.facts :
      [];
    log('getFacts: type=', Array.isArray(arr) ? 'array' : typeof arr, 'len=', arr.length);

    if (arr.length){
      const filtered = arr.filter(x => !lastKeys.has(keyOf(x)));
      log('filtered unique =', filtered.length);
      if (filtered.length >= Math.min(n,3)) arr = filtered;
    }
    lastKeys = new Set(arr.slice(0,n).map(keyOf));
    return arr.slice(0,n);
  };

  const postRenderCheck = () => {
    const rect = GRID.getBoundingClientRect();
    const count = document.querySelectorAll('#facts-grid .card3d').length;
    log('post-render: #cards =', count, 'rect =', rect.width+'×'+rect.height);
    if (rect.width === 0 || rect.height === 0) {
      log('cartes invisibles → application de styles de secours');
      // injection d’un style minimal
      const s = document.createElement('style');
      s.textContent = `
        #facts-grid{display:grid !important; gap:16px !important; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)) !important; min-height:188px !important;}
        .ff-section{display:block !important; width:100% !important;}
      `;
      document.head.appendChild(s);
      // forcer un reflow
      GRID.style.display = 'grid';
      GRID.style.minHeight = '188px';
    }
  };

  const render = (list) => {
    log('render: items =', list.length);
    clearSkeleton();
    const frag = document.createDocumentFragment();
    list.forEach((it, i) => {
      const n = normalize(it);
      log('normalize @', i, '→', n);
      frag.appendChild(card(n));
    });
    GRID.appendChild(frag);
    requestAnimationFrame(postRenderCheck);
  };

  const load = async () => {
    log('load()');
    showSkeleton(9);
    try {
      const facts = await getFacts(9);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
    } finally {
      log('load() total in', (performance.now()).toFixed(1)+'ms');
    }
  };

  // ---------- Bouton "Nouveau lot" ----------
  const ensureNewBtn = () => {
    let btn = $('#ff_random') || $('#ff-random') || $('#ff-new');
    const ref = $('main .container h1, h1') || document.body;
    if (!btn && ref && ref.parentNode){
      btn = document.createElement('button');
      btn.id = 'ff_random';
      btn.className = 'btn primary';
      btn.textContent = L.newBatch;
      ref.parentNode.insertBefore(btn, ref.nextSibling);
      btn.style.margin = '10px 0 16px';
    }
    if (btn) {
      log('Bouton "Nouveau lot" trouvé.');
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
        try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
      });
    }
  };

  // ---------- Go ----------
  document.addEventListener('DOMContentLoaded', () => {
    log('DOMContentLoaded');
    ensureNewBtn();
    load();
  });

  // petite anim pour le squelette (si pas déjà dans le CSS global)
  if (!document.getElementById('ff-shine-style')) {
    const s = document.createElement('style');
    s.id = 'ff-shine-style';
    s.textContent = `
      @keyframes ff-shine { 0%{ background-position: 100% 0 } 100%{ background-position: 0 0 } }
    `;
    document.head.appendChild(s);
  }
})();
