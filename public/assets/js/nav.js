/* /assets/js/nav.js
   Header de navigation canonique (style “Fun Facts”), vanilla.
   - Menu + switch langues (FR/EN/DE)
   - Détecte la langue via <html lang> et supporte les URLs avec/sans .html
   - Met à jour <link rel="alternate" hreflang="…">
   - Masque les anciens <nav> locaux
   - Expose --nt-nav-h (hauteur réelle) pour caler les titres en-dessous
*/
(() => {
  'use strict';

  // --- Config des pages (ordre strict, slugs = noms de fichiers sans suffixe langue) ----
  const PAGES = [
    { slug: 'index',     label: { fr: 'Accueil',        en: 'Home',                  de: 'Startseite' } },
    { slug: 'cv',        label: { fr: 'CV',             en: 'CV',                    de: 'Lebenslauf' } },
    { slug: 'portfolio', label: { fr: 'Portfolio',      en: 'Portfolio',             de: 'Portfolio' } },
    { slug: 'passions',  label: { fr: 'Passions',       en: 'Passions',              de: 'Leidenschaften' } },
    { slug: 'chatbot',   label: { fr: 'Chatbot',        en: 'Chatbot',               de: 'Chatbot' } },
    { slug: 'fun-facts', label: { fr: 'Idées reçues',   en: 'Common Misconceptions', de: 'Irrtümer' } },
  ];
  const KNOWN = new Set(PAGES.map(p => p.slug));

  // --- Langue active : on fait CONFIANCE à <html lang> -------------------------------
  const htmlLang = (document.documentElement.getAttribute('lang') || 'fr').slice(0,2).toLowerCase();
  const lang = (htmlLang === 'en' || htmlLang === 'de') ? htmlLang : 'fr';

  // --- Slug actif : supporte /slug, /slug.html, /slug-en, /slug-en.html --------------
  const path = location.pathname.replace(/\/+/g, '/');
  let lastSeg = path === '/' ? 'index' : path.split('/').filter(Boolean).pop(); // '' -> index
  lastSeg = lastSeg.replace(/\.(html?|php)$/i, ''); // retire extension éventuelle
  // sépare suffixe -en/-de éventuel
  const mm = lastSeg.match(/^(.+?)(?:-(en|de))?$/i);
  let slug = (mm && mm[1]) ? mm[1].toLowerCase() : 'index';
  if (!KNOWN.has(slug)) slug = 'index';

  // --- URLs canoniques pour chaque langue -------------------------------------------
  const urlFor = (s, L) => {
    // On garde les .html (ton serveur les accepte et/ou réécrit vers /slug)
    if (L === 'fr') return `/${s}.html`;
    if (L === 'en') return `/${s}-en.html`;
    if (L === 'de') return `/${s}-de.html`;
    return `/${s}.html`;
  };

  // --- Header global ---------------------------------------------------------------
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
  ['fr','en','de'].forEach(L => {
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

  // Monte le header en tout début de body
  document.body.prepend(header);

  // Expose la hauteur réelle -> --nt-nav-h
  function setNavHeight() {
    const h = Math.ceil(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--nt-nav-h', h + 'px');
  }
  setNavHeight();
  window.addEventListener('load', setNavHeight, { once: true });
  window.addEventListener('resize', setNavHeight);

  document.body.classList.add('nt-nav-mounted');

  // Masque les anciens navs locaux (sans toucher au nôtre)
  document.querySelectorAll('nav.site-nav').forEach(n => {
    if (!header.contains(n)) n.style.display = 'none';
  });
  document.querySelectorAll('header.nav, header.navbar').forEach(h => {
    if (h !== header) h.style.display = 'none';
  });

  // --- <link rel="alternate" hreflang="…"> -----------------------------------------
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
