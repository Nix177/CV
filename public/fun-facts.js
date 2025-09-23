/* public/fun-facts.js
   Monte les cartes de "Fun Facts" en s'assurant qu'un conteneur existe.
   Zéro dépendance.
*/
(() => {
  const COUNT = 9;

  // i18n minimal (tu peux étendre)
  const I18N = {
    fr: { myth: 'Mythe', fact: 'Fait vérifié', newBatch: 'Nouveau lot aléatoire', seeSource:'Voir la source', flip:'Retourner' },
    en: { myth: 'Myth',  fact: 'Fact checked', newBatch: 'New random set',        seeSource:'See source',   flip:'Flip' },
    de: { myth: 'Mythos',fact: 'Fakt',         newBatch: 'Neuer Zufallssatz',     seeSource:'Quelle',       flip:'Umdrehen' }
  };

  // Lang à partir de l’URL: page.html, page-en.html, page-de.html
  const m = (location.pathname.split('/').pop()||'fun-facts.html').match(/-(en|de)\.html$/i);
  const lang = (m && m[1]) ? m[1] : 'fr';
  const t = I18N[lang] || I18N.fr;

  // --- Helpers --------------------------------------------------------------
  const qs = (sel, ctx=document) => ctx.querySelector(sel);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };

  // Assure la présence du bouton et du conteneur; crée-les sinon.
  function ensureMount() {
    let grid = qs('#facts-grid') || qs('.facts-grid') || qs('#facts') || qs('.flip-grid');
    let btn  = qs('#ff-new');

    if (!grid) {
      console.warn('[fun-facts] Aucun conteneur trouvé. Création de #facts-grid…');
      const mount = qs('main .container') || qs('.container') || document.body;

      const wrap = el('section', 'container section');
      const row  = el('div', 'row gap');

      btn = el('button', 'btn primary', t.newBatch);
      btn.id = 'ff-new';
      row.appendChild(btn);

      grid = el('div', 'flip-grid');
      grid.id = 'facts-grid';
      grid.setAttribute('aria-live', 'polite');

      wrap.appendChild(row);
      wrap.appendChild(grid);
      mount.appendChild(wrap);
    } else {
      // S’il existe mais sans id, normalise pour le CSS/JS
      if (!grid.id) grid.id = 'facts-grid';
    }

    if (!btn) {
      const row = el('div', 'row gap');
      btn = el('button', 'btn primary', t.newBatch);
      btn.id = 'ff-new';
      grid.parentElement.insertBefore(row, grid);
      row.appendChild(btn);
    }

    return { grid, btn };
  }

  // Petit utilitaire anti-cache + vrai aléatoire
  async function getFacts(n) {
    const url = `/api/facts?lang=${lang}&n=${n}&r=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API /api/facts -> ${res.status}`);
    const data = await res.json();
    // Mélange local aussi (au cas où l’API renvoie un ordre stable)
    for (let i = data.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [data[i], data[j]] = [data[j], data[i]];
    }
    return data;
  }

  // Une carte 3D recto/verso
  function makeCard(item) {
    // item: { claim, explain, url }
    const card = el('div', 'card3d');
    const inner = el('div', 'inner');

    const front = el('div', 'face front');
    const headF = el('div', 'ff-head');
    headF.appendChild(el('span', 'badge', t.myth));
    front.appendChild(headF);
    const claim = el('p', 'ff-text ff-claim', item.claim || '—');
    front.appendChild(claim);
    const actF = el('div', 'ff-actions');
    const flipF = el('button', 'btn linkish', t.flip);
    flipF.addEventListener('click', e => { e.stopPropagation(); card.classList.toggle('is-flipped'); });
    actF.appendChild(flipF);
    front.appendChild(actF);

    const back = el('div', 'face back');
    const headB = el('div', 'ff-head');
    headB.appendChild(el('span', 'badge', t.fact));
    back.appendChild(headB);
    const expl = el('p', 'ff-text ff-explain', item.explain || '—');
    back.appendChild(expl);
    const actB = el('div', 'ff-actions');
    if (item.url) {
      const link = el('a', 'btn linkish ff-link', t.seeSource);
      link.href = item.url;
      link.target = '_blank';
      actB.appendChild(link);
    }
    const flipB = el('button', 'btn linkish', t.flip);
    flipB.addEventListener('click', e => { e.stopPropagation(); card.classList.toggle('is-flipped'); });
    actB.appendChild(flipB);
    back.appendChild(actB);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    card.addEventListener('click', () => card.classList.toggle('is-flipped'));

    return card;
  }

  // Skeletons simples pendant le chargement
  function showSkeletons(grid, n) {
    grid.textContent = '';
    for (let i = 0; i < n; i++) {
      const sk = el('div', 'ff-skel');
      grid.appendChild(sk);
    }
    grid.classList.add('ff-loading');
  }
  function clearSkeletons(grid) {
    grid.classList.remove('ff-loading');
    [...grid.querySelectorAll('.ff-skel')].forEach(x => x.remove());
  }

  // Charge un lot et (re)rend
  async function load(grid, n = COUNT) {
    showSkeletons(grid, n);
    try {
      const facts = await getFacts(n);
      clearSkeletons(grid);
      grid.textContent = '';
      facts.forEach(item => grid.appendChild(makeCard(item)));
    } catch (e) {
      console.error(e);
      clearSkeletons(grid);
      grid.textContent = '';
      const err = el('div', 'card pad');
      err.textContent = 'API indisponible.';
      grid.appendChild(err);
    }
  }

  // Boot
  document.addEventListener('DOMContentLoaded', () => {
    const { grid, btn } = ensureMount();
    load(grid, COUNT);
    btn.addEventListener('click', () => load(grid, COUNT));
  });
})();
