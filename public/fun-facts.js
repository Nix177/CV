// public/fun-facts.js — Fun Facts (dataset prioritaire + fallbacks)
// Flip sur place, autosize, wrap-around quand tout a été vu, et hooks pour un mini-chat.

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
  const LANG = getLang(); DBG('LANG', LANG); log('LANG =', LANG, 'labels =', {});

  // ---------- Root / états ----------
  const ROOT = document.getElementById('ff_root');
  const setReady   = () => { if (ROOT){ ROOT.classList.remove('ff-pending'); ROOT.classList.add('ff-ready'); } };
  const setPending = (msg) => {
    if (ROOT){ ROOT.classList.remove('ff-ready'); ROOT.classList.add('ff-pending'); }
    const st = document.getElementById('ff_status'); if (st) st.textContent = msg || '';
  };

  // ---------- Datasets locaux ----------
  const DATASETS = { fr: '/ff-dataset.fr.json', en: '/ff-dataset.en.json', de: '/ff-dataset.de.json' };

  // ---------- i18n ----------
  const LMAP = {
    fr: { myth:'Idée reçue', fact:'Réponse', source:'Source', newBatch:'🎲 Nouveau lot aléatoire', noData:'Aucune donnée disponible pour le moment.', cards:'cartes',
          ask:'Questions sur ces idées reçues ?', placeholder:'Pose ta question…', send:'Envoyer', thinking:'Je réfléchis…' },
    en: { myth:'Myth',       fact:'Answer',  source:'Source', newBatch:'🎲 New random batch',      noData:'No data available for now.',           cards:'cards',
          ask:'Questions about these myths?', placeholder:'Ask a question…', send:'Send', thinking:'Thinking…' },
    de: { myth:'Irrtum',     fact:'Antwort', source:'Quelle', newBatch:'🎲 Neuer zufälliger Satz',  noData:'Zurzeit keine Daten verfügbar.',       cards:'Karten',
          ask:'Fragen zu diesen Irrtümern?', placeholder:'Stelle eine Frage…', send:'Senden', thinking:'Ich überlege…' },
  };
  const L = LMAP[LANG] || LMAP.fr;

  // ---------- CSS fallback (pour s'afficher même si le CSS global manque) ----------
  function injectFallbackCSS() {
    if (document.getElementById('ff-fallback-css')) return;
    const css = `
      #facts-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:stretch;margin-top:8px;}
      .ff-card{position:relative;perspective:1200px;outline:none;min-height:200px;}
      .ff-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s ease;}
      .ff-card.is-flipped .ff-inner{transform:rotateY(180deg);}
      .ff-face{display:block !important;position:absolute !important;inset:0 !important;overflow:auto;
               backface-visibility:hidden !important;padding:16px;border-radius:16px;background:rgba(255,255,255,.06);
               border:1px solid rgba(255,255,255,.10);color:#e8efff;box-shadow:0 6px 20px rgba(0,0,0,.28)}
      .ff-face.ff-back{transform:rotateY(180deg);}
      .ff-head{font-weight:700;opacity:.92;margin-bottom:8px}
      .badge{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.18);font-size:.85rem}
      .ff-text{line-height:1.35}
      .ff-actions{margin-top:12px;font-size:.9rem;opacity:.96}
      .ff-link{color:#cfe0ff;text-decoration:underline}
      .ff-skel{height:200px;border-radius:16px;background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06));
               background-size:200% 100%;animation:ffShine 1.2s linear infinite;border:1px solid rgba(255,255,255,.10);box-shadow:0 6px 20px rgba(0,0,0,.28)}
      @keyframes ffShine{0%{background-position:0 0}100%{background-position:200% 0}}
      .ff-card.ff-measure .ff-face{position:static !important;transform:none !important;backface-visibility:visible !important;overflow:visible;}
      .ff-qa{margin-top:20px;border-radius:16px;border:1px dashed rgba(255,255,255,.25);background:rgba(255,255,255,.04);padding:14px 14px 12px;backdrop-filter:blur(3px)}
      .ff-qa h3{margin:0 0 8px 0;font-size:1.05rem;opacity:.92}
      .ff-qa-messages{max-height:280px;overflow:auto;padding:6px 2px 8px;display:flex;flex-direction:column;gap:8px}
      .ff-qa-msg{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);line-height:1.35}
      .ff-qa-msg.me{align-self:flex-end;background:rgba(59,130,246,.18);border-color:rgba(59,130,246,.35)}
      .ff-qa-form{display:flex;gap:8px;margin-top:10px}
      .ff-qa-input{flex:1;min-height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:#e8efff;padding:0 12px}
      .ff-qa-btn{min-width:110px;border-radius:12px;padding:8px 14px;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#e8efff;cursor:pointer}
      .ff-qa-btn[aria-busy="true"]{opacity:.6;cursor:progress}
    `;
    const style = document.createElement('style');
    style.id = 'ff-fallback-css';
    style.textContent = css;
    document.head.appendChild(style);
    DBG('fallback CSS injected');
  }

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
    } else { log('#facts-grid trouvé.'); }
    return grid;
  };
  const GRID = ensureGrid();
  const COUNT = $('#ff_count');

  // ---------- Squelettes ----------
  const showSkeleton = (n=9) => { GRID.classList.add('ff-loading'); GRID.setAttribute('aria-busy','true'); GRID.innerHTML=''; for(let i=0;i<n;i++){ const d=document.createElement('div'); d.className='ff-skel'; GRID.appendChild(d); } };
  const clearSkeleton = () => { GRID.classList.remove('ff-loading'); GRID.removeAttribute('aria-busy'); GRID.innerHTML=''; };

  // ---------- Texte ----------
  const clampWords = (txt, max=30) => { if (!txt) return ''; const w = txt.trim().split(/\s+/); return (w.length<=max)?txt.trim():(w.slice(0,max).join(' ')+'…'); };
  const sentence = s => { if (!s) return ''; const t=s.trim().replace(/\s+/g,' '); return t ? t[0].toUpperCase()+t.slice(1) : ''; };
  const ensureDot = s => /[.!?…]$/.test(s) ? s : (s ? s+'.' : s);
  const domain = u => { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } };

  // ---------- Keys / normalisation ----------
  const shortHash = (str) => { let h=2166136261>>>0; const s=String(str||''); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h+(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24))>>>0; } return h.toString(36); };
  const keyOf = (it) => it?.id ? String(it.id) : shortHash((it?.claim || it?.title || '') + '|' + (it?.source || it?.url || ''));
  const normalize = (it) => {
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
    const wrap = document.createElement('div'); wrap.className = 'ff-card'; wrap.tabIndex = 0;
    const inner = document.createElement('div'); inner.className = 'ff-inner';
    const front = document.createElement('div'); front.className = 'ff-face ff-front';
    front.innerHTML = `<div class="ff-head"><span class="badge">${L.myth}</span></div><p class="ff-text ff-claim">${n.claim || ''}</p><div class="ff-actions"></div>`;
    const back = document.createElement('div');  back.className = 'ff-face ff-back';
    const link = n.url ? `<a class="ff-link" href="${n.url}" target="_blank" rel="noopener">${L.source} · ${domain(n.url)}</a>` : '';
    back.innerHTML = `<p class="ff-text ff-explain">${n.explain || ''}</p><div class="ff-actions">${link}</div>`;
    inner.append(front, back); wrap.appendChild(inner);
    const flip = () => wrap.classList.toggle('is-flipped');
    wrap.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
    wrap.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); }});
    return wrap;
  };

  // ---------- Anti-répétitions (scopé par langue) ----------
  const LS_SEEN = `ff_seen_ids_v2_${LANG}`;
  const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); } catch { return new Set(); } };
  const saveSeen = (set) => { const arr=[...set]; localStorage.setItem(LS_SEEN, JSON.stringify(arr.slice(-600))); };
  let seenIDs = loadSeen();
  let lastKeys = new Set();

  // court & borné pour passer au backend
  const buildSeenParam = (set) => {
    const MAX_IDS = 120, MAX_LEN = 1500;
    const ids = [...set].slice(-MAX_IDS).map(x => shortHash(x));
    const csv = ids.join(',');
    return (csv && csv.length <= MAX_LEN) ? `&seen=${encodeURIComponent(csv)}` : '';
  };

  // ---------- Dataset prioritaire ----------
  async function fetchDataset(lang) {
    const url = DATASETS[lang]; if (!url) return null;
    try {
      DBG('try dataset', url);
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) { DBG('dataset 404/KO', r.status); return null; }
      const ct = r.headers.get('content-type') || '';
      if (!/json/i.test(ct)) { DBG('dataset non-JSON', ct); return null; }
      const data = await r.json(); if (!Array.isArray(data) || !data.length) return null;
      DBG('dataset OK len', data.length); return data;
    } catch (e) { DBG('dataset fetch error', e?.message || e); return null; }
  }

  // ---------- Fallback fetch ----------
  const fetchJSON = async (url) => {
    log('fetch:', url);
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/json/i.test(ct)){ const txt = await res.text(); throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`); }
    return res.json();
  };

  // ---------- Batch ----------
  function sampleExcluding(arr, want, excluded) {
    const out=[]; for(const it of arr){ const k=keyOf(it); if(!excluded.has(k)){ out.push(it); if(out.length>=want) break; } } return out;
  }
  function shuffleInPlace(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }

  const fetchBatch = async (n) => {
    // 1) dataset local
    const ds = await fetchDataset(LANG);
    if (Array.isArray(ds) && ds.length){
      const pool=shuffleInPlace(ds.slice());
      const pick=sampleExcluding(pool, n*3, new Set([...seenIDs, ...lastKeys]));
      if (pick.length) return { arr: pick, meta: { source:'dataset' } };
    }
    // 2) API ff-batch (avec seen hashé)
    try {
      const seenQs = buildSeenParam(new Set([...seenIDs, ...lastKeys]));
      const url1 = `/api/ff-batch?lang=${encodeURIComponent(LANG)}&count=${n*3}${seenQs}`;
      const data1 = await fetchJSON(url1);
      if (Array.isArray(data1) && data1.length) return { arr: data1, meta:{source:'ff-batch'} };
    } catch(e){ log('ff-batch failed → fallback /api/facts', e); }
    // 3) API facts (dernier filet)
    const url2 = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data2 = await fetchJSON(url2);
    const arr = Array.isArray(data2) ? data2
            : Array.isArray(data2?.items) ? data2.items
            : Array.isArray(data2?.facts) ? data2.facts : [];
    return { arr, meta:{source:'facts'} };
  };

  // ---------- getFacts (avec wrap-around quand tout est vu) ----------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  async function getFacts(n = 9, maxTries = 3) {
    const picked = [];
    const avoid  = new Set([...lastKeys]);                 // ne pas répéter le lot précédent
    const seenNow = new Set([...avoid, ...seenIDs]);       // historique + lot précédent

    // 1) Tentatives normales en respectant l'historique
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
      if (picked.length < n) await sleep(180);
    }

    // 2) Pas assez ? wrap-around : on "réouvre" le dataset en évitant juste le lot précédent
    if (picked.length < n) {
      const { arr } = await fetchBatch(n * 6);
      const pool = (arr || []).filter(x => !avoid.has(keyOf(x)));
      shuffleInPlace(pool);
      for (const x of pool) {
        const k = keyOf(x);
        if (!picked.some(p => keyOf(p) === k)) {
          picked.push(x);
          if (picked.length >= n) break;
        }
      }
      // reset de l'historique : on repart sur un nouveau cycle
      seenIDs = new Set();
    }

    // 3) Màj mémoires
    lastKeys = new Set(picked.map(keyOf));
    for (const k of lastKeys) seenIDs.add(k);
    saveSeen(seenIDs);

    DBG('picked raw len', picked.length);
    return picked;
  }

  // ---------- Autosize des cartes ----------
  function measureAndFixHeights() {
    const cards = $$('.ff-card');
    if (!cards.length) return;
    cards.forEach(card => {
      card.classList.add('ff-measure');
      card.style.height = ''; // reset
      const front = card.querySelector('.ff-front');
      const back  = card.querySelector('.ff-back');
      const h = Math.max(front?.scrollHeight || 0, back?.scrollHeight || 0, 200);
      card.classList.remove('ff-measure');
      card.style.height = h + 'px';
      const inner = card.querySelector('.ff-inner');
      if (inner) inner.style.height = '100%';
    });
  }
  let resizeTO=null;
  window.addEventListener('resize', () => { clearTimeout(resizeTO); resizeTO=setTimeout(measureAndFixHeights, 120); });

  // ---------- Rendu ----------
  function forceVisible() {
    const rect = GRID.getBoundingClientRect();
    if (!rect.height || !rect.width) {
      GRID.style.display = 'grid';
      GRID.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
      GRID.style.gap = '16px';
      GRID.style.minHeight = '200px';
      GRID.style.visibility = 'visible';
      DBG('forceVisible applied');
    }
  }
  const render = (list) => {
    clearSkeleton();
    if (!list || !list.length) {
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      setPending(L.noData);
      return;
    }
    const normed = list.map(normalize);
    const frag = document.createDocumentFragment();
    normed.forEach((it) => frag.appendChild(card(it)));
    GRID.appendChild(frag);
    if (COUNT) COUNT.textContent = `${normed.length} ${L.cards}`;
    requestAnimationFrame(() => {
      forceVisible();
      measureAndFixHeights();
      setReady();
    });
  };

  // ---------- Actions ----------
  const load = async () => {
    showSkeleton(9);
    setPending('');
    try {
      const facts = await getFacts(9, 3);
      render(facts);
    } catch (e) {
      clearSkeleton();
      GRID.innerHTML = `<p class="muted">${L.noData}</p>`;
      console.error('[fun-facts] load() error:', e);
      setPending('API indisponible.');
    }
  };

  const ensureNewBtn = () => {
    let btn = document.querySelector('#ff_random, #ff-random, #ff-new');
    if (!btn) {
      const h1 = document.querySelector('h1') || document.body;
      btn = document.createElement('button');
      btn.id = 'ff_random'; btn.className = 'btn primary'; btn.textContent = L.newBatch;
      h1.parentNode.insertBefore(btn, h1.nextSibling);
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      try { await load(); } finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });
  };

  // Expose hooks pour un éventuel mini-chat
  window.__ff_normalize = normalize;
  window.__ff_render = (list) => render(list);

  // ---------- Go ----------
  document.addEventListener('DOMContentLoaded', () => {
    injectFallbackCSS();
    DBG('grid found');
    ensureNewBtn();
    load();
  });
})();
