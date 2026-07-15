import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = path.join(root, "public/data/rag-knowledge-base.json");
const target = path.join(root, "public/profile.json");
const knowledgeBase = JSON.parse(readFileSync(source, "utf8"));

const profile = {
  schemaVersion: knowledgeBase.schemaVersion,
  generatedFrom: "/data/rag-knowledge-base.json",
  generatedAt: `${knowledgeBase.lastVerified}T00:00:00.000Z`,
  ...knowledgeBase.profile
};

writeFileSync(target, `${JSON.stringify(profile, null, 2)}\n`, "utf8");
console.log("Generated public/profile.json from the RAG knowledge base.");
