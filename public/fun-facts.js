<!-- public/fun-facts.js -->
<script>
/* public/fun-facts.js — Fun Facts (FR/EN/DE)
   - Consomme /api/facts?lang=xx&n=9  (réponse { items:[...] })
   - Fallback tolérant si jamais la forme évolue.
   - Cartes recto/verso, verso ≤ ~30 mots, bouton “Nouveau lot”.
*/
(() => {
  const COUNT = 9;

  const I18N = {
    fr: { myth:'Mythe', fact:'Fait vérifié', newBatch:'Nouveau lot aléatoire', seeSource:'Voir la source', flip:'Retourner', empty:'Aucune carte.' },
    en: { myth:'Myth',  fact:'Fact',         newBatch:'New random batch',       seeSource:'See source',    flip:'Flip',      empty:'No cards.' },
    de: { myth:'Mythos',fact:'Fakt',         newBatch:'Neuer Zufallssatz',      seeSource:'Quelle',        flip:'Umdrehen',  empty:'Keine Karten.' },
  };

  // Lang depuis l’URL (fun-facts[-en|-de].html)
  const m = (location.pathname.split('/').pop() || 'fun-facts.html').match(/-(en|de)\.html$/i);
  const lang = (m && m[1]) ? m[1] : 'fr';
  const t = I18N[lang] || I18N.fr;

  // ---------- utils
  const qs = (s, r=document) => r.querySelector(s);
  const el = (tag, cls, txt) => { const n=document.createElement(tag); if(cls) n.className=cls; if(txt!=null) n.textContent=txt; return n; };
  const esc = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const words = s => String(s||'').trim().split(/\s+/).filter(Boolean);
  const trimWords = (s, max=30) => { const w=words(s); return w.length<=max ? s : w.slice(0,max).join(' ')+'…'; };

  // Monte (ou crée) le conteneur + bouton
  function ensureMount(){
    let grid = qs('#facts-grid') || qs('.facts-grid') || qs('#facts') || qs('.flip-grid');
    let btn  = qs('#ff-new') || qs('#ff_random') || qs('#btnNewSet');

    if (!grid) {
      console.warn('[fun-facts] Aucun conteneur trouvé. Création de #facts-grid…');
      const mount = qs('main .container') || qs('.container') || document.body;
      const wrap  = el('section','container section');
      const row   = el('div','row gap');
      btn = el('button','btn primary',t.newBatch); btn.id='ff-new';
      row.appendChild(btn);
      grid = el('div','flip-grid'); grid.id='facts-grid'; grid.setAttribute('aria-live','polite');
      wrap.appendChild(row); wrap.appendChild(grid); mount.appendChild(wrap);
    } else {
      if (!grid.id) grid.id = 'facts-grid';
      if (!btn) {
        const row = el('div','row gap');
        btn = el('button','btn primary',t.newBatch); btn.id='ff-new';
        grid.parentElement.insertBefore(row, grid);
        row.appendChild(btn);
      }
    }
    return { grid, btn };
  }

  // Fetch API -> retourne TOUJOURS un tableau d’items
  async function getFacts(n){
    const url = `/api/facts?lang=${encodeURIComponent(lang)}&n=${n}&r=${Date.now()}`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error(`API /api/facts -> ${r.status}`);
    const data = await r.json();
    const items = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    // petit shuffle local
    for (let i=items.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [items[i],items[j]]=[items[j],items[i]]; }
    return items;
  }

  function pickSrc(x){
    if (!x) return null;
    if (typeof x === 'string') return { href:x, label:t.seeSource };
    return { href: x.href || x.url || x.link || '', label: x.label || x.title || t.seeSource };
  }

  // Une carte 3D recto/verso
  function makeCard(it){
    const card  = el('div','card3d');
    const inner = el('div','inner');
    const front = el('div','face front');
    const back  = el('div','face back');

    // tag
    const headF = el('div','ff-head');
    headF.appendChild(el('span','badge',t.myth));  // la source actuelle crée des mythes
    front.appendChild(headF);

    // recto = titre (idée reçue)
    const title = it.title || it.claim || '—';
    const h3 = el('h3','h3'); h3.textContent = title;
    front.appendChild(h3);

    // actions recto
    const actF = el('div','ff-actions');
    const flipF = el('button','btn flip',t.flip);
    actF.appendChild(flipF);
    const s0 = pickSrc(it.sources && it.sources[0]);
    if (s0 && s0.href) {
      const a = el('a','btn linkish',t.seeSource); a.target='_blank'; a.rel='noopener'; a.href=s0.href; actF.appendChild(a);
    }
    front.appendChild(actF);

    // verso = explication courte (≤ 30 mots)
    const explain = trimWords(it.explainShort || it.explanation || '', 30);
    const p = el('p','ff-text'); p.textContent = explain || '—';
    back.appendChild(p);

    // actions verso
    const actB = el('div','ff-actions');
    const flipB = el('button','btn flip',t.flip);
    actB.appendChild(flipB);
    if (s0 && s0.href) {
      const a2 = el('a','btn linkish',t.seeSource); a2.target='_blank'; a2.rel='noopener'; a2.href=s0.href; actB.appendChild(a2);
    }
    back.appendChild(actB);

    inner.appendChild(front); inner.appendChild(back);
    card.appendChild(inner);

    // flip
    card.addEventListener('click', (e)=>{
      if (e.target.closest('a')) return;
      if (e.target.closest('.flip') || e.target.closest('.front') || e.target.closest('.back')) {
        inner.style.transform = inner.style.transform ? '' : 'rotateY(180deg)';
      }
    });

    return card;
  }

  function render(grid, items){
    grid.innerHTML = '';
    if (!Array.isArray(items) || !items.length){
      grid.appendChild(el('p','muted',t.empty));
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => frag.appendChild(makeCard(it)));
    grid.appendChild(frag);
  }

  async function load(){
    const { grid, btn } = ensureMount();
    try {
      btn && (btn.classList.add('is-busy'));
      const facts = await getFacts(COUNT);
      render(grid, facts);
    } catch (e) {
      console.error('[fun-facts]', e);
      render(ensureMount().grid, []); // message “Aucune carte.”
    } finally {
      btn && (btn.classList.remove('is-busy'));
      const root = qs('#ff_root'); if (root) root.classList.add('ff-ready');
    }
  }

  // init
  const { grid, btn } = ensureMount();
  if (btn) btn.addEventListener('click', load);
  load();
})();
</script>
