/* /assets/js/nav.js
   Monte un header canonique "Fun Facts-like" et masque les navs existants.
   Zéro dépendance, vanilla, compatible sans bundler.
*/
(() => {
  // --- Config du site -------------------------------------------------------
  const PAGES = [
    { slug:'index',     label:{fr:'Accueil',         en:'Home',                  de:'Startseite'} },
    { slug:'cv',        label:{fr:'CV',              en:'CV',                    de:'Lebenslauf'} },
    { slug:'portfolio', label:{fr:'Portfolio',       en:'Portfolio',             de:'Portfolio'} },
    { slug:'passions',  label:{fr:'Passions',        en:'Passions',              de:'Leidenschaften'} },
    { slug:'chatbot',   label:{fr:'Chatbot',         en:'Chatbot',               de:'Chatbot'} },
    { slug:'ai-lab',    label:{fr:'Labo IA',         en:'AI Lab',                de:'KI Lab'} },
    { slug:'fun-facts', label:{fr:'Idées reçues',    en:'Common Misconceptions', de:'Irrtümer'} },
  ];
  // Pages sans version DE -> on renvoie vers EN
  const NO_DE = new Set(['index','portfolio','passions','chatbot']);

  // --- Détection slug/lang à partir de l’URL -------------------------------
  const path = (location.pathname.split('/').pop() || 'index.html')
                .replace(/^\s+|\s+$/g,'');
  const m = path.match(/^(.+?)(?:-(en|de))?\.html?$/i);
  let slug = (m && m[1]) ? m[1] : 'index';
  let lang = (m && m[2]) ? m[2] : 'fr';
  // Slugs attendus
  const known = new Set(PAGES.map(p => p.slug));
  if (!known.has(slug)) return; // on ne monte rien si page non prévue

  // Construit l’URL selon la langue (DE -> EN si non dispo)
  const urlFor = (s, L) => {
    if (L === 'fr') return `/${s}.html`;
    if (L === 'en') return `/${s}-en.html`;
    if (L === 'de') return NO_DE.has(s) ? `/${s}-en.html` : `/${s}-de.html`;
    return `/${s}.html`;
  };

  // --- Création du header canonique (Fun Facts-like) -----------------------
  const header = document.createElement('header');
  header.id = 'nt-global-nav';
  header.className = 'navbar';

  const nav = document.createElement('nav');
  nav.className = 'site-nav';

  const left = document.createElement('ul');
  left.className = 'menu nav-left';

  const right = document.createElement('ul');
  right.className = 'lang nav-right';

  // Liens menu (libellés localisés)
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

  // Switch langues
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

  // Monte le header tout en haut du body
  document.body.prepend(header);
  document.body.classList.add('nt-nav-mounted');

  // Masque les anciens navs (sans supprimer le HTML)
  // - tout nav.site-nav qui n’est pas le nôtre
  document.querySelectorAll('nav.site-nav').forEach(n => {
    if (!header.contains(n)) n.style.display = 'none';
  });
  // - wrappers header potentiellement utilisés ailleurs
  document.querySelectorAll('header.nav, header.navbar').forEach(h => {
    if (h !== header) h.style.display = 'none';
  });

  // --- hreflang: FR/EN/DE + x-default (FR) ---------------------------------
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
