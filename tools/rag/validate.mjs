import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (relative) => JSON.parse(readFileSync(path.join(root, relative), "utf8"));
const errors = [];
const warnings = [];
const validStatuses = new Set(["concept", "mockup", "prototype", "demo", "experimental", "stable", "archived"]);
const validIndexPolicies = new Set([undefined, "code", "metadata-only"]);
const obsoleteProjectNamePattern = new RegExp(`edit[ -]?${["a", "i"].join("")}`, "i");

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

const knowledgeBase = readJson("public/data/rag-knowledge-base.json");
const profile = readJson("public/profile.json");
const index = readJson("public/rag/project-code-index.json");
const report = readJson("public/rag/project-index-report.json");

requireCondition(knowledgeBase.schemaVersion === 1, "Unsupported knowledge-base schema version.");
requireCondition(knowledgeBase.projects?.length >= 10, "Knowledge base contains too few projects.");
requireCondition(profile.generatedFrom === "/data/rag-knowledge-base.json", "profile.json is not marked as a generated compatibility file.");
requireCondition(!("birth" in profile), "profile.json must not expose a birth date.");

const ids = new Set();
for (const project of knowledgeBase.projects || []) {
  requireCondition(project.id && !ids.has(project.id), `Missing or duplicate project id: ${project.id || "(empty)"}.`);
  ids.add(project.id);
  requireCondition(validStatuses.has(project.status), `Invalid status for ${project.id}: ${project.status}.`);
  for (const field of ["implemented", "partiallyImplemented", "simulated", "planned", "notImplemented", "currentLimitations", "technologies", "architecture", "contribution", "repositoryUrls", "safeClaims", "forbiddenClaims"]) {
    requireCondition(Array.isArray(project[field]), `${project.id}.${field} must be an array.`);
  }
  requireCondition(project.display?.i18n?.fr && project.display?.i18n?.en && project.display?.i18n?.de, `${project.id} lacks FR/EN/DE portfolio text.`);
  requireCondition(!obsoleteProjectNamePattern.test(`${project.id} ${project.title}`), `Obsolete removed project found: ${project.id}.`);
  for (const repository of project.repositories || []) {
    requireCondition(validIndexPolicies.has(repository.indexPolicy), `Invalid index policy for ${project.id}: ${repository.indexPolicy}.`);
    if (repository.indexPolicy === "metadata-only") {
      requireCondition(Boolean(repository.licenseStatus), `${project.id} metadata-only repository lacks a license status.`);
    }
  }
  if (project.repositories?.length && !(index.projects || []).includes(project.id)) warnings.push(`${project.id} has repositories but is absent from the generated index.`);
}

const histoire = (knowledgeBase.projects || []).find((project) => project.id === "histoire-os");
requireCondition(Boolean(histoire), "Histoire d'Os remains active but has no technical RAG project record.");
requireCondition(histoire?.portfolioVisible === false, "Histoire d'Os RAG coverage must not create an extra portfolio card.");
const telescope = (knowledgeBase.projects || []).find((project) => project.id === "telescope");
requireCondition(telescope?.status !== "stable", "Telescope OnStep cannot remain stable without test evidence.");

requireCondition((index.chunks || []).length > 0, "Project code index is empty.");
for (const chunk of index.chunks || []) {
  requireCondition(ids.has(chunk.projectId), `Unknown project in code index: ${chunk.projectId}.`);
  requireCondition(chunk.repository && chunk.branch && chunk.path && chunk.sourceUrl && chunk.lastIndexedCommit, `Incomplete metadata for chunk ${chunk.id}.`);
  requireCondition(String(chunk.content || "").length <= 1800, `Chunk exceeds the 1800-character bound: ${chunk.id}.`);
  requireCondition(!/(^|\/)(?:\.env|credentials|secrets|tokens|id_rsa)/i.test(chunk.path), `Sensitive path indexed: ${chunk.path}.`);
  requireCondition(!/sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|PRIVATE KEY/.test(chunk.content), `Possible secret indexed in ${chunk.id}.`);
  requireCondition(typeof chunk.suspiciousInstructionLike === "boolean", `Instruction-like content flag missing from ${chunk.id}.`);
  if (chunk.chunkType === "repository-metadata") {
    requireCondition(chunk.path === "repository-metadata", `Metadata-only chunk has an unexpected path: ${chunk.id}.`);
  }
}
requireCondition(Array.isArray(report.suspiciousInstructionChunks), "Index report lacks suspicious-instruction findings.");

const factualFiles = [
  "public/cv-text.txt",
  "public/data/rag-knowledge-base.json",
  "api/chat.js",
  "public/prototypes/voice-assistant/js/GeminiLiveClient.js"
];
const forbiddenPatterns = [
  { regex: /aucun doctorat n['’]est actuellement planifié/i, label: "obsolete doctoral planning wording" },
  { regex: /Nicolas (?:a|aurait) travaillé (?:chez|pour) educa\.ch/i, label: "false educa.ch employment claim" },
  { regex: /2024\s*[—-]\s*CAS Éducation numérique\.?/i, label: "CAS presented as a qualification" },
  { regex: /Nicolas est (?:un )?(?:développeur logiciel senior|ingénieur full-stack)/i, label: "senior/full-stack claim" }
];
for (const relative of factualFiles) {
  const content = readFileSync(path.join(root, relative), "utf8");
  requireCondition(!obsoleteProjectNamePattern.test(content), `Obsolete removed project mention found in ${relative}.`);
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(content) && relative !== "public/data/rag-knowledge-base.json") errors.push(`${pattern.label} found in ${relative}.`);
  }
}

requireCondition(/Nicolas n['’]a jamais travaillé pour educa\.ch/i.test(readFileSync(path.join(root, "public/cv-text.txt"), "utf8")), "Missing explicit educa.ch clarification in cv-text.txt.");
requireCondition(/aucun projet doctoral n['’]est actuellement en cours/i.test(readFileSync(path.join(root, "public/cv-text.txt"), "utf8")), "Missing current doctoral-status clarification.");
requireCondition(report.errors?.length === 0, `Index report contains ${report.errors?.length || 0} errors.`);

const workflow = readFileSync(path.join(root, ".github/workflows/rag-project-index.yml"), "utf8");
requireCondition(/permissions:\s*\n\s*contents:\s*read/i.test(workflow), "RAG workflow must use read-only repository permissions.");
requireCondition(!/\bgit\s+push\b/i.test(workflow), "RAG workflow must not push generated files to main.");

const docsDir = path.join(root, "public/rag/projects");
requireCondition(existsSync(docsDir), "Generated per-project RAG documentation is missing.");
if (existsSync(docsDir)) requireCondition(readdirSync(docsDir).filter((file) => file.endsWith(".md")).length === knowledgeBase.projects.length, "Per-project RAG documentation count does not match the knowledge base.");

for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`RAG validation passed: ${knowledgeBase.projects.length} projects, ${index.chunks.length} bounded code chunks.`);
