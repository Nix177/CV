/* public/fun-facts.js */
(() => {
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
  const L = {
    fr: { myth: 'Mythe', fact: 'Fait vérifié', source: 'Source', newBatch: '🎲 Nouveau lot aléatoire', noData: 'Aucune donnée disponible pour le moment.' },
    en: { myth: 'Myth',  fact: 'Verified fact', source: 'Source', newBatch: '🎲 New random batch',      noData: 'No data available for now.' },
    de: { myth: 'Irrtum',fact: 'Belegter Fakt', source: 'Quelle', newBatch: '🎲 Neuer zufälliger Satz',  noData: 'Zurzeit keine Daten verfügbar.' },
  }[LANG];

  // ---------- DOM helpers ----------
  const $ = (s, el=document) => el.querySelector(s);
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
      console.warn('[fun-facts] #facts-grid manquait, il a été créé.');
    }
    return grid;
  };
  const GRID = ensureGrid();

  // ---------- Squelette ----------
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
    if (!it || typeof it!=='object') return null;
    let claim   = it.claim   || it.front || it.title || it.myth || it.question || '';
    let explain = it.explain || it.back  || it.fact  || it.answer || it.summary || '';
    const url   = it.source || it.url || it.link || '';

    // Recto propre
    claim = claim
      .replace(/^mythe?\s*[:\-]\s*/i,'')
      .replace(/^myth\s*[:\-]\s*/i,'')
      .replace(/^misconception\s*[:\-]\s*/i,'')
      .replace(/^-+\s*/,'');
    claim = sentence(claim).replace(/[.!?…]+$/,'');
    if (claim.length>160) claim = clampWords(claim,22);

    // Verso ≤ 30 mots
    if (explain) explain = ensureDot(sentence(claimWords(explain,30)));
    function claimWords(x, n){ return clampWords(x, n); }

    if (!explain) {
      explain = { fr:'Voir la source pour le détail.',
                  en:'See the source for details.',
                  de:'Siehe Quelle für Details.' }[LANG];
    }

    return { claim, explain, url, sourceTitle: it.sourceTitle || domain(url) };
  };

  // ---------- Carte ----------
  const card = item => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d'; wrap.tabIndex=0; wrap.setAttribute('role','button');

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
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!/json/i.test(ct)){
      // Si jamais c'est de l'HTML, éviter l’“Unexpected token <”
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    return res.json();
  };

  // ---------- Charge un lot ----------
  let lastKeys = new Set();
  const keyOf = it => (it.url || it.claim || JSON.stringify(it)).slice(0,200);

  const getFacts = async (n=9) => {
    // API officielle
    const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data = await fetchJSON(url);
    let arr =
      Array.isArray(data)          ? data :
      Array.isArray(data?.items)   ? data.items :
      Array.isArray(data?.facts)   ? data.facts :
      [];

    // éviter de répéter exactement le même lot
    if (arr.length){
      const filtered = arr.filter(x => !lastKeys.has(keyOf(x)));
      if (filtered.length >= Math.min(n,3)) arr = filtered;
    }
    lastKeys = new Set(arr.slice(0,n).map(keyOf));
    return arr.slice(0,n);
  };

  const render = (list) => {
    clearSkeleton();
    const frag = document.createDocumentFragment();
    list.forEach(it => {
      const n = normalize(it);
      if (n) frag.appendChild(card(n));
    });
    GRID.appendChild(frag);
  };

  const load = async () => {
    showSkeleton(9);
    try {
      const facts = await getFacts(9);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
    }
  };

  // ---------- Bouton "Nouveau lot" (crée si absent) ----------
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
