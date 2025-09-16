// site.js
(function () {
  async function verify(code) {
    try {
      const r = await fetch(`/api/verify?code=${encodeURIComponent(code)}`);
      const j = await r.json();
      return !!j.ok;
    } catch { return false; }
  }

  // Bouton "Télécharger le CV"
  const dl = document.getElementById('dlCvBtn');
  if (dl) {
    dl.addEventListener('click', async () => {
      const code = prompt('Entrez le code secret pour télécharger le CV :');
      if (!code) return;
      if (await verify(code)) {
        window.location.href = `/api/cv?code=${encodeURIComponent(code)}`;
      } else {
        alert('Code invalide.');
      }
    });
  }

  // Protection de la page CV : si on est sur /cv*.html on demande le code si pas déjà validé
  const isCV = /\/cv(-..)?\.html$/i.test(location.pathname);
  if (isCV) {
    const ok = sessionStorage.getItem('cv_ok') === '1';
    if (!ok) {
      (async () => {
        let code = prompt('Cette page est protégée. Entrez le code :');
        if (!code) return location.href = '/index.html';
        if (await verify(code)) {
          sessionStorage.setItem('cv_ok', '1');
          location.reload();
        } else {
          alert('Code invalide.'); location.href = '/index.html';
        }
      })();
    }
  }
})();
