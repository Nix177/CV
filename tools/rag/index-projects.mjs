import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { containsInstructionLikeContent } from "./prompt-injection-guard.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "../..");
const KB_PATH = path.join(ROOT, "public/data/rag-knowledge-base.json");
const INDEX_PATH = path.join(ROOT, "public/rag/project-code-index.json");
const REPORT_PATH = path.join(ROOT, "public/rag/project-index-report.json");
const DOCS_DIR = path.join(ROOT, "public/rag/projects");
const CACHE_DIR = path.join(ROOT, ".rag-cache/projects");

const IGNORED_DIRS = new Set([
  ".git", ".github", ".next", ".nuxt", ".venv", "venv", "node_modules", "vendor", "dist", "build",
  "coverage", "out", "target", "bin", "obj", "__pycache__", ".expo", "_expo", ".cache", "uploads"
]);
const IGNORED_FILES = /(^|\/)(?:\.env(?:\..*)?|credentials?|secrets?|tokens?|id_rsa|id_ed25519)(?:\..*)?$/i;
const IGNORED_SUFFIXES = /\.(?:lock|min\.js|min\.css|map|png|jpe?g|gif|webp|svg|ico|pdf|glb|gltf|bin|exe|dll|so|dylib|zip|7z|gz|tar|mp[34]|wav|ogg|flac|woff2?|ttf|eot|sqlite3?|db|pyc)$/i;
const INDEXABLE_SUFFIXES = /\.(?:js|jsx|mjs|cjs|ts|tsx|vue|py|go|java|kt|kts|cs|cpp|cc|c|h|hpp|rs|rb|php|swift|html|css|scss|json|ya?ml|toml|md|txt|xml)$/i;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"']{16,}["']/i
];

function parseArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function runGit(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"] })?.trim() || "";
}

function ensureRepository(project, repository, sourceRoot) {
  if (sourceRoot) {
    const local = path.resolve(sourceRoot, repository.auditFolder || project.id);
    if (!existsSync(path.join(local, ".git"))) throw new Error(`Local audit repository not found: ${local}`);
    return local;
  }

  mkdirSync(CACHE_DIR, { recursive: true });
  const local = path.join(CACHE_DIR, repository.auditFolder || project.id);
  const url = `https://github.com/${repository.owner}/${repository.name}.git`;
  if (!existsSync(path.join(local, ".git"))) {
    runGit(["clone", "--depth", "1", "--branch", repository.branch, url, local], { inherit: true });
  } else {
    runGit(["-C", local, "pull", "--ff-only", "origin", repository.branch], { inherit: true });
  }
  return local;
}

export function walkFiles(root, current = root, output = [], statFile = statSync) {
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = path.join(current, entry.name);
    const relative = path.relative(root, full).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) walkFiles(root, full, output, statFile);
      continue;
    }
    if (IGNORED_FILES.test(relative) || IGNORED_SUFFIXES.test(relative) || !INDEXABLE_SUFFIXES.test(relative)) continue;
    let size;
    try {
      size = statFile(full).size;
    } catch {
      continue;
    }
    if (size > 350_000) continue;
    output.push({ full, relative, size });
  }
  return output;
}

