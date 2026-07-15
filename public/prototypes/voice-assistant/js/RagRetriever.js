import {
  detectTechnicalQuestion,
  formatRetrievedChunks,
  normalizeSearchText,
  rankLexicalChunks
} from "../../../rag/weighted-lexical-retriever.js";

const SOURCE_URLS = {
  knowledgeBase: "/data/rag-knowledge-base.json",
  codeIndex: "/rag/project-code-index.json"
};

function projectAliases(project) {
  return [project.id, project.title, ...Object.values(project.display?.i18n || {}).map((entry) => entry?.title)]
    .filter(Boolean)
    .map(normalizeSearchText);
}

function identifyProject(projects, question, requestedProjectId = "") {
  const explicit = normalizeSearchText(requestedProjectId).trim();
  if (explicit) return projects.find((project) => normalizeSearchText(project.id) === explicit) || null;
  const normalizedQuestion = normalizeSearchText(question);
  return projects.find((project) => projectAliases(project).some((alias) => alias.length > 3 && normalizedQuestion.includes(alias))) || null;
}

function buildKnowledgeChunks(knowledgeBase) {
  const profileChunks = Object.entries(knowledgeBase.profile || {}).map(([key, value]) => ({
    id: `profile:${key}`,
    projectId: "profile",
    path: `/data/rag-knowledge-base.json#profile.${key}`,
    chunkType: "profile",
    implementationStatus: "verified-profile-data",
    content: `${key}: ${Array.isArray(value) ? value.join("\n") : typeof value === "object" ? JSON.stringify(value) : value}`
  }));
  const projectChunks = (knowledgeBase.projects || []).map((project) => ({
    id: `project:${project.id}`,
    projectId: project.id,
    projectTitle: project.title,
    path: `/data/rag-knowledge-base.json#projects.${project.id}`,
    chunkType: "project-summary",
    implementationStatus: project.status,
    content: JSON.stringify({
      title: project.title,
      status: project.status,
      summary: project.summary,
      purpose: project.purpose,
      implemented: project.implemented,
      partiallyImplemented: project.partiallyImplemented,
      simulated: project.simulated,
      planned: project.planned,
      notImplemented: project.notImplemented,
      currentLimitations: project.currentLimitations,
      technologies: project.technologies,
      architecture: project.architecture,
      contribution: project.contribution,
      aiAssistance: project.aiAssistance,
      safeClaims: project.safeClaims,
      forbiddenClaims: project.forbiddenClaims
    })
  }));
  return profileChunks.concat(projectChunks);
}

export class RagRetriever {
  constructor() {
    this.knowledgeBase = { profile: {}, projects: [] };
    this.codeIndex = { chunks: [] };
    this.knowledgeChunks = [];
    this.ready = false;
  }

  async load() {
    const [knowledgeResponse, indexResponse] = await Promise.all([
      fetch(SOURCE_URLS.knowledgeBase, { cache: "no-store" }),
      fetch(SOURCE_URLS.codeIndex, { cache: "no-store" })
    ]);
    if (!knowledgeResponse.ok) throw new Error("Unable to load the verified knowledge base");
    if (!indexResponse.ok) throw new Error("Unable to load the project code index");

    this.knowledgeBase = await knowledgeResponse.json();
    this.codeIndex = await indexResponse.json();
    this.knowledgeChunks = buildKnowledgeChunks(this.knowledgeBase);
    this.ready = this.knowledgeChunks.length > 0;
    return this;
  }

  retrieve(query, limit = 6) {
    if (!this.ready) return { query, context: "", sources: [], found: false, passageIds: [] };
    const project = identifyProject(this.knowledgeBase.projects || [], query);
    const ranked = rankLexicalChunks(query, this.knowledgeChunks, { projectId: project?.id, limit });
    let context = formatRetrievedChunks(ranked, { maxChars: 9000 });
    let technical = null;

    if (detectTechnicalQuestion(query)) {
      technical = this.retrieveProjectCodeContext({ projectId: project?.id, question: query });
      if (technical.context) context = `${context}\n\n=== TECHNICAL CODE EVIDENCE ===\n${technical.context}\n\n${technical.summary}`;
    }

    return {
      query,
      context: context.slice(0, 17000),
      sources: [...new Set(ranked.map((chunk) => chunk.projectId === "profile" ? "Profile" : chunk.projectTitle || chunk.projectId))],
      found: ranked.length > 0,
      passageIds: ranked.map((chunk) => chunk.id),
      technical
    };
  }

  retrieveProjectCodeContext({ projectId = "", question = "", language = "fr" } = {}) {
    const projects = this.knowledgeBase.projects || [];
    const project = identifyProject(projects, question, projectId);
    const candidates = project
      ? (this.codeIndex.chunks || []).filter((chunk) => chunk.projectId === project.id)
      : (this.codeIndex.chunks || []);
    const ranked = rankLexicalChunks(question, candidates, { projectId: project?.id, limit: 7 });
    const hasCodeEvidence = ranked.some((chunk) => chunk.chunkType !== "repository-metadata");
    const repositories = [...new Map(ranked.map((chunk) => [chunk.repository, { repository: chunk.repository, branch: chunk.branch }])).values()];
    const paths = [...new Set(ranked.map((chunk) => chunk.path).filter(Boolean))];
    const summary = !project
      ? "No verified project matched the request."
      : hasCodeEvidence
        ? `${project.title}: ${project.status}. Code evidence was found, but it does not by itself prove a production deployment.`
        : ranked.length
          ? `${project.title}: ${project.status}. Only cautious repository metadata is available; raw code was not indexed.`
        : "The repository describes this feature, but there was not enough code or test evidence to confirm it is operational.";

    return {
      project: project ? { id: project.id, title: project.title, status: project.status } : null,
      repositories,
      paths,
      excerpts: ranked.map((chunk) => ({
        repository: chunk.repository,
        branch: chunk.branch,
        path: chunk.path,
        symbolName: chunk.symbolName,
        chunkType: chunk.chunkType,
        implementationStatus: chunk.implementationStatus,
        sourceUrl: chunk.sourceUrl,
        lastIndexedCommit: chunk.lastIndexedCommit,
        content: String(chunk.content || "").slice(0, 2400)
      })),
      context: formatRetrievedChunks(ranked, { maxChars: 8000 }),
      summary,
      implementationStatus: project?.status || "unverified",
      readmeDivergences: project?.readmeDivergences || [],
      language,
      evidenceLevel: hasCodeEvidence ? "code-indexed" : ranked.length ? "metadata-only" : "not-found",
      verified: Boolean(project && ranked.length && hasCodeEvidence)
    };
  }
}
