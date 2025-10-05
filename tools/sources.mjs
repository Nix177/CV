// 21 sources (6 d'origine + 15 ajouts). Certaines sont des pages "News":
// rss-utils détectera automatiquement un flux <link rel="alternate" ...> ou tentera /feed/.
export const SOURCES = [
  // --- 6 d'origine ---
  { name: "EDUCAUSE – Teaching & Learning", url: "https://er.educause.edu/channels/teaching-learning/rss" },
  { name: "EDUCAUSE – Policy",             url: "https://er.educause.edu/channels/policy/rss" },
  { name: "Hechinger Report – EdTech",     url: "https://hechingerreport.org/tags/education-technology/feed/" },
  { name: "UNESCO-UNEVOC (TVET)",          url: "http://www.unevoc.unesco.org/unevoc_news.xml" },
  { name: "OECD Education & Skills Today", url: "https://oecdedutoday.com/feed/" },
  { name: "NCSC Suisse – Actus",           url: "https://www.ncsc.admin.ch/ncsc/fr/home.html" }, // auto-discovery

  // --- 15 ajouts "haut niveau" ---
  { name: "UNESCO GEM – World Education Blog", url: "https://world-education-blog.org/" },
  { name: "European Schoolnet – News",         url: "https://www.eun.org/news" },
  { name: "Jisc (UK) – News",                  url: "https://www.jisc.ac.uk/news/all" },
  { name: "CEDEFOP – News (VET)",              url: "https://www.cedefop.europa.eu/en/news-and-events/news" },
  { name: "CE – DG EAC – Newsroom",            url: "https://ec.europa.eu/newsroom/eac/items" },
  { name: "CE – Digital Strategy – News",      url: "https://digital-strategy.ec.europa.eu/en/news" },
  { name: "OECD.AI – Observatory",             url: "https://oecd.ai/en/" },
  { name: "EDPS – Press & News (UE)",          url: "https://www.edps.europa.eu/press-publications/press-news_en" },
  { name: "CNIL – Actualités (FR)",            url: "https://www.cnil.fr/fr/actualites" },
  { name: "PFPDT/EDÖB – Actus (CH)",           url: "https://www.edoeb.admin.ch/en" },
  { name: "NCSC UK – News",                    url: "https://www.ncsc.gov.uk/section/keep-up-to-date/ncsc-news" },
  { name: "US Dept. of Education – Blog",      url: "https://blog.ed.gov/" },
  { name: "The Conversation (UK) – Education", url: "https://theconversation.com/uk/education" },
  { name: "Brookings – Brown Center Chalkboard", url: "https://www.brookings.edu/blog/brown-center-chalkboard/" },
  { name: "Times Higher Education – News",     url: "https://www.timeshighereducation.com/news" }
];
