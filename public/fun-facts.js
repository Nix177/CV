// public/fun-facts.js — FR/EN/DE
// - Recto = claim / Verso = explain + Source
// - Bouton "Nouveau lot" + skeleton de chargement
// - Anti-répétitions (localStorage) + seen compact en GET
// - Panneau debug optionnel (?ffdebug=1)

(() => {
  const log = (...a) => console.debug('[fun-facts]', ...a);

  // --------- DEBUG ---------
  const URLFLAGS = new URLSearchParams(location.search);
  const DEBUG = URLFLAGS.has('ffdebug') || URLFLAGS.get('debug') === '1';
  let dbgBox;
  const dbg = (...a) => {
    if (!DEBUG) return;
    if (!dbgBox) {
      dbgBox = document.createElement('div');
      dbgBox.id = 'ff_debug';
      dbgBox.style.cssText =
        'position:fixed;right:8px;bottom:8px;max-width:38vw;max-height:40vh;overflow:auto;z-index:99999;font:12px/1.35 monospace;background:#111c;border:1px solid #3963;border-radius:8px;padding:8px;color:#cfe;';
      document.body.appendChild(dbgBox);
    }
    const line = document.createElement('div');
    line.textContent = a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    dbgBox.appendChild(line);
    dbgBox.scrollTop = dbgBox.scrollHeight;
    console.debug('[ff:dbg]', ...a);
  };

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
    fr: { myth: 'Mythe', fact: 'Fait vérifié', source: 'Source', newBatch: '🎲 Nouveau lot aléatoire', noData: 'Aucune donnée disponible pour le moment.', cards: 'cartes', reset: '♻︎ Réinitialiser tirages' },
    en: { myth: 'Myth',  fact: 'Verified fact', source: 'Source', newBatch: '🎲 New random batch',      noData: 'No data available for now.', cards: 'cards', reset: '♻︎ Reset seen' },
    de: { myth: 'Irrtum',fact: 'Belegter Fakt', source: 'Quelle', newBatch: '🎲 Neuer zufälliger Satz',  noData: 'Zurzeit keine Daten verfügbar.', cards: 'Karten', reset: '♻︎ Zurücksetzen' },
  };
  const L = LMAP[LANG] || LMAP.fr;
  log('LANG =', LANG, 'labels =', L);
  dbg('LANG', LANG);

  // ---------- DOM ----------
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
      dbg('grid created dynamically');
    } else {
      dbg('grid found');
    }
    return grid;
  };
  const GRID = ensureGrid();
  const COUNT = $('#ff_count');

  // ---------- Fallback CSS si invisible ----------
  const injectFallbackCSS = () => {
    if ($('#ff_fallback_css')) return;
    const st = document.createElement('style');
    st.id = 'ff_fallback_css';
    st.textContent = `
      #facts-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
      .card3d { position:relative; display:block; min-height:140px; border:1px solid rgba(255,255,255,.16);
                border-radius:14px; padding:12px; background:rgba(255,255,255,.04); }
      .card3d .face { position:relative; transform:none !important; backface-visibility:visible !important; }
      .ff-skel { min-height:120px; border-radius:12px; background:linear-gradient(90deg,rgba(255,255,255,.06),rgba(255,255,255,.12),rgba(255,255,255,.06)); }
    `;
    document.head.appendChild(st);
    dbg('fallback CSS injected');
  };
  const forceVisible = (el) => {
    let n = el, applied = false;
    while (n && n !== document.body) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none') { n.style.setProperty('display', 'block', 'important'); applied = true; }
      if (cs.visibility === 'hidden') { n.style.setProperty('visibility', 'visible', 'important'); applied = true; }
      if (parseFloat(cs.opacity || '1') === 0) { n.style.setProperty('opacity', '1', 'important'); applied = true; }
      n = n.parentElement;
    }
    if (applied) dbg('forceVisible applied');
  };

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

  // ---------- Utils ----------
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

  // ---------- Normalisation (recto/verso prêts) ----------
  const keyOf = (it) => (it?.id || it?.claim || it?.title || it?.url || JSON.stringify(it||{})).slice(0, 180);
  const normalize = (it) => {
    // préférer les champs “propres” du batch
    let claim = it.claim || it.title || it.q || '';
    let explain = it.explain || it.explainShort || it.explanation || it.truth || it.answer || '';
    const url = it.source || (Array.isArray(it.sources) ? (typeof it.sources[0] === 'string' ? it.sources[0] : it.sources[0]?.url) : it.url) || '';

    claim = ensureDot(sentence(claim));
    explain = ensureDot(sentence(clampWords(explain, 30)));

    return { type: 'myth', claim, explain, url, _k: keyOf(it) };
  };

  // ---------- Carte ----------
  const card = (n, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'card3d';
    wrap.tabIndex = 0;
    wrap.dataset.idx = String(idx);

    const inner = document.createElement('div');
    inner.className = 'inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head"><span class="badge">${LMAP[LANG].myth}</span></div>
      <p class="ff-text ff-claim">${n.claim || ''}</p>
      <div class="ff-actions"></div>`;

    const back = document.createElement('div');
    back.className = 'face back';
    const link = n.url ? `<a class="ff-link" href="${n.url}" target="_blank" rel="noopener">${LMAP[LANG].source} · ${domain(n.url)}</a>` : '';
    back.innerHTML = `<p class="ff-text ff-explain">${n.explain || ''}</p><div class="ff-actions">${link}</div>`;

    inner.append(front, back);
    wrap.appendChild(inner);

    requestAnimationFrame(() => {
      const h = wrap.getBoundingClientRect().height;
      if (h < 10) injectFallbackCSS();
    });

    const flip = () => wrap.classList.toggle('is-flipped');
    wrap.addEventListener('click', e => { if (!e.target.closest('a')) flip(); });
    wrap.addEventListener('keydown', e => { if (e.key===' '||e.key==='Enter'){ e.preventDefault(); flip(); }});
    return wrap;
  };

  // ---------- seen compact ----------
  const shortHash = (str) => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h + (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24)) >>> 0; }
    return h.toString(36);
  };
  const buildSeenParam = (set) => {
    const arr = [...set].slice(-80);
    const ids = arr.map(shortHash);
    return ids.length ? `&seen=${encodeURIComponent(ids.join(','))}` : '';
  };

  // ---------- Fetch JSON ----------
  const fetchJSON = async (url) => {
    dbg('GET', url);
    const res = await fetch(url, { headers:{'Accept':'application/json'} });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (!/json/i.test(ct)){
      const txt = await res.text();
      throw new Error(`Réponse non-JSON (${ct}): ${txt.slice(0,120)}…`);
    }
    const data = await res.json();
    dbg('OK len', Array.isArray(data) ? data.length : (data?.items?.length || 0));
    return data;
  };

  // ---------- Anti-répétitions ----------
  const LS_SEEN = 'ff_seen_ids_v1';
  const loadSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN) || '[]')); } catch { return new Set(); } };
  const saveSeen = (set) => {
    const arr = [...set];
    localStorage.setItem(LS_SEEN, JSON.stringify(arr.slice(-300)));
  };
  let seenIDs = loadSeen();
  let lastKeys = new Set();

  // ---------- Batch ----------
  const fetchBatch = async (n) => {
    const seenQs = buildSeenParam(seenIDs);
    try {
      const url1 = `/api/ff-batch?lang=${encodeURIComponent(LANG)}&count=${n*3}${seenQs}`;
      const data1 = await fetchJSON(url1);
      if (Array.isArray(data1) && data1.length) {
        dbg('sample batch[0]', data1[0]);
        return { arr: data1, meta: { source: 'ff-batch' } };
      }
    } catch (e) {
      dbg('ff-batch error', String(e));
    }
    const url2 = `/api/facts?lang=${encodeURIComponent(LANG)}&n=${n}&t=${Date.now()}`;
    const data2 = await fetchJSON(url2);
    const arr = Array.isArray(data2) ? data2
          : Array.isArray(data2?.items) ? data2.items
          : Array.isArray(data2?.facts) ? data2.facts
          : [];
    dbg('sample facts[0]', arr[0]);
    return { arr, meta: { source: 'facts' } };
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const getFacts = async (n = 9, maxTries = 3) => {
    const picked = [];
    const seenNow = new Set([...lastKeys, ...seenIDs]);
    for (let attempt = 1; attempt <= maxTries && picked.length < n; attempt++) {
      const { arr } = await fetchBatch(n);
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
    list.forEach((it, i) => frag.appendChild(card(normalize(it), i)));
    GRID.innerHTML = '';
    GRID.appendChild(frag);
    if (COUNT) COUNT.textContent = `${list.length} ${L.cards}`;

    // Layout check
    requestAnimationFrame(() => {
      let rect = GRID.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        forceVisible(GRID);
        injectFallbackCSS();
      }
    });
  };

  // ---------- UI ----------
  const ensureControls = () => {
    let btn = $('#ff_random') || $('#ff-random') || $('#ff-new');
    if (!btn) {
      const h1 = document.querySelector('h1') || document.body;
      btn = document.createElement('button');
      btn.id = 'ff_random';
      btn.className = 'btn primary';
      btn.style.marginLeft = '8px';
      btn.textContent = L.newBatch;
      h1.parentNode.insertBefore(btn, h1.nextSibling);
    }
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      btn.classList.add('is-busy'); btn.setAttribute('aria-busy','true');
      showSkeleton(9);
      try { render(await getFacts(9, 3)); }
      finally { btn.classList.remove('is-busy'); btn.removeAttribute('aria-busy'); }
    });

    // Reset "vu" (utile en dev)
    if (!$('#ff_reset')) {
      const r = document.createElement('button');
      r.id = 'ff_reset';
      r.className = 'btn';
      r.style.marginLeft = '8px';
      r.textContent = L.reset;
      btn.after(r);
      r.addEventListener('click', () => {
        localStorage.removeItem('ff_seen_ids_v1');
        seenIDs = new Set();
        lastKeys = new Set();
      });
    }
  };

  // ---------- Go ----------
  document.addEventListener('DOMContentLoaded', async () => {
    ensureControls();
    showSkeleton(9);
    try { render(await getFacts(9, 3)); }
    catch { render([]); }
  });
})();