function languageFor(file) {
  const extension = path.extname(file).slice(1).toLowerCase();
  return ({ mjs: "javascript", cjs: "javascript", js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript", py: "python", md: "markdown", yml: "yaml", yaml: "yaml" })[extension] || extension || "text";
}

function baseChunkType(file) {
  const lower = file.toLowerCase();
  if (/(^|\/)readme(?:\.|$)/.test(lower)) return "readme";
  if (/(^|\/)(?:test|tests|__tests__|spec)(?:\/|\.)|\.(?:test|spec)\./.test(lower)) return "test";
  if (/(^|\/)(?:package\.json|pyproject\.toml|requirements.*\.txt|dockerfile|vercel\.json|.*\.ya?ml|.*\.toml)$/.test(lower)) return "config";
  if (/\.(?:json|ya?ml|toml)$/.test(lower)) return "data";
  return "source";
}

function detectImplementationStatus(file, content, chunkType) {
  const text = `${file}\n${content}`.toLowerCase();
  if (/mock|simulat|placeholder|dummy|fake data|math\.random/.test(text)) return "simulated";
  if (/todo|fixme|not implemented|coming soon/.test(text)) return "partial";
  if (chunkType === "test") return "tested";
  if (chunkType === "readme") return "documented";
  if (chunkType === "config") return "configured";
  return "implemented";
}

function detectSymbol(line) {
  const patterns = [
    { type: "route", regex: /\b(?:app|router)\.(?:get|post|put|patch|delete)\s*\(\s*["'`]([^"'`]+)/ },
    { type: "class", regex: /\bclass\s+([A-Za-z_$][\w$]*)/ },
    { type: "function", regex: /\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
    { type: "function", regex: /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/ },
    { type: "component", regex: /\bexport\s+default\s+function\s+([A-Z][\w$]*)/ },
    { type: "function", regex: /^\s*(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/ },
    { type: "class", regex: /^\s*class\s+([A-Za-z_][\w]*)/ },
    { type: "function", regex: /^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_][\w]*)\s*\(/ }
  ];
  for (const pattern of patterns) {
    const match = line.match(pattern.regex);
    if (match) return { chunkType: pattern.type, symbolName: match[1] };
  }
  return null;
}

function chunkMarkdown(lines) {
  const starts = [];
  lines.forEach((line, index) => { if (/^#{1,4}\s+/.test(line)) starts.push(index); });
  if (!starts.length) return [];
  return starts.map((start, position) => ({
    start,
    end: Math.min(starts[position + 1] ?? lines.length, start + 100),
    chunkType: "readme",
    symbolName: lines[start].replace(/^#+\s*/, "").trim()
  }));
}

function chunkFile(file, content) {
  const lines = content.split(/\r?\n/);
  const defaultType = baseChunkType(file);
  if (defaultType === "readme") {
    const markdown = chunkMarkdown(lines);
    if (markdown.length) return markdown;
  }

  const starts = [];
  lines.forEach((line, index) => {
    const symbol = detectSymbol(line);
    if (symbol) starts.push({ start: index, ...symbol });
  });

  if (!starts.length) {
    const chunks = [];
    for (let start = 0; start < lines.length; start += 90) {
      chunks.push({ start, end: Math.min(lines.length, start + 110), chunkType: defaultType, symbolName: "" });
    }
    return chunks.slice(0, 8);
  }

  return starts.slice(0, 80).map((item, position) => ({
    ...item,
    end: Math.min(starts[position + 1]?.start ?? lines.length, item.start + 120)
  }));
}

function containsSecret(content) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(content));
}

function makeSourceUrl(repository, commit, relative) {
  return `https://github.com/${repository.owner}/${repository.name}/blob/${commit}/${relative.split("/").map(encodeURIComponent).join("/")}`;
}

function filePriority(file, project) {
  if ((project.sourceCodeLocations || []).some((important) => file.relative === important || file.relative.startsWith(`${important}/`))) return 100;
  const type = baseChunkType(file.relative);
  if (type === "test") return 80;
  if (type === "config") return 70;
  if (type === "source") return 50;
  if (type === "data") return 30;
  return 10;
}

function renderProjectDoc(project) {
  const list = (items) => items?.length ? items.map((item) => `- ${item}`).join("\n") : "- Aucun élément vérifié.";
  const repositories = project.repositories?.length
    ? project.repositories.map((repo) => {
        const policy = repo.indexPolicy === "metadata-only" ? "; métadonnées uniquement" : "";
        const license = repo.licenseStatus ? `; licence: ${repo.licenseStatus}` : "";
        return `- https://github.com/${repo.owner}/${repo.name} (${repo.branch}${policy}${license})`;
      }).join("\n")
    : "- État du code non vérifié: aucun dépôt lié accessible.";
  return `# ${project.title}\n\n` +
    `## Statut vérifié\n${project.status} - vérifié le ${project.lastVerified}.\n\n` +
    `## Résumé prudent\n${project.summary}\n\n` +
    `## Ce qui fonctionne réellement\n${list(project.implemented)}\n\n` +
    `## Ce qui est partiellement implémenté\n${list(project.partiallyImplemented)}\n\n` +
    `## Ce qui est simulé\n${list(project.simulated)}\n\n` +
    `## Ce qui n'est pas encore implémenté\n${list(project.notImplemented)}\n\n` +
    `## Architecture\n${list(project.architecture)}\n\n` +
    `## Fichiers importants\n${list(project.sourceCodeLocations)}\n\n` +
    `## Technologies observées\n${list(project.technologies)}\n\n` +
    `## Contribution de Nicolas\n${list(project.contribution)}\n\n` +
    `## Assistance IA\n${project.aiAssistance || "Non documentée."}\n\n` +
    `## Composants tiers\n${list(project.thirdPartyComponents)}\n\n` +
    `## Limites\n${list(project.currentLimitations)}\n\n` +
    `## Affirmations sûres\n${list(project.safeClaims)}\n\n` +
    `## Affirmations interdites\n${list(project.forbiddenClaims)}\n\n` +
    `## Divergences README / code\n${list(project.readmeDivergences)}\n\n` +
    `## Dépôt et démonstration\n${repositories}\n${project.liveDemoUrl ? `- Démonstration: ${project.liveDemoUrl}` : "- Aucune démonstration liée."}\n`;
}

function main() {
  const sourceRoot = parseArg("--source-root") || process.env.RAG_PROJECTS_ROOT || "";
  const knowledgeBase = JSON.parse(readFileSync(KB_PATH, "utf8"));
  const chunks = [];
  const report = {
    generatedAt: `${knowledgeBase.lastVerified}T00:00:00.000Z`,
    projectsIndexed: [],
    repositoriesAccessible: [],
    repositoriesMissing: [],
    filesAnalyzed: 0,
    chunksGenerated: 0,
    symbolsDetected: 0,
    routesDetected: 0,
    testsDetected: 0,
    ambiguousStatuses: [],
    metadataOnlyRepositories: [],
    suspiciousInstructionChunks: [],
    skippedSensitiveFiles: [],
    errors: []
  };

  mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });

  for (const project of knowledgeBase.projects || []) {
    writeFileSync(path.join(DOCS_DIR, `${project.id}.md`), renderProjectDoc(project), "utf8");
    if (!project.repositories?.length) {
      report.ambiguousStatuses.push({ projectId: project.id, reason: "No auditable repository linked" });
      continue;
    }

    let projectIndexed = false;
    let projectChunkCount = 0;
    const projectChunkFingerprints = new Set();
    for (const repository of project.repositories) {
      const repositoryName = `${repository.owner}/${repository.name}`;
      try {
        const local = ensureRepository(project, repository, sourceRoot);
        const branch = runGit(["-C", local, "branch", "--show-current"]) || repository.branch;
        const commit = runGit(["-C", local, "rev-parse", "HEAD"]);
        report.repositoriesAccessible.push({
          projectId: project.id,
          repository: repositoryName,
          branch,
          commit,
          indexPolicy: repository.indexPolicy || "code",
          licenseStatus: repository.licenseStatus || "not-documented"
        });

        if (repository.indexPolicy === "metadata-only") {
          const metadataContent = JSON.stringify({
            project: project.title,
            status: project.status,
            summary: project.summary,
            implemented: project.implemented,
            partiallyImplemented: project.partiallyImplemented,
            currentLimitations: project.currentLimitations,
            architecture: project.architecture,
            contribution: project.contribution,
            repository: repositoryName,
            ownership: repository.ownership || "not verified",
            contributionEvidence: repository.contributionEvidence || "not documented",
            licenseStatus: repository.licenseStatus || "not documented"
          }).slice(0, 1800);
          chunks.push({
            id: `${project.id}:${repository.name}:repository-metadata`,
            projectId: project.id,
            projectTitle: project.title,
            repository: repositoryName,
            branch,
            path: "repository-metadata",
            language: "text",
            symbolName: "",
            chunkType: "repository-metadata",
            implementationStatus: project.status,
            sourceUrl: `https://github.com/${repository.owner}/${repository.name}/tree/${commit}`,
            lastIndexedCommit: commit,
            lineStart: 0,
            lineEnd: 0,
            suspiciousInstructionLike: false,
            content: metadataContent
          });
          report.metadataOnlyRepositories.push({
            projectId: project.id,
            repository: repositoryName,
            reason: repository.licenseStatus || "raw code reuse not authorized"
          });
          projectChunkCount += 1;
          projectIndexed = true;
          continue;
        }

        const files = walkFiles(local).sort((a, b) => filePriority(b, project) - filePriority(a, project) || a.relative.localeCompare(b.relative));
        for (const file of files) {
          const content = readFileSync(file.full, "utf8").replace(/\0/g, "");
          if (!content.trim() || containsSecret(content)) {
            if (containsSecret(content)) report.skippedSensitiveFiles.push({ repository: repositoryName, path: file.relative });
            continue;
          }
          const lines = content.split(/\r?\n/);
          const averageLineLength = content.length / Math.max(1, lines.length);
          if (averageLineLength > 500) continue;

          report.filesAnalyzed += 1;
          for (const logical of chunkFile(file.relative, content)) {
            if (projectChunkCount >= 120) break;
            const excerpt = lines.slice(logical.start, logical.end).join("\n").trim();
            if (excerpt.length < 30) continue;
            const fingerprint = excerpt.replace(/\s+/g, " ").slice(0, 700);
            if (projectChunkFingerprints.has(fingerprint)) continue;
            projectChunkFingerprints.add(fingerprint);
            const chunkType = logical.chunkType || baseChunkType(file.relative);
            const implementationStatus = detectImplementationStatus(file.relative, excerpt, chunkType);
            const suspiciousInstructionLike = containsInstructionLikeContent(excerpt);
            chunks.push({
              id: `${project.id}:${repository.name}:${file.relative}:${logical.start + 1}`,
              projectId: project.id,
              projectTitle: project.title,
              repository: repositoryName,
              branch,
              path: file.relative,
              language: languageFor(file.relative),
              symbolName: logical.symbolName || "",
              chunkType,
              implementationStatus,
              sourceUrl: makeSourceUrl(repository, commit, file.relative),
              lastIndexedCommit: commit,
              lineStart: logical.start + 1,
              lineEnd: logical.end,
              suspiciousInstructionLike,
              content: excerpt.slice(0, 1800)
            });
            if (suspiciousInstructionLike) {
              report.suspiciousInstructionChunks.push({
                projectId: project.id,
                repository: repositoryName,
                path: file.relative,
                lineStart: logical.start + 1
              });
            }
            projectChunkCount += 1;
            if (logical.symbolName) report.symbolsDetected += 1;
            if (chunkType === "route") report.routesDetected += 1;
            if (chunkType === "test") report.testsDetected += 1;
          }
        }
        projectIndexed = true;
      } catch (error) {
        report.repositoriesMissing.push({ projectId: project.id, repository: repositoryName });
        report.errors.push({ projectId: project.id, repository: repositoryName, message: error.message });
      }
    }
    if (projectIndexed) report.projectsIndexed.push(project.id);
  }

  report.chunksGenerated = chunks.length;
  const index = {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    sourceKnowledgeBase: "/data/rag-knowledge-base.json",
    projects: report.projectsIndexed,
    chunks
  };
  writeFileSync(INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log(`Indexed ${report.projectsIndexed.length} projects from ${report.repositoriesAccessible.length} repositories.`);
  console.log(`Analyzed ${report.filesAnalyzed} files and generated ${report.chunksGenerated} logical chunks.`);
  console.log(`Missing repositories: ${report.repositoriesMissing.length}; errors: ${report.errors.length}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
