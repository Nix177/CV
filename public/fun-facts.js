/* Fun Facts – client
   - Utilise d’abord l’API ; si 0 item → fallback JSON local
   - Face avant: titre seul (stoppe le doublon)
   - Dos de carte: explication courte propre à la carte + sources
*/

(function () {
  const log  = (...a) => console.log('[fun-facts]', ...a);
  const warn = (...a) => console.warn('[fun-facts]', ...a);
  const $    = (sel, el = document) => el.querySelector(sel);
  const $$   = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const lang = (document.documentElement.lang || 'fr').slice(0, 2);

  // -------- Fetch helpers ---------------------------------------------------
  async function fetchAPI(n, seenIds) {
    const seen = (seenIds && seenIds.length) ? `&seen=${encodeURIComponent(seenIds.join(','))}` : '';
    const url = `/api/facts?lang=${lang}&n=${n}${seen}`;
    log('Fetch API:', url);
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const arr = await r.json();
      log('→ API items:', Array.isArray(arr) ? arr.length : 0);
      if (!Array.isArray(arr) || arr.length === 0) return null; // 0 = échec
      return arr.map(normalize);
    } catch (e) {
      warn('API fail:', e.message || e);
      return null;
    }
  }

  async function fetchLocal() {
    const url = '/facts-data.json';
    log('Fetch JSON local:', url);
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const raw = await r.json();
      const items = Array.isArray(raw) ? raw : (raw.items || []);
      const filtered = items.filter(x => (x.lang ? x.lang.slice(0,2) === lang : true));
      log('→ JSON local items:', filtered.length);
      return filtered.map(normalize);
    } catch (e) {
      warn('Local JSON fail:', e.message || e);
      return [];
    }
  }

  // -------- Normalisation (multi-schémas) ----------------------------------
  function firstNonEmpty(...xs){ for(const x of xs){ if(x!=null && String(x).trim()) return String(x); } return ''; }
  function stripHtml(s){ const d=document.createElement('div'); d.innerHTML=s; return d.textContent||d.innerText||''; }
  function truncateWords(s, maxW){ const w=(s||'').split(/\s+/).filter(Boolean); return (w.length<=maxW)?s:w.slice(0,maxW).join(' ')+'…'; }

  function normalize(o) {
    const id    = o.id || o.slug || `${(o.type || 'item')}-${Math.random().toString(36).slice(2, 8)}`;
    const type  = (o.type || o.kind || '').toLowerCase().includes('myth') ? 'myth'
                : (o.type || o.kind || '').toLowerCase().includes('fact') ? 'fact'
                : (o.answer === true ? 'fact' : o.answer === false ? 'myth' : 'unknown');
    const category = o.category || o.domain || o.topic || o.tag || '';
    const title    = o.title || o.claim || o.statement || o.question || '—';

    // FRONT (évite le doublon → pas de re-titre en description)
    const teaser   = ''; // on force vide pour ne pas répéter le titre

    // BACK (explication courte propre à l’item)
    const bodyLong = firstNonEmpty(o.body, o.explanation, o.explain, o.answer, '');
    const back     = truncateWords(stripHtml(bodyLong), 40) ||
                     (type === 'myth'
                        ? 'Mythe réfuté : voir sources pour le détail.'
                        : type === 'fact'
                        ? 'Fait avéré : voir sources pour le détail.'
                        : 'Explication indisponible.');

    const sources  = []
      .concat(o.sources || o.refs || [])
      .map(s => typeof s === 'string' ? { href: s, label: s.replace(/^https?:\/\//,'').slice(0,80) }
                                      : { href: s.href || s.url, label: s.label || (s.url||'').replace(/^https?:\/\//,'').slice(0,80) })
      .filter(s => s && s.href);

    return { id, type, category, title, teaser, back, sources };
  }

  // -------- Rendu -----------------------------------------------------------
  function cardNode(item){
    const el = document.createElement('article');
    el.className = `ff-card ${item.type}`;
    el.innerHTML = `
      <div class="ff-front">
        <div class="ff-meta"><span class="ff-type">${item.type==='myth'?'❓ Mythe':'⭐ Fait avéré'}</span><span class="ff-cat">${item.category||''}</span></div>
        <h3 class="ff-title">${escapeHtml(item.title)}</h3>
        ${item.teaser ? `<p class="ff-teaser">${escapeHtml(item.teaser)}</p>` : ''}
      </div>
      <div class="ff-back">
        <p class="ff-explain">${escapeHtml(item.back)}</p>
        ${item.sources && item.sources.length ? `<ul class="ff-sources">${
          item.sources.slice(0,4).map(s=>`<li><a href="${escapeAttr(s.href)}" target="_blank" rel="noopener">${escapeHtml(s.label||s.href)}</a></li>`).join('')
        }</ul>` : ''}
      </div>`;
    el.addEventListener('click', ()=> el.classList.toggle('flipped'));
    return el;
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
  function escapeAttr(s){return String(s).replace(/"/g,'&quot;')}

  // -------- Init ------------------------------------------------------------
  (async function init(){
    const root = $('#ff-grid') || document.body;
    const first = await fetchAPI(8, []);
    const items0 = first || await fetchLocal();
    items0.forEach(it => root.appendChild(cardNode(it)));

    const seen = items0.map(x=>x.id);
    const more = await fetchAPI(18, seen) || await fetchLocal();
    // on mélange un peu et on garde 14 pour le nuage/complément visuel si tu en as un
    more.sort(()=>Math.random()-0.5).slice(0,14).forEach(it => root.appendChild(cardNode(it)));
  })();
})();
