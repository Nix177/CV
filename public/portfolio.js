// public/portfolio.js
(function(){
  const items = window.PORTFOLIO_ITEMS || [];
  const list  = document.getElementById('portfolio-list');
  const modal = document.getElementById('preview-modal');
  const frame = document.getElementById('preview-frame');
  const close = document.getElementById('preview-close');

  function cardHTML(it){
    return `
      <div class="p-card">
        <div class="p-head">
          <div class="p-ico">${it.icon||'🧩'}</div>
          <div class="p-title">${it.title}</div>
        </div>
        <div class="p-desc">${it.desc||''}</div>
        <div class="p-actions">
          <a class="btn" href="${it.url}" target="_blank" rel="noopener">Visiter</a>
          ${it.preview ? `<button class="btn btn-ghost" data-id="${it.id}">Aperçu</button>` : ''}
        </div>
      </div>`;
  }

  function render(){
    if(!list) return;
    list.innerHTML = items.map(cardHTML).join('');
    list.querySelectorAll('[data-id]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const it = items.find(i=>i.id===btn.dataset.id);
        if(!it) return;
        frame.src = it.url;
        modal.classList.add('show');
      });
    });
  }

  if(close){
    close.addEventListener('click', ()=>{
      frame.src='about:blank';
      modal.classList.remove('show');
    });
  }

  render();
})();
