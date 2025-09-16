// public/site.js
(function () {
  const KEY = 'theme';
  const root = document.documentElement;
  const saved = localStorage.getItem(KEY);
  if (saved) root.setAttribute('data-theme', saved);
  else { root.setAttribute('data-theme', 'dark'); localStorage.setItem(KEY, 'dark'); }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toggle-theme]');
    if (!t) return;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem(KEY, next);
  });

  // petite API UI
  window.UI = {
    setBusy(btn, on=true) {
      if (!btn) return;
      if (on) {
        btn.dataset._label = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳';
      } else {
        btn.disabled = false;
        if (btn.dataset._label) btn.textContent = btn.dataset._label;
      }
    }
  };
})();
