// /public/fun-facts.js
(function () {
  const lang = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2).toLowerCase();
  const N = 9;

  // Trouve/installe la grille
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

  function card(item) {
    const li = document.createElement('div');
    li.className = 'card3d';
    li.tabIndex = 0;

    const inner = document.createElement('div');
    inner.className = 'inner';

    // FRONT = claim
    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <span class="chip">${label('Mythe','Myth','Mythos')}</span>
      </div>
      <div class="h3" style="font-size:1.35rem; font-weight:800">${escapeHTML(item.claim)}</div>
      <div style="margin-top:10px"><button class="btn linkish">${label('Retourner','Flip','Umdrehen')}</button></div>
    `;

    // BACK = explain + source
    const back = document.createElement('div');
    back.className = 'face back';
    const explain = item.explain ? escapeHTML(item.explain) : label('—', '—', '—');
    const src = item.source ? `<a href="${item.source}" target="_blank" rel="noopener">${label('Voir la source','View source','Quelle öffnen')}</a>` : '';
    back.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <span class="chip">${label('Fait vérifié','fact','Fakt')}</span>
      </div>
      <p style="margin:0 0 10px">${explain}</p>
      <div style="margin-top:auto"><button class="btn linkish">${label('Retourner','Flip','Umdrehen')}</button> ${src}</div>
    `;

    inner.appendChild(front);
    inner.appendChild(back);
    li.appendChild(inner);

    // Flip handlers
    li.addEventListener('click', (e) => {
      if (e.target.closest('button')) {
        li.classList.toggle('is-flipped');
      }
    });
    li.addEventListener('keypress', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault(); li.classList.toggle('is-flipped');
      }
    });

    return li;
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function loadFacts(spin) {
    if (spin) {
      reroll.classList.add('is-busy');
      reroll.disabled = true;
    }
    grid.innerHTML = ''; // clear
    try {
      const res = await fetch(`/api/facts?lang=${encodeURIComponent(lang)}&n=${N}`, { cache: 'no-store' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'API error');
      for (const item of data.items) {
        grid.appendChild(card(item));
      }
    } catch (e) {
      // repli minimal si API KO
      const msg = document.createElement('div');
      msg.className = 'card pad';
      msg.innerHTML = `<div class="title">${label('Liste statique (repli)', 'Static list (fallback)', 'Statische Liste (Fallback)')}</div>
      <p class="muted">${label('Si vous voyez ceci, l’API est indisponible. Un repli local s’affiche.',
      'If you see this, the API is unavailable. Showing a local fallback.',
      'Wenn du das siehst, ist die API nicht erreichbar. Lokales Fallback wird angezeigt.')}</p>`;
      grid.appendChild(msg);
    } finally {
      reroll.classList.remove('is-busy');
      reroll.disabled = false;
    }
  }

  // Go
  loadFacts(false);
})();
