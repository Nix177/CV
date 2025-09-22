/* /assets/js/nav.js
   Header de navigation canonique (style “Fun Facts”), vanilla.
   - Construit le menu + switch langues (FR/EN/DE)
   - Détecte slug/lang via l’URL (…-en.html / …-de.html ; sinon FR)
   - Met à jour <link rel="alternate" hreflang="…">
   - Masque les anciens <nav> locaux
   - Expose --nt-nav-h (hauteur réelle) pour caler le brand en-dessous
*/
(() => {
  'use strict';

  // --- Config des pages (ordre strict) -------------------------------------
  const PAGES = [
    { slug: 'index',     label: { fr: 'Accueil',        en: 'Home',                  de: 'Startseite' } },
    { slug: 'cv',        label: { fr: 'CV',             en: 'CV',                    de: 'Lebenslauf' } },
    { slug: 'portfolio', label: { fr: 'Portfolio',      en: 'Portfolio',             de: 'Portfolio' } },
    { slug: 'passions',  label: { fr: 'Passions',       en: 'Passions',              de: 'Leidenschaften' } },
    { slug: 'chatbot',   label: { fr: 'Chatbot',        en: 'Chatbot',               de: 'Chatbot' } },
    { slug: 'ai-lab',    label: { fr: 'Labo IA',        en: 'AI Lab',                de: 'KI Lab' } },
    { slug: 'fun-facts', label: { fr: 'Idées reçues',   en: 'Common Misconceptions', de: 'Irrtümer' } },
  ];

  // --- Détection slug/lang à partir de l’URL --------------------------------
  const last = (location.pathname.endsWith('/'))
    ? 'index.html'
    : location.pathname.split('/').pop() || 'index.html';

  const clean = last.replace(/[#?].*$/g, ''); // retire ?query et #hash
  const m = clean.match(/^(.+?)(?:-(en|de))?\.html?$/i);

  let slug = (m && m[1]) ? m[1].toLowerCase() : 'index';
  let lang = (m && m[2]) ? m[2].toLowerCase() : 'fr';

  // Si page hors liste, on ne monte rien (évite effets indésirables)
  const known = new Set(PAGES.map(p => p.slug));
  if (!known.has(slug)) return;

  // Construit l’URL canonique selon la langue
  const urlFor = (s, L) => {
    if (L === 'fr') return `/${s}.html`;
    if (L === 'en') return `/${s}-en.html`;
    if (L === 'de') return `/${s}-de.html`;
    return `/${s}.html`;
  };

  // --- Création du header global -------------------------------------------
  const header = document.createElement('header');
  header.id = 'nt-global-nav';
  header.className = 'navbar';
  header.setAttribute('role', 'banner');

  const nav = document.createElement('nav');
  nav.className = 'site-nav';
  nav.setAttribute('aria-label', 'Navigation principale');

  const left = document.createElement('ul');
  left.className = 'menu nav-left';

  const right = document.createElement('ul');
  right.className = 'lang nav-right';

  // Liens du menu (libellés localisés)
  PAGES.forEach(p => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'chip';
    a.href = urlFor(p.slug, lang);
    a.textContent = p.label[lang] || p.label.fr;
    if (p.slug === slug) a.setAttribute('aria-current', 'page');
    li.appendChild(a);
    left.appendChild(li);
  });

  // Switch de langue
  ['fr', 'en', 'de'].forEach(L => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'chip';
    a.href = urlFor(slug, L);
    a.textContent = L.toUpperCase();
    if (L === lang) a.setAttribute('aria-current', 'page');
    li.appendChild(a);
    right.appendChild(li);
  });

  nav.appendChild(left);
  nav.appendChild(right);
  header.appendChild(nav);

  // Monte le header en tout début de <body>
  document.body.prepend(header);

  // Expose la hauteur réelle de la nav -> --nt-nav-h (utile pour le header local)
  function setNavHeight() {
    const h = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nt-nav-h', h + 'px');
  }
  setNavHeight();
  window.addEventListener('load', setNavHeight, { once: true });
  window.addEventListener('resize', setNavHeight);

  document.body.classList.add('nt-nav-mounted');

  // Masque les anciens navs locaux (sans toucher à notre header)
  document.querySelectorAll('nav.site-nav').forEach(n => {
    if (!header.contains(n)) n.style.display = 'none';
  });
  document.querySelectorAll('header.nav, header.navbar').forEach(h => {
    if (h !== header) h.style.display = 'none';
  });

  // --- hreflang alternates (FR/EN/DE + x-default->FR) ----------------------
  const head = document.head;
  const ensureAlt = (hreflang, href) => {
    if (!href) return;
    let link = head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = hreflang;
      head.appendChild(link);
    }
    link.href = href;
  };
  ensureAlt('fr', urlFor(slug, 'fr'));
  ensureAlt('en', urlFor(slug, 'en'));
  ensureAlt('de', urlFor(slug, 'de'));
  ensureAlt('x-default', urlFor(slug, 'fr'));
})();
