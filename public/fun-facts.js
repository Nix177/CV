// public/fun-facts.js

(() => {
  const grid = document.getElementById('facts-grid');
  const btn = document.getElementById('ff-new');
  const FALLBACK_SEL = '#ff-fallback, .ff-fallback';

  // Déduction langue à partir du nom de fichier
  const path = (location.pathname.split('/').pop() || 'fun-facts.html');
  const m = path.match(/^fun-facts(?:-(en|de))?\.html$/i);
  const lang = m && m[1] ? m[1] : 'fr';

  const t = (k) => {
    const L = {
      fr: { myth:'Mythe', fact:'Fait vérifié', flip:'Retourner', source:'Voir la source', error:'Échec du chargement.' },
      en: { myth:'Myth',  fact:'Verified fact', flip:'Flip',      source:'View source',    error:'Failed to load.' },
      de: { myth:'Mythos',fact:'Geprüfte Tatsache', flip:'Umdrehen', source:'Quelle',     error:'Fehler beim Laden.' }
    };
    return (L[lang]||L.fr)[k];
  };

  function shuffle(arr){
    // Fisher-Yates
    for(let i = arr.length-1; i > 0; i--){
      const j = (crypto?.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0] % (i+1)
        : Math.floor(Math.random()*(i+1)));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function skeleton(n=9){
    grid.classList.add('ff-loading');
    grid.innerHTML = '';
    for(let i=0;i<n;i++){
      const d = document.createElement('div');
      d.className = 'ff-skel';
      grid.appendChild(d);
    }
  }

  function card(node){
    node.addEventListener('click', () => node.classList.toggle('is-flipped'));
    // évite que le clic sur un lien renverse
    node.querySelectorAll('a,button').forEach(el=>{
      el.addEventListener('click', (e)=> e.stopPropagation());
    });
  }

  function render(facts){
    grid.classList.remove('ff-loading');
    grid.innerHTML = '';
    facts.forEach(f => {
      const wrap = document.createElement('div');
      wrap.className = 'card3d';
      wrap.innerHTML = `
        <div class="inner">
          <div class="face front">
            <div class="ff-head">
              <span class="badge">${t('myth')}</span>
            </div>
            <p class="ff-text ff-claim">${f.claim || ''}</p>
            <div class="ff-actions">
              <button class="btn btn-sm">${t('flip')}</button>
            </div>
          </div>
          <div class="face back">
            <div class="ff-head">
              <span class="badge">${t('fact')}</span>
            </div>
            <p class="ff-text ff-explain">${f.explain || ''}</p>
            <div class="ff-actions">
              ${f.source ? `<a class="btn linkish ff-link" href="${f.source}" target="_blank" rel="noopener">${t('source')}</a>` : ''}
              <button class="btn btn-sm">${t('flip')}</button>
            </div>
          </div>
        </div>`;
      grid.appendChild(wrap);
      card(wrap);
    });
  }

  async function load(n=9){
    try{
      btn?.classList.add('is-busy');
      skeleton(n);

      const ts = Date.now();
      const url = `/api/facts?lang=${lang}&n=${n}&t=${ts}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'x-no-cache': String(ts) }
      });

      if(!res.ok) throw new Error('HTTP '+res.status);
      let facts = await res.json();

      // petite sécurité : shuffle côté client
      facts = shuffle(facts.slice(0));

      render(facts);
      // masque le fallback si présent
      document.querySelectorAll(FALLBACK_SEL).forEach(n => n.remove());
    }catch(err){
      grid.classList.remove('ff-loading');
      grid.innerHTML = `<div class="card pad"><strong>${t('error')}</strong></div>`;
      console.error(err);
    }finally{
      btn?.classList.remove('is-busy');
    }
  }

  btn?.addEventListener('click', () => load(9));
  // premier rendu
  load(9);
})();
