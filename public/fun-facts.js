// public/fun-facts.js
(function () {
  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  onReady(() => {
    // --- Sélection robuste du conteneur & du bouton
    const grid =
      document.querySelector('#facts-grid') ||
      document.querySelector('.facts-grid') ||
      document.querySelector('#facts') ||
      document.querySelector('.flip-grid');

    const btn =
      document.querySelector('#ff-new') ||
      document.querySelector('[data-role="ff-new"]') ||
      document.querySelector('#facts-new');

    if (!grid) {
      console.error(
        '[fun-facts] Aucun conteneur trouvé. Ajoute id="facts-grid" sur le bloc qui doit recevoir les cartes.'
      );
      return;
    }

    // --- Langue depuis l’URL
    const path = (location.pathname.split('/').pop() || 'fun-facts.html');
    const m = path.match(/^fun-facts(?:-(en|de))?\.html$/i);
    const lang = m && m[1] ? m[1] : 'fr';

    const i18n = {
      fr: { myth:'Mythe', fact:'Fait vérifié', flip:'Retourner', source:'Voir la source', error:'Échec du chargement.' },
      en: { myth:'Myth',  fact:'Verified fact', flip:'Flip',      source:'View source',   error:'Failed to load.' },
      de: { myth:'Mythos',fact:'Geprüfte Tatsache', flip:'Umdrehen', source:'Quelle',     error:'Fehler beim Laden.' }
    };
    const t = (k) => (i18n[lang] || i18n.fr)[k];

    // --- Utils
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function skeleton(n = 9) {
      grid.classList.add('ff-loading');
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const d = document.createElement('div');
        d.className = 'ff-skel';
        frag.appendChild(d);
      }
      grid.appendChild(frag);
    }

    function wireCard(node) {
      node.addEventListener('click', () => node.classList.toggle('is-flipped'));
      node.querySelectorAll('a,button').forEach(el =>
        el.addEventListener('click', (e) => e.stopPropagation())
      );
    }

    function render(items) {
      grid.classList.remove('ff-loading');
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();

      items.forEach(f => {
        const wrap = document.createElement('div');
        wrap.className = 'card3d';
        wrap.innerHTML = `
          <div class="inner">
            <div class="face front">
              <div class="ff-head"><span class="badge">${t('myth')}</span></div>
              <p class="ff-text ff-claim">${f.claim || ''}</p>
              <div class="ff-actions"><button class="btn btn-sm">${t('flip')}</button></div>
            </div>
            <div class="face back">
              <div class="ff-head"><span class="badge">${t('fact')}</span></div>
              <p class="ff-text ff-explain">${f.explain || ''}</p>
              <div class="ff-actions">
                ${f.source ? `<a class="btn linkish ff-link" href="${f.source}" target="_blank" rel="noopener">${t('source')}</a>` : ''}
                <button class="btn btn-sm">${t('flip')}</button>
              </div>
            </div>
          </div>`;
        frag.appendChild(wrap);
      });

      grid.appendChild(frag);
      grid.querySelectorAll('.card3d').forEach(wireCard);
      // Si un fallback statique existe encore dans le HTML, on le retire
      document.querySelectorAll('#ff-fallback, .ff-fallback').forEach(n => n.remove());
    }

    async function load(n = 9) {
      try {
        if (btn) btn.classList.add('is-busy');
        skeleton(n);

        const ts = Date.now(); // cache-buster pour éviter un lot identique
        const url = `/api/facts?lang=${lang}&n=${n}&t=${ts}`;

        const res = await fetch(url, { cache: 'no-store', headers: { 'x-no-cache': String(ts) } });
        if (!res.ok) throw new Error('HTTP ' + res.status);

        let facts = await res.json();
        facts = shuffle(facts.slice()); // ordre varié côté client
        render(facts);
      } catch (err) {
        console.error('[fun-facts] load error:', err);
        grid.classList.remove('ff-loading');
        grid.innerHTML = `<div class="card pad"><strong>${t('error')}</strong></div>`;
      } finally {
        if (btn) btn.classList.remove('is-busy');
      }
    }

    if (btn) btn.addEventListener('click', () => load(9));
    load(9);
  });
})();
