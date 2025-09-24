/* public/fun-facts.js — avec logs de debug détaillés */
(() => {
  // ===== Debug helper =======================================================
  const DEBUG = /(?:\?|&)ffdebug=1\b/i.test(location.search) ||
                (typeof localStorage !== 'undefined' && localStorage.getItem('ffDebug') === '1');
  const dlog = (...args) => { if (DEBUG) console.log('[fun-facts]', ...args); };
  const derr = (...args) => console.error('[fun-facts]', ...args);
  const time = (label) => {
    const t0 = performance.now();
    return () => { const dt = (performance.now() - t0).toFixed(1); dlog(`${label} in ${dt}ms`); };
  };

  // ===== Langue =============================================================
  const getLang = () => {
    const htmlLang = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    if (htmlLang) return htmlLang;
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    const m = path.match(/-(en|de)\.html?$/);
    return m ? m[1] : 'fr';
  };
  const LANG = getLang();

  // ===== i18n ===============================================================
  const LMAP = {
    fr: { myth:'Mythe', fact:'Fait vérifié', source:'Source', newBatch:'🎲 Nouveau lot aléatoire', noData:'Aucune donnée disponible pour le moment.' },
    en: { myth:'Myth',  fact:'Verified fact', source:'Source', newBatch:'🎲 New random batch',      noData:'No data available for now.' },
    de: { myth:'Irrtum',fact:'Belegter Fakt', source:'Quelle', newBatch:'🎲 Neuer zufälliger Satz',  noData:'Zurzeit keine Daten verfügbar.' },
  };
  const L = LMAP[LANG] || LMAP.fr;
  dlog('LANG =', LANG, 'labels =', L);

  // ===== DOM helpers ========================================================
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
    } else {
      dlog('#facts-grid trouvé.');
    }
    return grid;
  };
  const GRID = ensureGrid();

  // ===== Squelette ==========================================================
  const showSkeleton = (n=9) => {
    dlog('showSkeleton', n);
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
    dlog('clearSkeleton');
    GRID.classList.remove('ff-loading');
    GRID.removeAttribute('aria-busy');
    GRID.innerHTML='';
  };

  // ===== Utils texte ========================================================
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

  // ===== Normalisation item {claim, explain, url} ===========================
  const normalize = (it, idx) => {
    if (!it || typeof it!=='object') {
      dlog('normalize: item invalide @', idx, it);
      return null;
    }
    let claim   = it.claim   || it.front || it.title || it.myth || it.question || '';
    let explain = it.explain || it.back  || it.fact  || it.answer || it.summary || '';
    const url   = it.source || it.url || it.link || '';

    // Recto propre
    claim = claim
      .replace(/^mythe?\s*[:\-]\s*/i,'')
      .replace(/^myth\s*[:\-]\s*/i,'')
      .replace(/^misconception\s*[:\-]\s*/i,'')
      .replace(/^-+\s*/, '');
    claim = sentence(claim).replace(/[.!?…]+$/,'');
    if (claim.length>160) claim = clampWords(claim,22);

    // Verso ≤ 30 mots (et phrase)
    if (explain) explain = ensureDot(sentence(clampWords(explain,30)));

    if (!explain) {
      explain = { fr:'Voir la source pour le détail.',
                  en:'See the source for details.',
                  de:'Siehe Quelle für Details.' }[LANG];
    }

    const out = { claim, explain, url, sourceTitle: it.sourceTitle || domain(url) };
    if (DEBUG) dlog('normalize @', idx, '→', out);
    return out;
  };

  // ===== Carte ==============================================================
  const card = (item) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex=0;
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

  // ===== Fetch JSON safe + logs ============================================
  const fetchJSON = async (url) => {
    dlog('fetchJSON:', url);
    const stop = time('fetch');
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    stop();
    dlog('→ status =', res.status, 'content-type =', res.headers.get('content-type'));

    if (!res.ok) {
      let preview = '';
      try { preview = (await res.text()).slice(0,200); } catch {}
      throw new Error(`HTTP ${res.status} — body: ${preview}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}) — début: ${txt.slice(0,200)}`);
    }
    const data = await res.json();
    if (DEBUG) {
      dlog('payload keys =', data && typeof data==='object' ? Object.keys(data) : typeof data);
      try { dlog('payload preview =', JSON.parse(JSON.stringify(data)).items?.slice?.(0,2) ?? data); } catch {}
    }
    return data;
  };

  // ===== Charge un lot ======================================================
  let lastKeys = new Set();
  const keyOf = it => (it.url || it.claim || JSON.stringify(it)).slice(0,200);

  const getFacts = async (n=9) => {
    const url = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const raw = await fetchJSON(url);

    // Accepter plusieurs formes possibles
    let arr =
      Array.isArray(raw)          ? raw :
      Array.isArray(raw?.items)   ? raw.items :
      Array.isArray(raw?.facts)   ? raw.facts :
      [];

    dlog('getFacts: type=', Array.isArray(arr) ? 'array' : typeof arr, 'len=', arr.length);

    // éviter de répéter exactement le même lot
    if (arr.length){
      const filtered = arr.filter(x => !lastKeys.has(keyOf(x)));
      dlog('filtered unique =', filtered.length);
      if (filtered.length >= Math.min(n,3)) arr = filtered;
    }
    const out = arr.slice(0,n);
    lastKeys = new Set(out.map(keyOf));
    return out;
  };

  const render = (list) => {
    dlog('render: items =', list.length);
    clearSkeleton();
    const frag = document.createDocumentFragment();
    list.forEach((it, idx) => {
      const n = normalize(it, idx);
      if (n) frag.appendChild(card(n));
    });
    GRID.appendChild(frag);
  };

  const load = async () => {
    console.groupCollapsed('[fun-facts] load()');
    showSkeleton(9);
    const stop = time('load() total');
    try {
      const facts = await getFacts(9);
      if (!Array.isArray(facts)) {
        derr('load: facts N’EST PAS un tableau. Reçu =', facts);
        GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
        return;
      }
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      derr('load() error:', e);
    } finally {
      stop();
      console.groupEnd();
    }
  };

  // ===== Bouton "Nouveau lot" ==============================================
  const ensureNewBtn = () => {
    let btn = $('#ff_random') || $('#ff-random') || $('#ff-new');
    if (!btn) {
      const h1 = document.querySelector('h1') || document.body.firstElementChild || document.body;
      btn = document.createElement('button');
      btn.id = 'ff_random';
      btn.className = 'btn primary';
      btn.style.margin = '10px 0';
      btn.textContent = L.newBatch;
      h1.parentNode.insertBefore(btn, h1.nextSibling);
      dlog('Bouton "Nouveau lot" créé.');
    } else {
      dlog('Bouton "Nouveau lot" trouvé.');
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      dlog('Nouveau lot: click');
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });
  };

  // ===== Expose quelques helpers pour tester depuis la console =============
  window.__ff = {
    reload: load,
    debug(on=true){ localStorage.setItem('ffDebug', on ? '1' : '0'); dlog('debug set to', on); },
    lang: LANG
  };

  // ===== Go =================================================================
  document.addEventListener('DOMContentLoaded', () => {
    dlog('DOMContentLoaded');
    ensureNewBtn();
    load();
  });
})();
