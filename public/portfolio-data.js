/* Compatibility adapter. The maintained source is /data/rag-knowledge-base.json. */
(function () {
  "use strict";

  function toPortfolioItem(project) {
    const display = project.display || {};
    return {
      id: project.id,
      status: project.status,
      category: ["concept", "mockup"].includes(project.status) ? "maquette/idées" : project.category,
      image: display.image,
      tags: display.tags || [],
      url: project.liveDemoUrl || "",
      extraLinks: display.extraLinks || [],
      extraImages: display.extraImages || [],
      video: display.video || null,
      implementationSummary: project.summary,
      currentLimitations: project.currentLimitations || [],
      repositoryUrls: project.repositoryUrls || [],
      i18n: display.i18n || {}
    };
  }

  window.portfolioData = [];
  window.portfolioDataReady = fetch("/data/rag-knowledge-base.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`Unable to load portfolio knowledge base (${response.status})`);
      return response.json();
    })
    .then((knowledgeBase) => {
      const items = (knowledgeBase.projects || [])
        .filter((project) => project.portfolioVisible !== false)
        .map(toPortfolioItem);
      window.portfolioData = items;
      window.PORTFOLIO = { items };
      window.PORTFOLIO_ITEMS = items;
      return items;
    })
    .catch((error) => {
      console.error("Portfolio data loading error", error);
      return [];
    });
})();
