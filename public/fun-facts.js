/* Fun Facts – client
   Corrige:
   - fallback API->JSON si 0 item
   - supprime les doublons de texte sur la face avant
   - dos des cartes: explanation courte par carte + sources
*/

(function () {
  const log = (...a) => console.log('[fun-facts]', ...a);
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const lang = (document.documentElement.lang || 'fr').slice(0, 2);

  // ---- Fetch helpers -------------------------------------------------------
  async function fetchAPI(n, seenIds) {
    const seen = (seenIds && seenIds.length) ? `&seen=${encodeURIComponent(seenIds.join(','))}` : '';
    const url = `/api/facts?lang=${lang}&n=${n}${seen}`;
    log('Fetch API:', url);
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const arr = await r.json();
      log('→ API items:', Array.isArray(arr) ? arr.length : 0);
      // Considérer 0 comme un échec pour forcer le fallback
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr.map(normalize);
    } catch (e) {
      log('API fail:', e.message || e);
      return null;
    }
  }

  async function fetchLocal() {
    const url = '/facts-data.json';
    log('Fetch JSON local:', url);
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const raw = await r.json();
    const items = Array.isArray(raw) ? raw : (raw.items || []);
    const filtered = items.filter(x => (x.lang ? x.lang.slice(0, 2) === lang : true));
    log('→ JSON local items:', filtered.length);
    return filtered.map(normalize);
  }

  // ---- Normalisation robuste (supporte plusieurs schémas) ------------------
  function normalize(o) {
    const id = o.id || o.slug || `${(o.type || 'item')}-${Math.random().toString(36).slice(2, 8)}`;
    const type = (o.type || o.kind || '').toLowerCase().includes('myth') ? 'myth'
               : (o.type || o.kind || '').toLowerCase().includes('fact') ? 'fact'
               : (o.answer === true ? 'fact' : o.answer === false ? 'myth' : 'unknown');

    const category = o.category || o.domain || o.topic || o.tag || '';
    const title = o.title || o.claim || o.statement || o.question || '—';
    // Face avant: on évite le doublon. On affiche un teaser s’il existe,
    // sinon rien (plutôt que de répéter le titre).
    const teaser = firstNonEmpty(
      o.teaser, o.subtitle, o.summary, o.lead, o.front, ''
    );

    // Face arrière: courte explication propre à la carte
    let explainShort = firstNonEmpty(
      o.explainShort, o.explanationShort, o.answerShort, o.short, o.back
    );
    const explanation = firstNonEmpty(o.explanation, o.explain, o.answer, o.rationale, '');

    if (!explainShort && explanation) {
      explainShort = truncateWords(stripHtml(String(explanation)), 30);
    }

    // Sources: tableaux de strings ou {label,url}
    let sources = [];
    if (Array.isArray(o.sources)) {
      sources = o.sources.map(s => {
        if (typeof s === 'string') return { label: s.replace(/^https?:\/\//, ''), url: s };
        return { label: s.label || s.title || (s.url || '').replace(/^https?:\/\//, ''), url: s.url || s.href || '' };
      });
    }

    return { id, type, category, title, teaser, explainShort, explanation, sources };
  }

  function firstNonEmpty(...vals) {
    for (const v of vals) {
      if (v === 0) return 0;
      if (v && String(v).trim()) return v;
    }
    return '';
  }
  function truncateWords(str, n) {
    const w = String(str).split(/\s+/);
    return w.length > n ? w.slice(0, n).join(' ') + '…' : str;
  }
  function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ''); }
  function esc(s) { return String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  // ---- Rendu des cartes ----------------------------------------------------
  const rootCards = $('#cards');
  const seen = new Set();

  function verdictText(t) {
    if (t === 'fact') return 'Fait avéré';
    if (t === 'myth') return 'Mythe réfuté';
    return 'À vérifier';
    }

  function cardHTML(it) {
    // Pas de doublon: on n’injecte PAS le titre dans .body si aucune accroche
    const frontBody = it.teaser ? `<p class="body">${esc(it.teaser)}</p>` : '';
    const backBody = (it.explainShort || it.explanation)
      ? `<p class="body">${esc(it.explainShort || it.explanation)}</p>` : '';

    const src = (it.sources && it.sources.length)
      ? `<div class="sources"><ul>${
            it.sources.map(s => s.url
              ? `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label || s.url)}</a></li>`
              : `<li>${esc(s.label)}</li>`).join('')
          }</ul></div>`
      : '';

    return `
      <article class="ff-card" data-id="${esc(it.id)}">
        <div class="inner">
          <div class="ff-face front">
            <div class="type ${esc(it.type)}">
              <span class="badge">${it.category ? esc(it.category) : ''}</span>
              ${esc(it.type === 'myth' ? 'Mythe' : it.type === 'fact' ? 'Fait avéré' : 'À vérifier')}
            </div>
            <div class="title">${esc(it.title)}</div>
            ${frontBody}
            <div class="card-actions">
              <button class="btn ghost flip" type="button" aria-label="Retourner">↩︎ Retourner</button>
            </div>
          </div>

          <div class="ff-face back">
            <div class="type ${esc(it.type)}">${esc(verdictText(it.type))}</div>
            <div class="title">${esc(it.title)}</div>
            ${backBody}
            ${src}
            <div class="card-actions">
              <button class="btn ghost flip" type="button" aria-label="Retourner">↩︎ Revenir</button>
            </div>
          </div>
        </div>
      </article>`;
  }

  function renderCards(list) {
    rootCards.innerHTML = list.map(cardHTML).join('');
    // flip
    $$('.ff-card .flip', rootCards).forEach(btn => {
      btn.addEventListener('click', () => btn.closest('.ff-card').classList.toggle('flipped'));
    });
  }

  // ---- Nuage ---------------------------------------------------------------
  const rootCloud = $('#cloud');
  const tip = (() => {
    const t = document.createElement('div');
    t.id = 'ffTooltip';
    document.body.appendChild(t);
    return t;
  })();

  function bubbleTipHTML(it) {
    const src = (it.sources && it.sources.length)
      ? `<div class="sources"><ul>${
            it.sources.slice(0,3).map(s => s.url
              ? `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label || s.url)}</a></li>`
              : `<li>${esc(s.label)}</li>`).join('')
          }</ul></div>`
      : '';
    const short = it.explainShort || truncateWords(stripHtml(it.explanation || ''), 30) || '—';
    return `
      <h4>${esc(it.title)}</h4>
      <div class="meta"><span class="badge">${it.category ? esc(it.category) : ''}</span> ${esc(verdictText(it.type))}</div>
      <p>${esc(short)}</p>
      ${src}
    `;
  }

  function renderCloud(list) {
    rootCloud.innerHTML = '';
    const box = rootCloud.getBoundingClientRect();
    const W = Math.max(box.width, 600), H = Math.max(box.height, 360);

    list.forEach((it, i) => {
      const b = document.createElement('div');
      b.className = 'bubble';
      const size = 90 + Math.round(Math.random()*80);
      b.style.width = b.style.height = `${size}px`;
      b.style.left = Math.round(Math.random()*(W - size)) + 'px';
      b.style.top  = Math.round(Math.random()*(H - size)) + 'px';
      b.innerHTML = `<span class="emoji">${it.type==='fact'?'✅':it.type==='myth'?'❌':'❔'}</span>
                     <span class="label">${esc(truncateWords(it.title, 5))}</span>`;
      b.addEventListener('mouseenter', (e) => showTip(e, it));
      b.addEventListener('mousemove', (e) => moveTip(e));
      b.addEventListener('mouseleave', hideTip);
      b.addEventListener('click', (e) => showTip(e, it));
      rootCloud.appendChild(b);
    });
  }
  function showTip(e, it){ tip.innerHTML = bubbleTipHTML(it); tip.style.display='block'; moveTip(e); }
  function moveTip(e){
    const pad = 12, vw = window.innerWidth, vh = window.innerHeight;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + pad, y = e.clientY + pad;
    if (x + r.width > vw) x = vw - r.width - pad;
    if (y + r.height > vh) y = vh - r.height - pad;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip(){ tip.style.display='none'; }

  // ---- Jeu de données courant + commandes ----------------------------------
  let DATA = [];          // pool (API ou JSON)
  let CURRENT = [];       // cartes visibles
  const N_INIT = 8;

  async function ensureData() {
    // 1) tenter l’API ; si 0 → JSON local
    const byApi = await fetchAPI(32, Array.from(seen));
    DATA = byApi && byApi.length ? byApi : await fetchLocal();
  }

  async function loadInitial() {
    await ensureData();
    CURRENT = pickRandom(DATA, N_INIT);
    CURRENT.forEach(x => seen.add(x.id));
    log('Cartes initiales:', CURRENT.length);
    renderCards(CURRENT);
    renderCloud(pickRandom(DATA, 14));
    wireControls();
  }

  function wireControls() {
    // Filtres (Tout/Faits/Mythes)
    const seg = $('#ff-cards-controls .seg');
    if (seg && !seg._wired) {
      seg._wired = true;
      seg.addEventListener('click', (e) => {
        const btn = e.target.closest('button'); if (!btn) return;
        $$('#ff-cards-controls .seg button').forEach(b => b.classList.toggle('active', b===btn));
        const f = btn.dataset.filter || 'all';
        $$('.ff-card').forEach(card => {
          const t = card.querySelector('.type').classList.contains('myth') ? 'myth'
                  : card.querySelector('.type').classList.contains('fact') ? 'fact' : 'unknown';
          card.style.display = (f==='all' || f===t) ? '' : 'none';
        });
      });
    }
    // Nouveaux lots
    const btnNew = $('#btnNewSet');
    if (btnNew && !btnNew._wired) {
      btnNew._wired = true;
      btnNew.addEventListener('click', async () => {
        await ensureData();
        CURRENT = pickRandom(DATA.filter(x => !seen.has(x.id)), N_INIT);
        if (CURRENT.length < N_INIT) CURRENT = CURRENT.concat(pickRandom(DATA, N_INIT - CURRENT.length));
        CURRENT.forEach(x => seen.add(x.id));
        renderCards(CURRENT);
      });
    }
    const oneFact = $('#btnOneFact');
    if (oneFact && !oneFact._wired) {
      oneFact._wired = true;
      oneFact.addEventListener('click', () => {
        const pool = DATA.filter(x => x.type==='fact');
        const pick = pickRandom(pool, 1);
        if (pick.length) renderCards(pick.concat(CURRENT).slice(0, N_INIT));
      });
    }
    const oneMyth = $('#btnOneMyth');
    if (oneMyth && !oneMyth._wired) {
      oneMyth._wired = true;
      oneMyth.addEventListener('click', () => {
        const pool = DATA.filter(x => x.type==='myth');
        const pick = pickRandom(pool, 1);
        if (pick.length) renderCards(pick.concat(CURRENT).slice(0, N_INIT));
      });
    }
    const shuffleCloud = $('#btnShuffle');
    if (shuffleCloud && !shuffleCloud._wired) {
      shuffleCloud._wired = true;
      shuffleCloud.addEventListener('click', async () => {
        await ensureData();
        renderCloud(pickRandom(DATA, 14));
      });
    }
  }

  function pickRandom(arr, n) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, Math.max(0, n));
  }

  // start
  loadInitial();
})();
