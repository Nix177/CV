/* =========================================================
   Fun Facts — client unique (FR/EN/DE)
   - GET /api/ff-batch?lang=fr|en|de&count=9&seen=<csv>
   - Fallback: /facts-data.json si 0 item
   - Cartes recto/verso (verso ≤ 30 mots) + bouton "Nouveau lot"
   ========================================================= */
(function () {
  const log  = (...a) => console.log('[fun-facts]', ...a);
  const warn = (...a) => console.warn('[fun-facts]', ...a);
  const $    = (sel, el = document) => el.querySelector(sel);
  const $$   = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const lang = (document.documentElement.lang || 'fr').slice(0, 2).toLowerCase();

  const L10N = {
    fr: { myth:'Mythe', fact:'Fait vérifié', flip:'Retourner', source:'Voir la source', newBatch:'🎲 Nouveau lot aléatoire', empty:'Aucune carte à afficher.' },
    en: { myth:'Myth',  fact:'Fact',         flip:'Flip',      source:'View source',     newBatch:'🎲 New random batch',   empty:'No cards to display.' },
    de: { myth:'Irrtum',fact:'Fakt',         flip:'Umdrehen',  source:'Quelle ansehen',  newBatch:'🎲 Neues Zufallsset',   empty:'Keine Karten anzuzeigen.' }
  };
  const T = L10N[lang] || L10N.fr;

  // points d'accroche de ta page
  const $cards   = $('#ff_cards') || (() => { const d=document.createElement('div'); d.id='ff_cards'; document.body.appendChild(d); return d; })();
  const $btnNew  = $('#ff_random');
  const $fallback= $('#ff_fallback_list');
  const $count   = $('#ff_count');

  const seen = new Set();

  if ($btnNew) $btnNew.addEventListener('click', e => { e.preventDefault(); loadNewBatch(); });
  loadNewBatch(); // au démarrage

  // ---------- helpers ----------
  function truncateWords(s, n = 30){
    if (!s) return '';
    const words = String(s).replace(/\s+/g,' ').trim().split(' ');
    return words.length <= n ? s : words.slice(0, n).join(' ') + '…';
  }
  function pickSource(sources){
    if (Array.isArray(sources) && sources.length) {
      const s = sources[0];
      return { title: s.title || s.label || 'Source', url: s.url || s.href || '#' };
    }
    if (typeof sources === 'string') return { title: 'Source', url: sources };
    return null;
  }
  function normalize(x){
    const id = x.id || Math.random().toString(36).slice(2);
    const title = x.title || x.text || '—';
    const explanation = x.explanation || x.truth || '';
    const explainShort = x.explainShort || truncateWords(explanation, 30);
    const type = (x.type || '').toLowerCase().includes('fact') ? 'fact' : 'myth';
    const source = pickSource(x.sources || x.source);
    return { id, title, explanation, explainShort, type, source };
  }
  function renderCards(items){
    $cards.innerHTML = '';
    if (!items.length){
      $cards.innerHTML = `<p class="muted">${T.empty}</p>`;
      return;
    }
    const frag = document.createDocumentFragment();
    for (const it of items) {
      seen.add(it.id);
      const card = document.createElement('div');
      card.className = 'ff-card';
      card.innerHTML = `
        <div class="inner">
          <div class="face front">
            <div class="ff-badges">
              <span class="ff-badge">${it.type === 'fact' ? T.fact : T.myth}</span>
            </div>
            <h3 style="margin:6px 0 0 0">${it.title}</h3>
            <div class="ff-actions" style="margin-top:auto;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn chip ff-flip">${T.flip}</button>
              ${it.source ? `<a class="btn chip" target="_blank" rel="noopener" href="${it.source.url}">${T.source}</a>` : ''}
            </div>
          </div>
          <div class="face back">
            <p class="muted" style="margin:0 0 6px 0">${it.type === 'fact' ? T.fact : T.myth}</p>
            <p style="margin:0">${truncateWords(it.explainShort || it.explanation || it.title, 30)}</p>
            <div class="ff-actions" style="margin-top:auto;display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn chip ff-flip">${T.flip}</button>
              ${it.source ? `<a class="btn chip" target="_blank" rel="noopener" href="${it.source.url}">${T.source}</a>` : ''}
            </div>
          </div>
        </div>`;
      card.addEventListener('click', e => {
        const b = e.target.closest('.ff-flip');
        if (b) { card.classList.toggle('is-flipped'); e.preventDefault(); e.stopPropagation(); }
      });
      frag.appendChild(card);
    }
    $cards.appendChild(frag);
    if ($count) $count.textContent = `${items.length} cards`;
  }

  // ---------- data loaders ----------
  async function fetchAPI(n=9){
    const seenCsv = [...seen].join(',');
    const url = `/api/ff-batch?lang=${lang}&count=${n}${seenCsv ? `&seen=${encodeURIComponent(seenCsv)}`:''}`;
    log('fetch', url);
    try {
      const r = await fetch(url, { cache:'no-cache' });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const json = await r.json();
      // Accepte tableau ou {items:[...]}
      const arr = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
      return arr.map(normalize);
    } catch (e) {
      warn('API fail:', e.message || e);
      return null;
    }
  }
  async function fetchFallback(){
    try {
      const r = await fetch('/facts-data.json', { cache:'no-cache' });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const raw = await r.json();
      const arr = Array.isArray(raw) ? raw : (raw.items || []);
      return arr.filter(x => !x.lang || x.lang.slice(0,2) === lang).map(normalize);
    } catch (e) {
      warn('fallback fail:', e.message || e);
      return [];
    }
  }

  async function loadNewBatch(){
    const api = await fetchAPI(9);
    if (api && api.length) {
      renderCards(api);
      if ($fallback) $fallback.parentElement?.classList?.add('hidden');
      return;
    }
    const loc = await fetchFallback();
    renderCards(loc.slice(0, 9));
    if ($fallback) {
      // affiche la liste brute minimaliste pour info (même si on a rendu des cartes)
      $fallback.innerHTML = loc.slice(0,9).map(x=>`<li>${x.title}</li>`).join('');
      $fallback.parentElement?.classList?.remove('hidden');
    }
  }
})();
