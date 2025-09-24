// public/fun-facts.js — Fun Facts via dataset local (prioritaire) + fallback APIs.
// Cartes recto/verso, anti-répétition persistante, FR/EN/DE.

(() => {
  const log = (...a) => console.debug('[fun-facts]', ...a);
  const DBG = (...a) => console.debug('[ff:dbg]', ...a);

  // ---------- Langue ----------
  const getLang = () => {
    const h = (document.documentElement.getAttribute('lang') || '').slice(0,2).toLowerCase();
    if (h) return h;
    const path = (location.pathname.split('/').pop() || '').toLowerCase();
    const m = path.match(/-(en|de)\.html?$/);
    return m ? m[1] : 'fr';
  };
  const LANG = getLang();
  DBG('LANG', LANG);

  // ---------- Fichiers dataset par langue ----------
  const DATASETS = {
    fr: '/ff-dataset.fr.json',
    en: '/ff-dataset.en.json',
    de: '/ff-dataset.de.json',
  };

  // ---------- i18n ----------
  const LMAP = {
    fr: { myth: 'Idée reçue', fact: 'Réponse', source: 'Source', newBatch: '🎲 Nouveau lot aléatoire', noData: 'Aucune donnée disponible pour le moment.', cards: 'cartes' },
    en: { myth: 'Myth',        fact: 'Answer',  source: 'Source', newBatch: '🎲 New random batch',      noData: 'No data available for now.',           cards: 'cards' },
    de: { myth: 'Irrtum',      fact: 'Antwort', source: 'Quelle', newBatch: '🎲 Neuer zufälliger Satz',  noData: 'Zurzeit keine Daten verfügbar.',       cards: 'Karten' },
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
  const trim = (s) => String(s || '').replace(/\s+/g, ' ').trim();
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

  // ---------- Keys / normalisation ----------
  const shortHash = (str) => { // hash court base36
    let h = 2166136261 >>> 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24)) >>> 0;
    }
    return h.toString(36);
  };
  const keyOf = (it) => {
    if (it && it.id) return String(it.id);
    // clé stable depuis pair (claim+source) si pas d'id dans le JSON
    return shortHash((it?.claim || it?.title || '') + '|' + (it?.source || it?.url || ''));
  };

  const normalize = (it) => {
    // dataset: { claim, explain, source }
    // APIs fallback divers: harmonise en { type, claim, explain, url }
    const type = (it.type || 'myth').toLowerCase();
    const claimRaw = it.claim || it.title || it.q || '';
    let explainRaw = it.explainShort || it.explanation || it.explain || it.truth || it.answer || '';
    const claim   = ensureDot(sentence(claimRaw));
    const explain = ensureDot(sentence(clampWords(explainRaw, 30)));
    const url = it.source || it.url || (Array.isArray(it.sources) && it.sources[0] && (it.sources[0].url || it.sources[0])) || '';
    return { type, claim, explain, url, _k: keyOf(it) };
  };

  // ---------- Carte ----------
  const card = (n) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;

    const inner = document.createElement('div');
    inner.className = 'inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head"><span class="badge">${L.myth}</span></div>
      <p class="ff-text ff-claim">${n.claim || ''}</p>
      <div class="ff-actions"></div>`;

    const back = document.createElement('div');
    back.className = 'face back';
    const link = n.url ? `<a class="ff-link" href="${n.url}" target="_blank" rel="noopener">${L.source} · ${domain(n.url)}</a>` : '';
    back.innerHTML = `<p class="ff-text ff-explain">${n.explain || ''}</p><div class="ff-actions">${link}</div>`;

    inner.append(front, back);
    wrap.appendChild(inner);

    const flip = () => wrap.classList.toggle('is-flipped');
    wrap.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
    wrap.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); }});
    return wrap;
  };

  // ---------- Anti-répétitions persistantes ----------
  const LS_SEEN = 'ff_seen_ids_v1';
  const loadSeen = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); }
    catch { return new Set(); }
  };
  const saveSeen = (set) => {
    const arr = [...set];
    const MAX = 600; // on garde large puisqu’on a 300+ items par langue
    localStorage.setItem(LS_SEEN, JSON.stringify(arr.slice(-MAX)));
  };
  let seenIDs = loadSeen();
  let lastKeys = new Set(); // évite les 9 précédents

  // ---------- DATASET local (prioritaire) ----------
  async function fetchDataset(lang) {
    const url = DATASETS[lang];
    if (!url) return null;
    try {
      DBG('try dataset', url);
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) { DBG('dataset 404/KO', r.status); return null; }
      const ct = r.headers.get('content-type') || '';
      if (!/json/i.test(ct)) { DBG('dataset non-JSON', ct); return null; }
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) return null;
      DBG('dataset OK len', data.length);
      return data;
    } catch (e) {
      DBG('dataset fetch error', e?.message || e);
      return null;
    }
  }

  // ---------- Fallback fetch JSON ----------
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

  // ---------- Batch (dataset > ff-batch > facts) ----------
  function sampleExcluding(arr, want, excluded) {
    const out = [];
    for (const it of arr) {
      const k = keyOf(it);
      if (!excluded.has(k)) {
        out.push(it);
        if (out.length >= want) break;
      }
    }
    return out;
  }
  function shuffleInPlace(a){
    for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; }
    return a;
  }

  const fetchBatch = async (n) => {
    // 0) dataset local par langue
    const ds = await fetchDataset(LANG);
    if (Array.isArray(ds) && ds.length) {
      // mélange puis échantillon en excluant seen
      const pool = shuffleInPlace(ds.slice());
      const pick = sampleExcluding(pool, n*3, new Set([...seenIDs, ...lastKeys]));
      if (pick.length) return { arr: pick, meta: { source: 'dataset' } };
    }

    // 1) scraping Wikipédia
    try {
      const url1 = `/api/ff-batch?lang=${encodeURIComponent(LANG)}&count=${n*3}`;
      const data1 = await fetchJSON(url1);
      if (Array.isArray(data1) && data1.length) return { arr: data1, meta: { source: 'ff-batch' } };
    } catch (e) { log('ff-batch failed → fallback /api/facts', e); }

    // 2) facts fallback
    const url2 = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data2 = await fetchJSON(url2);
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
    const seenNow = new Set([...lastKeys, ...seenIDs]);
    for (let attempt = 1; attempt <= maxTries && picked.length < n; attempt++) {
      const { arr, meta } = await fetchBatch(n);
      DBG('batch', { attempt, source: meta?.source, len: arr?.length || 0 });
      for (const x of arr) {
        const k = keyOf(x);
        if (!seenNow.has(k)) {
          picked.push(x);
          seenNow.add(k);
          if (picked.length >= n) break;
        }
      }
      if (picked.length < n) await sleep(200);
    }
    lastKeys = new Set(picked.map(keyOf));
    for (const k of lastKeys) seenIDs.add(k);
    saveSeen(seenIDs);
    DBG('picked raw len', picked.length);
    return picked;
  };

  // ---------- Rendu ----------
  const render = (list) => {
    clearSkeleton();
    if (!list || !list.length) {
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      return;
    }
    const frag = document.createDocumentFragment();
    list.forEach((it) => frag.appendChild(card(normalize(it))));
    GRID.appendChild(frag);
    if (COUNT) COUNT.textContent = `${list.length} ${L.cards}`;
    // garde visible
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

  document.addEventListener('DOMContentLoaded', () => {
    DBG('grid found');
    ensureNewBtn();
    load();
  });
})();
