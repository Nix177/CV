import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(repoRoot, "public");
const port = Number(process.env.PORT || process.argv[2] || 3001);

function loadLocalEnv() {
  const envPath = path.join(repoRoot, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".glb": "model/gltf-binary",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".mp3": "audio/mpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp"
  }[extension] || "application/octet-stream";
}

function decorateVercelResponse(response) {
  response.status = (statusCode) => {
    response.statusCode = statusCode;
    return response;
  };
  response.json = (value) => {
    if (!response.headersSent) response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(value));
  };
  return response;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return undefined;
  const text = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(text); } catch { return text; }
}

function resolveStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const withIndex = decoded === "/" ? "/index.html" : decoded;
  const candidates = [withIndex];
  if (!path.extname(withIndex)) candidates.push(`${withIndex}.html`, path.join(withIndex, "index.html"));

  for (const candidate of candidates) {
    const absolute = path.resolve(publicRoot, `.${candidate}`);
    if (!absolute.startsWith(`${publicRoot}${path.sep}`) && absolute !== publicRoot) continue;
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) return absolute;
  }
  return null;
}

loadLocalEnv();
const { default: liveTokenHandler } = await import("../api/live-token.js");

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || `localhost:${port}`}`);
    if (url.pathname === "/api/live-token") {
      request.body = await readRequestBody(request);
      await liveTokenHandler(request, decorateVercelResponse(response));
      return;
    }

    const filePath = resolveStaticPath(url.pathname);
    if (!filePath) {
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Not found");
      return;
    }

    response.statusCode = 200;
    response.setHeader("Content-Type", contentType(filePath));
    response.setHeader("Cache-Control", "no-store");
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    console.error("Voice preview server error", error);
    if (!response.headersSent) response.statusCode = 500;
    response.end("Local preview server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Voice assistant preview: http://localhost:${port}/prototypes/voice-assistant-preview.html`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
