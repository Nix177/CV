<script>
document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'cv_access_ok_v1';
  // Option pour tests en local si ton /api/verify n’est pas prêt :
  const FALLBACK_TEST_CODE = window.__CV_TEST_CODE || null; // ex: dans index: <script>window.__CV_TEST_CODE="nicolastuorcv";</script>

  // ---- helpers
  const $ = (sel, root=document) => root.querySelector(sel);

  // ---- récupérer/ créer les conteneurs
  const main = $('main') || document.body;

  // zone "contenu du CV"
  let unlocked = $('#cv-unlocked') || $('#cv-views');
  if (!unlocked) {
    // on ne force pas la structure, mais on prépare un placeholder si rien n’existe
    unlocked = document.createElement('section');
    unlocked.id = 'cv-unlocked';
    unlocked.hidden = true;
    unlocked.innerHTML = `<div style="padding:16px;border:1px solid #1b3f66;border-radius:12px;background:#0a2138;color:#cfe4ff">
      <strong>CV</strong> — contenu visible après déverrouillage.</div>`;
    main.prepend(unlocked);
  }

  // zone "verrouillée" + formulaire
  let locked = $('#cv-locked');
  if (!locked) {
    locked = document.createElement('section');
    locked.id = 'cv-locked';
    locked.innerHTML = `
      <form id="cv-unlock-form" class="cv-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;padding:12px;background:#0a2036;border:1px solid #163b62;border-radius:12px;">
        <label for="cv-code" style="color:#cfe4ff;">Code d’accès&nbsp;:</label>
        <input id="cv-code" type="password" placeholder="••••••" 
               style="background:#0b2a47;border:1px solid #185082;color:#daecff;border-radius:10px;padding:.5rem .7rem;min-width:220px;">
        <button id="cv-submit" type="submit"
                style="background:linear-gradient(180deg,#0b2a47,#093257);color:#daecff;border:1px solid #185082;border-radius:10px;padding:.5rem .9rem;font-weight:600;">
          Déverrouiller
        </button>
        <small id="cv-help" style="color:#9bb2da;"></small>
      </form>`;
    // Si tu as déjà une zone d’entête, on insère juste après. Sinon on met au début de main.
    main.prepend(locked);
  }

  const form   = $('#cv-unlock-form', locked);
  const input  = $('#cv-code', locked);
  const help   = $('#cv-help', locked);
  const submit = $('#cv-submit', locked);

  // ---- affichage
  function unlock(){
    try {
      locked.hidden = true;
      unlocked.hidden = false;
      localStorage.setItem(STORAGE_KEY, '1');
      document.body.classList.add('cv-unlocked');
    } catch {}
  }
  function lock(){
    try {
      locked.hidden = false;
      unlocked.hidden = true;
      localStorage.removeItem(STORAGE_KEY);
      document.body.classList.remove('cv-unlocked');
    } catch {}
  }

  // état initial
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    unlock();
  } else {
    lock();
  }

  // ---- UX
  function setBusy(b){
    if(!submit) return;
    submit.disabled = b;
    submit.textContent = b ? 'Vérification…' : 'Déverrouiller';
  }
  function setHelp(msg, ok=false){
    if(help){ help.textContent = msg || ''; help.style.color = ok ? '#22c55e' : '#ffb4b4'; }
  }

  // ---- vérification
  async function verify(code){
    // Try API first if it exists:
    try {
      const res = await fetch(`/api/verify?code=${encodeURIComponent(code)}`, { method:'GET' });
      if (res.ok) return true;
    } catch { /* pas d’API, on tente le fallback */ }

    // Fallback pour tests / simple partage (tu envoies toi-même ce code au recruteur)
    if (FALLBACK_TEST_CODE && code === FALLBACK_TEST_CODE) return true;

    return false;
  }

  // ---- submit
  if (form) {
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const code = (input?.value || '').trim();
      if (!code){ setHelp('Entrez votre code.'); return; }
      setBusy(true); setHelp('');
      const ok = await verify(code);
      setBusy(false);
      if (ok){ setHelp('Accès accordé.', true); unlock(); }
      else   { setHelp('Code invalide.'); lock(); }
    });
  }

});
</script>
