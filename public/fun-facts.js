<script>
/* Fun Facts — front app
   - fetch /api/facts?lang=fr|en|de&n=9&seen=...
   - fallback sur /facts-data.json si l’API échoue
   - cartes recto/verso (verso ≤ 30 mots), bouton "Nouveau lot"
*/
(() => {
  const lang = (document.documentElement.lang || 'fr').toLowerCase();
  const COUNT = 9;

  const T = {
    fr: {
      myth: 'Mythe',
      fact: 'Fait vérifié',
      flip: 'Retourner',
      seeSrc: 'Voir la source',
      newBatch: 'Nouveau lot aléatoire',
      empty: 'Aucune carte à afficher.',
    },
    en: {
      myth: 'Myth',
      fact: 'Fact',
      flip: 'Flip',
      seeSrc: 'View source',
      newBatch: 'New random batch',
      empty: 'No cards to display.',
    },
    de: {
      myth: 'Irrtum',
      fact: 'Fakt',
      flip: 'Umdrehen',
      seeSrc: 'Quelle ansehen',
      newBatch: 'Neues Zufallsset',
      empty: 'Keine Karten anzuzeigen.',
    },
  }[lang] || T_fr();

  function T_fr() { return T.fr; }

  const $cards = document.querySelector('#ff_cards') || createCardsMount();
  const $btnNew = document.querySelector('#ff_random') || document.querySelector('#btnNewSet');
  const seen = new Set();

  if ($btnNew) $btnNew.addEventListener('click', loadNewBatch);

  // Auto-charge au démarrage
  loadNewBatch();

  // ---------- Helpers ----------
  function createCardsMount(){
    const el = document.createElement('div');
    el.id = 'ff_cards';
    document.body.appendChild(el);
    return el;
  }

  function truncateWords(s, n = 30){
    if (!s) return '';
    const words = String(s).replace(/\s+/g,' ').trim().split(' ');
    return words.length <= n ? s : words.slice(0, n).join(' ') + '…';
  }

  function pickSource(sources){
    if (Array.isArray(sources) && sources.length) return sources[0];
    if (typeof sources === 'string') return sources;
    return null;
  }

  function toId(x){
    if (x?.id) return String(x.id);
    const h = (x?.title || Math.random().toString(36)).toLowerCase().replace(/\s+/g,'-').slice(0,50);
    return `${h}-${Math.random().toString(36).slice(2,7)}`;
  }

  // Normalise la forme renvoyée par /api/facts (ou fallback)
  function normalizeItem(x){
    const id = toId(x);
    const title = x.title || x.text || '—';
    const explanation = x.explanation || x.explainShort || x.answer || '';
    const explainShort = x.explainShort || truncateWords(explanation, 30);
    const category = x.category || 'general';
    const type = x.type || 'myth';
    const sources = x.sources || x.source || [];
    return { id, title, explanation, explainShort, category, type, sources: Array.isArray(sources)?sources:(sources?[sources]:[]) };
  }

  async function fetchFacts(n){
    const seenList = [...seen].join(',');
    const u = `/api/facts?lang=${encodeURIComponent(lang)}&n=${n}${seenList ? `&seen=${encodeURIComponent(seenList)}`:''}`;
    try{
      const ctrl = new AbortController();
      const to = setTimeout(()=>ctrl.abort(), 9000);
      const r = await fetch(u, { signal: ctrl.signal, headers:{ 'x-ff': '1' }});
      clearTimeout(to);
      if (!r.ok) throw new Error('API facts non OK');
      const data = await r.json();
      if (!Array.isArray(data?.items)) throw new Error('API format inattendu');
      return data.items.map(normalizeItem);
    }catch(e){
      // Fallback local
      try{
        const r = await fetch('/facts-data.json');
        if (!r.ok) throw new Error('fallback non trouvé');
        const all = await r.json();
        // Filtre ceux déjà vus
        const pool = (Array.isArray(all)?all:all?.items||[])
          .filter(x => !seen.has(toId(x)));
        // Mélange simple
        for (let i=pool.length-1;i>0;i--){
          const j = Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]];
        }
        return pool.slice(0, n).map(normalizeItem);
      }catch(err){
        console.error('[FunFacts] fallback KO', err);
        return [];
      }
    }
  }

  function render(items){
    $cards.innerHTML = '';
    if (!items.length){
      const p = document.createElement('p'); p.textContent = T.empty; p.className='muted';
      $cards.appendChild(p); return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(item => {
      const src = pickSource(item.sources);
      const root = document.createElement('article');
      root.className = 'ff-card';
      root.setAttribute('data-id', item.id);

      root.innerHTML = `
        <div class="ff-tags">
          <span class="ff-badge">${ item.type === 'fact' ? T.fact : T.myth }</span>
        </div>
        <div class="ff-face ff-front">
          <h3 class="ff-title">${escapeHTML(item.title)}</h3>
          <div class="ff-actions">
            <button class="btn flip">${T.flip}</button>
            ${ src ? `<a class="btn linkish" target="_blank" rel="noopener" href="${escapeAttr(src)}">${T.seeSrc}</a>` : '' }
          </div>
        </div>
        <div class="ff-face ff-back">
          <p class="ff-explain">${escapeHTML(item.explainShort || item.explanation || '')}</p>
          <div class="ff-actions">
            <button class="btn flip">${T.flip}</button>
            ${ src ? `<a class="btn linkish" target="_blank" rel="noopener" href="${escapeAttr(src)}">${T.seeSrc}</a>` : '' }
          </div>
        </div>
      `;

      root.addEventListener('click', e => {
        const tgt = e.target;
        if (tgt.closest('a')) return; // laisse les liens tranquilles
        if (tgt.closest('.flip') || tgt.closest('.ff-front') || tgt.closest('.ff-back')){
          root.classList.toggle('is-flipped');
        }
      });

      frag.appendChild(root);
    });
    $cards.appendChild(frag);
  }

  async function loadNewBatch(){
    const items = await fetchFacts(COUNT);
    // Marque les IDs affichés pour éviter de les re-proposer immédiatement
    items.forEach(it => seen.add(it.id));
    render(items);
  }

  // --- utils sûres ---
  function escapeHTML(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#39;');
  }
  function escapeAttr(s){ return escapeHTML(s).replace(/"/g, '&quot;'); }
})();
</script>
