// /public/fun-facts.js
(function () {
  const lang = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2).toLowerCase();
  const N = 9;

  // Conteneur
  let grid = document.querySelector('#facts-grid');
  if (!grid) {
    grid = document.createElement('div');
    grid.id = 'facts-grid';
    grid.className = 'flip-grid';
    const h1 = document.querySelector('main h1, h1') || document.body;
    h1.parentNode.insertBefore(grid, h1.nextSibling);
  }

  // Bouton reroll
  let reroll = document.querySelector('#facts-reroll');
  if (!reroll) {
    reroll = document.createElement('button');
    reroll.id = 'facts-reroll';
    reroll.className = 'btn primary';
    reroll.textContent = label('Nouveau lot aléatoire', 'New random set', 'Neuer Zufallssatz');
    grid.parentNode.insertBefore(reroll, grid);
  }
  reroll.addEventListener('click', () => loadFacts(true));

  function label(fr, en, de) {
    if (lang === 'fr') return fr;
    if (lang === 'de') return de;
    return en;
  }
  const L = {
    myth: label('Mythe', 'Myth', 'Mythos'),
    fact: label('Fait vérifié', 'fact', 'Fakt'),
    flip: label('Retourner', 'Flip', 'Umdrehen'),
    view: label('Voir la source', 'View source', 'Quelle öffnen'),
    fallbackTitle: label('Liste statique (repli)', 'Static list (fallback)', 'Statische Liste (Fallback)'),
    fallbackMsg: label("Si vous voyez ceci, l’API est indisponible. Un repli local s’affiche.",
                       'If you see this, the API is unavailable. Showing a local fallback.',
                       'Wenn du das siehst, ist die API nicht erreichbar. Lokales Fallback wird angezeigt.')
  };

  // ---------- UI helpers ----------
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function makeCard(item){
    const li = document.createElement('div');
    li.className = 'card3d';
    li.tabIndex = 0;

    const inner = document.createElement('div');
    inner.className = 'inner';

    // FRONT = claim
    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div class="ff-head"><span class="chip">${L.myth}</span></div>
      <p class="ff-text ff-claim">${escapeHTML(item.claim)}</p>
      <div class="ff-actions"><button class="btn linkish">${L.flip}</button></div>
    `;

    // BACK = explain + source
    const back = document.createElement('div');
    back.className = 'face back';
    const explain = item.explain ? escapeHTML(item.explain) : '—';
    const src = item.source ? `<a class="ff-link" href="${item.source}" target="_blank" rel="noopener">${L.view}</a>` : '';
    back.innerHTML = `
      <div class="ff-head"><span class="chip">${L.fact}</span></div>
      <p class="ff-text ff-explain">${explain}</p>
      <div class="ff-actions"><button class="btn linkish">${L.flip}</button> ${src}</div>
    `;

    inner.appendChild(front);
    inner.appendChild(back);
    li.appendChild(inner);

    li.addEventListener('click', e => {
      if (e.target.closest('button')) li.classList.toggle('is-flipped');
    });
    li.addEventListener('keypress', e => {
      if (e.key === ' ' || e.key === 'Enter'){ e.preventDefault(); li.classList.toggle('is-flipped'); }
    });

    return li;
  }

  function makeSkeleton(){
    const s = document.createElement('div');
    s.className = 'ff-skel';
    return s;
  }
  function showSkeleton(count){
    grid.replaceChildren();
    for (let i=0;i<count;i++) grid.appendChild(makeSkeleton());
    grid.classList.add('ff-loading');
  }
  function clearSkeleton(){
    grid.classList.remove('ff-loading');
    grid.replaceChildren();
  }
  function showFallback(){
    clearSkeleton();
    const msg = document.createElement('div');
    msg.className = 'card pad';
    msg.innerHTML = `<div class="title">${L.fallbackTitle}</div><p class="muted">${L.fallbackMsg}</p>`;
    grid.appendChild(msg);
  }

  // ---------- Data ----------
  async function loadFacts(withSpinner){
    if (withSpinner){
      reroll.classList.add('is-busy'); reroll.disabled = true;
    }
    showSkeleton(N);
    try{
      const res = await fetch(`/api/facts?lang=${encodeURIComponent(lang)}&n=${N}`, { cache:'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'API error');
      clearSkeleton();
      for (const it of data.items) grid.appendChild(makeCard(it));
    }catch(err){
      showFallback();
    }finally{
      reroll.classList.remove('is-busy'); reroll.disabled = false;
    }
  }

  // init
  loadFacts(false);
})();
