/* public/fun-facts.js
   Cartes + nuage + "nouveau lot" avec repli JSON local.
   Zéro dépendance. */

(() => {
  const log  = (...a) => console.log('[fun-facts]', ...a);
  const warn = (...a) => console.warn('[fun-facts]', ...a);
  const $    = (s, el=document) => el.querySelector(s);
  const $$   = (s, el=document) => Array.from(el.querySelectorAll(s));
  const lang = (document.documentElement.lang || 'fr').slice(0,2);

  // --- Cibles robustes (tolère plusieurs ids/classes existants)
  const els = {
    cards : $('#ff-grid, #ff_grid, #ff-cards, #ff_cards, .ff-cards .grid') || document.body,
    cloud : $('#ff_canvas, #ff-cloud, .ff-cloud'),
    rerollBtn : $('#ff_reroll, #ff-random, [data-action="reroll"]'),
    form  : $('#ff_form')
  };

  // --- Fetch helpers --------------------------------------------------------
  async function fetchAPI(n, seenIds, series) {
    const seen = seenIds?.length ? `&seen=${encodeURIComponent(seenIds.join(','))}` : '';
    const ser  = series ? `&series=${encodeURIComponent(series)}` : '';
    const url  = `/api/facts?lang=${lang}&n=${n}${seen}${ser}`;
    try {
      const r = await fetch(url, { cache:'no-cache' });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const arr = await r.json();
      if (!Array.isArray(arr) || arr.length===0) return null;
      return arr.map(normalize);
    } catch (e) { warn('API fail:', e.message||e); return null; }
  }

  async function fetchLocal(series) {
    const url = '/facts-data.json';
    try {
      const r = await fetch(url, { cache:'no-cache' });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const raw = await r.json();
      const items = Array.isArray(raw) ? raw : (raw.items || []);
      const filtered = items.filter(x => {
        const okLang   = x.lang ? x.lang.slice(0,2)===lang : true;
        const okSeries = series ? (x.series===series || (x.tags||[]).includes(series)) : true;
        return okLang && okSeries;
      });
      return filtered.map(normalize);
    } catch (e) { warn('Local JSON fail:', e.message||e); return []; }
  }

  // --- Normalisation (schémas flexibles) -----------------------------------
  const strip = s => { const d=document.createElement('div'); d.innerHTML = s||''; return d.textContent||''; };
  const first = (...xs) => xs.find(x => x!=null && String(x).trim()) ?? '';
  const truncWords = (s, n) => {
    const w = (s||'').split(/\s+/).filter(Boolean);
    return w.length<=n ? s : w.slice(0,n).join(' ')+'…';
  };

  function normalize(o){
    const id   = o.id || o.slug || `it-${Math.random().toString(36).slice(2,8)}`;
    const type = (o.type || o.kind || '').toLowerCase().includes('myth') ? 'myth'
               : (o.type || o.kind || '').toLowerCase().includes('fact') ? 'fact'
               : (o.answer===true ? 'fact' : o.answer===false ? 'myth' : 'unknown');
    const title = first(o.title, o.claim, o.statement, o.question, '—');
    const category = first(o.category, o.domain, o.topic, o.tag, '');

    const long = first(o.back, o.body, o.explanation, o.explain, o.answer, '');
    const back = truncWords(strip(long), 30) ||
                 (type==='myth' ? 'Mythe réfuté : voir sources.' :
                  type==='fact' ? 'Fait avéré : voir sources.' : 'Explication indisponible.');

    const sources = []
      .concat(o.sources||o.refs||[])
      .map(s => typeof s==='string' ? {href:s, label:s.replace(/^https?:\/\//,'').slice(0,80)}
                                    : {href: s.href||s.url, label: s.label || (s.url||'').replace(/^https?:\/\//,'').slice(0,80)})
      .filter(s => s && s.href);

    return { id, type, title, category, back, sources };
  }

  // --- Rendu cartes ---------------------------------------------------------
  function cardNode(it){
    const el = document.createElement('article');
    el.className = `ff-card ${it.type}`;
    el.id = `ff-${it.id}`;
    el.tabIndex = 0;
    el.innerHTML = `
      <div class="ff-front">
        <div class="ff-meta">
          <span class="ff-type">${it.type==='myth' ? '❓ Mythe' : '⭐ Fait avéré'}</span>
          ${it.category ? `<span class="ff-cat">${escapeHTML(it.category)}</span>` : ''}
        </div>
        <h3 class="ff-title">${escapeHTML(it.title)}</h3>
      </div>
      <div class="ff-back">
        <p class="ff-explain">${escapeHTML(it.back)}</p>
        ${it.sources?.length ? `<ul class="ff-sources">${
          it.sources.slice(0,4).map(s=>`<li><a href="${escapeAttr(s.href)}" target="_blank" rel="noopener">${escapeHTML(s.label||s.href)}</a></li>`).join('')
        }</ul>` : ''}
      </div>`;
    const flip = () => el.classList.toggle('flipped');
    el.addEventListener('click', flip);
    el.addEventListener('keydown', e => { if (e.key==='Enter' || e.key===' ') { e.preventDefault(); flip(); }});
    return el;
  }

  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

  function renderCards(items){
    if (!els.cards) return;
    els.cards.innerHTML = '';
    items.forEach(it => els.cards.appendChild(cardNode(it)));
  }

  // --- Nuage de bulles ------------------------------------------------------
  function renderCloud(items){
    if (!els.cloud) return;
    const box = els.cloud; // conteneur positionné (voir CSS existant)
    box.innerHTML = '';
    const N = Math.min(items.length, 14);
    const take = items.slice(0, N);

    take.forEach((it, i) => {
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 70 + Math.round(Math.random()*60); // 70–130px
      b.style.width = b.style.height = size+'px';
      b.style.left  = (5 + Math.random()*85) + '%';
      b.style.top   = (5 + Math.random()*70) + '%';
      b.innerHTML = `<span class="emoji">${it.type==='myth'?'❓':'⭐'}</span>
                     <span class="label">${escapeHTML(it.title)}</span>`;
      b.addEventListener('click', () => {
        const target = document.getElementById(`ff-${it.id}`);
        if (target) target.scrollIntoView({behavior:'smooth', block:'center'});
      });
      box.appendChild(b);
    });
  }

  // --- Cycle de chargement --------------------------------------------------
  let seenIds = [];
  let currentSeries = '';

  async function loadBatch({count=12, reset=false}={}){
    if (reset) { seenIds = []; }
    const first = await fetchAPI(count, seenIds, currentSeries);
    const list  = first && first.length ? first : await fetchLocal(currentSeries);
    // dédoublonne par id
    const uniq = [];
    const seen = new Set(seenIds);
    for (const it of list) { if (!seen.has(it.id)) { seen.add(it.id); uniq.push(it); } }
    if (!uniq.length) return;

    seenIds = Array.from(seen);
    renderCards(uniq);
    renderCloud(uniq);
  }

  // --- Reroll / Form --------------------------------------------------------
  els.rerollBtn && els.rerollBtn.addEventListener('click', (e) => {
    e.preventDefault();
    loadBatch({count: 12, reset: true});
  });

  els.form && els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(els.form);
    currentSeries = (fd.get('series') || '').toString().trim();
    loadBatch({count: 12, reset: true});
  });

  // --- Go -------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    loadBatch({count: 12, reset: true});
  });
})();
