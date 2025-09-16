<script>
/* Night mode (persisté) */
(function() {
  const key = "theme";
  const html = document.documentElement;
  const saved = localStorage.getItem(key);
  if (saved) html.setAttribute("data-theme", saved);
  function setTheme(v) { html.setAttribute("data-theme", v); localStorage.setItem(key, v); }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle-theme]");
    if (!t) return;
    const next = (html.getAttribute("data-theme") === "light") ? "dark" : "light";
    setTheme(next);
  });

  // default: dark
  if (!saved) setTheme("dark");
})();
</script>
