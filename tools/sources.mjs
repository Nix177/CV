// Mix institutions/policy + recherche/confs + outils/LLM.
// Les pages "News" sont auto-transformées en RSS (auto-discovery) via rss-utils.

export const SOURCES = [
  // --- Institutions / policy / éducation ---
  { name: "EDUCAUSE – Teaching & Learning", url: "https://er.educause.edu/channels/teaching-learning/rss" },
  { name: "EDUCAUSE – Policy", url: "https://er.educause.edu/channels/policy/rss" },
  { name: "Hechinger Report – EdTech", url: "https://hechingerreport.org/tags/education-technology/feed/" },
  { name: "UNESCO-UNEVOC (TVET)", url: "http://www.unevoc.unesco.org/unevoc_news.xml" },
  { name: "OECD Education & Skills Today", url: "https://oecdedutoday.com/feed/" },
  { name: "NCSC Suisse – Actus", url: "https://www.ncsc.admin.ch/ncsc/fr/home.html" },

  { name: "UNESCO GEM – World Education Blog", url: "https://world-education-blog.org/" },
  { name: "European Schoolnet – News", url: "https://www.eun.org/news" },
  { name: "Jisc (UK) – News", url: "https://www.jisc.ac.uk/news/all" },
  { name: "CEDEFOP – News (VET)", url: "https://www.cedefop.europa.eu/en/news-and-events/news" },
  { name: "CE – DG EAC – Newsroom", url: "https://ec.europa.eu/newsroom/eac/items" },
  { name: "CE – Digital Strategy – News", url: "https://digital-strategy.ec.europa.eu/en/news" },
  { name: "OECD.AI – Observatory", url: "https://oecd.ai/en/" },
  { name: "EDPS – Press & News (UE)", url: "https://www.edps.europa.eu/press-publications/press-news_en" },
  { name: "CNIL – Actualités (FR)", url: "https://www.cnil.fr/fr/actualites" },
  { name: "PFPDT/EDÖB – Actus (CH)", url: "https://www.edoeb.admin.ch/en" },
  { name: "NCSC UK – News", url: "https://www.ncsc.gov.uk/section/keep-up-to-date/ncsc-news" },
  { name: "US Dept. of Education – Blog", url: "https://blog.ed.gov/" },
  { name: "The Conversation (UK) – Education", url: "https://theconversation.com/uk/education" },
  { name: "Brookings – Brown Center Chalkboard", url: "https://www.brookings.edu/blog/brown-center-chalkboard/" },
  { name: "Times Higher Education – News", url: "https://www.timeshighereducation.com/news" },

  // --- Recherche / conférences / journaux ---
  // arXiv ciblé
  { name: "arXiv – cs.HC + education", url: "https://export.arxiv.org/api/query?search_query=all:education+AND+cat:cs.HC&max_results=25&sortBy=submittedDate&sortOrder=descending" },
  { name: "arXiv – cs.LG + learning analytics", url: "https://export.arxiv.org/api/query?search_query=all:(learning%20analytics)+AND+cat:cs.LG&max_results=25&sortBy=submittedDate&sortOrder=descending" },
  { name: "arXiv – cs.AI + education/MOOC", url: "https://export.arxiv.org/api/query?search_query=all:(education%20OR%20MOOC%20OR%20classroom)+AND+cat:cs.AI&max_results=25&sortBy=submittedDate&sortOrder=descending" },

  // Sociétés / confs
  { name: "SoLAR – Society for Learning Analytics Research (News)", url: "https://www.solaresearch.org/news" },
  { name: "EDM Society (Educational Data Mining)", url: "https://educationaldatamining.org/" },
  { name: "SIGCSE (ACM) – News", url: "https://sigcse.org/sigcse/news" },
  { name: "ACM Learning @ Scale", url: "https://learningatscale.acm.org/" },
  { name: "IAIED – News (AIED Society)", url: "https://iaied.org/news" },

  // Journaux
  { name: "npj Science of Learning (Nature)", url: "https://www.nature.com/npjscilearn.rss" },
  { name: "Frontiers in Education", url: "https://www.frontiersin.org/journals/education/rss" },
  { name: "Journal of Learning Analytics (JLA)", url: "https://learning-analytics.info/" },

  // --- Tech / LLM / outils ---
  { name: "Google AI Blog", url: "https://ai.googleblog.com/atom.xml" },
  { name: "Microsoft Research Blog", url: "https://www.microsoft.com/en-us/research/feed/" },
  { name: "DeepMind Blog", url: "https://deepmind.google/discover/blog/?format=rss" },
  { name: "The Gradient (ML essays)", url: "https://thegradient.pub/rss/" },
  { name: "Nature Machine Intelligence", url: "https://www.nature.com/natmachintell.rss" },
  { name: "IEEE Spectrum – AI", url: "https://spectrum.ieee.org/topic/artificial-intelligence/rss" },
  { name: "Papers with Code – Trending", url: "https://paperswithcode.com/trending/rss" },
  { name: "arXiv – cs.CL (NLP/LLM)", url: "https://export.arxiv.org/api/query?search_query=cat:cs.CL&max_results=25&sortBy=submittedDate&sortOrder=descending" },
  { name: "EdTech Magazine (Higher Ed)", url: "https://edtechmagazine.com/higher/rss.xml" },
  { name: "Google for Education – Blog", url: "https://blog.google/outreach-initiatives/education/rss/" },

  // --- NOUVEAUX : Sources crédibles & fiables (Tech, Science, News) ---
  { name: "TechCrunch – Artificial Intelligence", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
  { name: "VentureBeat – AI", url: "https://venturebeat.com/category/ai/feed/" },
  { name: "Wired – Artificial Intelligence", url: "https://www.wired.com/feed/category/science/artificial-intelligence/latest/rss" },
  { name: "MIT Technology Review – Artificial Intelligence", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
  { name: "Hugging Face – Blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "OpenAI – Blog", url: "https://openai.com/blog/rss.xml" },
  { name: "Anthropic – Research", url: "https://www.anthropic.com/index.xml" }, // Often has research updates
  { name: "ScienceDaily – Artificial Intelligence", url: "https://www.sciencedaily.com/rss/computers_math/artificial_intelligence.xml" },
  { name: "ACM TechNews", url: "https://technews.acm.org/rss.xml" },
];
