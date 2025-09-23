/* Languette feedback (discrète, sur toutes les pages où ce script est chargé)
   - Ajoute un onglet fixe à droite
   - POST /api/ff-feedback avec { message, pageUrl, pageTitle, userAgent, ts }
*/
// UPDATE: JS pur (pas de balise <script>)
(() => {
  if (document.getElementById('ff-feedback-tab')) return;

  const tab = document.createElement('div');
  tab.id = 'ff-feedback-tab';
  tab.style.cssText = `
    position: fixed; right: 0; top: 40%; transform: translateY(-50%);
    background: rgba(15,23,42,.9); color:#e5e7eb; border:1px solid rgba(255,255,255,.15);
    border-right: none; border-radius: 12px 0 0 12px; padding: 8px 10px; z-index: 9999;
    font: 14px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial, sans-serif; cursor:pointer;
  `;
  tab.textContent = 'Feedback';
  document.body.appendChild(tab);

  const panel = document.createElement('div');
  panel.id = 'ff-feedback-panel';
  panel.style.cssText = `
    position: fixed; right: 0; top: 40%; transform: translateY(-50%);
    width: min(360px, 90vw); background: rgba(15,23,42,.98); color:#e5e7eb;
    border:1px solid rgba(255,255,255,.15); border-right: none; border-radius: 12px 0 0 12px;
    padding: 12px; z-index: 10000; display:none;
  `;
  panel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
      <strong style="font-weight:800;">Donner un feedback</strong>
      <button id="ffb-close" class="btn" style="background:#0b1f33;color:#e6f1ff;border:1px solid #ffffff22;border-radius:8px;padding:6px 10px;">×</button>
    </div>
    <p style="margin:.5rem 0 .25rem 0; opacity:.9; font-size:.95rem;">Votre remarque (bug, idée, question)…</p>
    <textarea id="ffb-msg" rows="5" style="width:100%;border-radius:10px;border:1px solid #ffffff22;background:#0b1323;color:#e6f1ff;padding:8px;"></textarea>
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
      <button id="ffb-send" class="btn" style="background:#0b1f33;color:#e6f1ff;border:1px solid #ffffff22;border-radius:8px;padding:8px 12px;">Envoyer</button>
      <span id="ffb-status" style="opacity:.85;"></span>
    </div>
  `;
  document.body.appendChild(panel);

  tab.addEventListener('click', ()=> { panel.style.display = 'block'; });
  panel.querySelector('#ffb-close').addEventListener('click', ()=> { panel.style.display = 'none'; });

  panel.querySelector('#ffb-send').addEventListener('click', async () => {
    const msg = panel.querySelector('#ffb-msg').value.trim();
    if (!msg) return;
    const payload = {
      message: msg,
      pageUrl: location.href,
      pageTitle: document.title || '',
      userAgent: navigator.userAgent,
      ts: new Date().toISOString(),
    };
    const st = panel.querySelector('#ffb-status');
    st.textContent = '…';
    try{
      const r = await fetch('/api/ff-feedback', {
        method:'POST', headers:{'content-type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('HTTP '+r.status);
      st.textContent = 'Merci !';
      panel.querySelector('#ffb-msg').value = '';
      setTimeout(()=>{ panel.style.display='none'; st.textContent=''; }, 1200);
    }catch(e){
      st.textContent = 'Erreur – réessayez plus tard';
    }
  });
})();
