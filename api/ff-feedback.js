// /api/ff-feedback.js — Vercel serverless (Node 18+, ESM)
// Append JSONL dans un repo GitHub via la Contents API, avec diagnostics détaillés.
//
// Debug mode :
//  - Env: set FF_DEBUG=1
//  - Ou URL: /api/ff-feedback?debug=on
//
// Requis (Vercel → Project Settings → Environment Variables):
//  - GITHUB_TOKEN   : PAT ayant accès au repo (classic: repo|public_repo; fine-grained: Contents Read&Write)
//  - GITHUB_OWNER   : ex. "Nix177"
//  - GITHUB_REPO    : ex. "CV"
//  - (optionnel) GITHUB_BRANCH : défaut "main"
//
// Entrée (POST JSON):
//  { text: "...", page?: "...", lang?: "fr", ua?: "...", extra?: {...} }
//
// Sortie (200):
//  { ok:true, path:"data/ff-feedback/2025-10.jsonl", bytes:123, requestId:"abcd1234" }
//  + si debug: { envOk:{...}, step:"...", git:{...}, ... }

const fetch = globalThis.fetch;

function cors(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (data?.__requestId) res.setHeader('X-Request-Id', data.__requestId);
  res.end(JSON.stringify(data));
}

function ok(res, data){ send(res, 200, data); }
function bad(res, code, msg, extra={}){
  const out = { ok:false, error: msg || 'error', ...extra };
  send(res, code || 500, out);
}

function clip(s, n=500){ return (s||'').toString().slice(0, n); }
function safeBool(x){ return !!x; }

function parseUrl(req) {
  try {
    // req.url est en chemin relatif; base factice
    return new URL(req.url || '/', 'http://localhost');
  } catch { return new URL('http://localhost/'); }
}

function logDebug(DEBUG, reqId, step, obj={}) {
  if (!DEBUG) return;
  const base = {
    tag: 'ff-feedback',
    requestId: reqId,
    step,
    ts: new Date().toISOString(),
  };
  try {
    console.log(JSON.stringify({ ...base, ...obj }));
  } catch {
    console.log({ ...base, ...obj });
  }
}

async function getFile(owner, repo, path, branch, token, DEBUG, reqId) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'nicolastuor-ch/ff-feedback',
      Accept: 'application/vnd.github+json'
    }
  });
  const hdr = Object.fromEntries([...r.headers.entries()].map(([k,v])=>[k, clip(v,200)]));
  logDebug(DEBUG, reqId, 'github.get.resp', { status: r.status, headers: hdr, url });

  if (r.status === 404) return { exists:false };
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`github_get_failed(${r.status}): ${clip(text, 800)}`);
  }
  let j; try { j = JSON.parse(text); } catch {
    throw new Error(`github_get_parse_failed(${r.status})`);
  }
  const contentB64 = (j.content || '').replace(/\n/g, '');
  return {
    exists: true,
    sha: j.sha,
    contentB64,
    encoding: j.encoding || 'base64',
  };
}

async function putFile(owner, repo, path, branch, token, content, sha, message, DEBUG, reqId) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = { message, content: Buffer.from(content, 'utf8').toString('base64'), branch };
  if (sha) body.sha = sha;

  logDebug(DEBUG, reqId, 'github.put.req', { path, branch, hasSha: !!sha, bytes: content.length });

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'nicolastuor-ch/ff-feedback',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify(body)
  });

  const respText = await r.text();
  const hdr = Object.fromEntries([...r.headers.entries()].map(([k,v])=>[k, clip(v,200)]));
  logDebug(DEBUG, reqId, 'github.put.resp', { status: r.status, headers: hdr, bodyClip: clip(respText, 800) });

  if (!r.ok) throw new Error(`github_put_failed(${r.status}): ${clip(respText, 800)}`);

  let j; try { j = JSON.parse(respText); } catch { j = {}; }
  return j;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return ok(res, { ok:true });

  const url = parseUrl(req);
  const DEBUG = process.env.FF_DEBUG === '1' || /[?&]debug=on\b/i.test(url.search);
  const requestId = Math.random().toString(36).slice(2, 10);

  // Logs d’entrée
  logDebug(DEBUG, requestId, 'request.start', {
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': clip(req.headers['user-agent'], 200),
      'x-forwarded-for': clip(req.headers['x-forwarded-for'], 200),
      'referer': clip(req.headers['referer'], 200),
      'host': clip(req.headers['host'], 200),
    }
  });

  if (req.method !== 'POST') {
    return bad(res, 405, 'Method not allowed', { __requestId: requestId });
  }

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH='main' } = process.env;
  const envOk = {
    TOKEN:  safeBool(GITHUB_TOKEN),
    OWNER:  safeBool(GITHUB_OWNER),
    REPO:   safeBool(GITHUB_REPO),
    BRANCH: clip(GITHUB_BRANCH, 40)
  };
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    logDebug(DEBUG, requestId, 'env.missing', envOk);
    return bad(res, 500, 'Missing GitHub env', { __requestId: requestId, envOk: DEBUG ? envOk : undefined });
  }

  try {
    // Lecture corps JSON
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const raw = Buffer.concat(chunks).toString('utf8');

    let body = {};
    try { body = JSON.parse(raw || '{}'); }
    catch (e) {
      logDebug(DEBUG, requestId, 'json.parse.error', { rawClip: clip(raw, 500), msg: e.message });
      return bad(res, 400, 'invalid_json', { __requestId: requestId, detail: DEBUG ? clip(e.message, 200) : undefined });
    }

    const text = (body.text ?? body.message ?? '').toString().trim();
    if (!text) {
      logDebug(DEBUG, requestId, 'validation.empty', { bodyKeys: Object.keys(body || {}) });
      return bad(res, 400, 'empty', { __requestId: requestId });
    }

    const lang = (body.lang || (req.headers['accept-language']||'').slice(0,2) || 'fr').toString().slice(0,5);
    const page = (body.page || body.pageUrl || req.headers['referer'] || '').toString().slice(0, 300);
    const ua   = (body.ua   || req.headers['user-agent'] || '').toString().slice(0, 256);
    const ip   = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.socket?.remoteAddress || '';

    const now  = new Date();
    const yyyy = now.getUTCFullYear();
    const mm   = String(now.getUTCMonth()+1).padStart(2, '0');
    const iso  = now.toISOString();

    const line = JSON.stringify({ ts: iso, lang, page, ua, ip, text, extra: body.extra ?? null }) + '\n';
    const path = `data/ff-feedback/${yyyy}-${mm}.jsonl`;

    logDebug(DEBUG, requestId, 'compose.line', { path, bytes: line.length, lang, pageClip: clip(page, 200) });

    // Récupération éventuelle du fichier existant
    let existed = false, sha = null, prev = '';
    try {
      const got = await getFile(GITHUB_OWNER, GITHUB_REPO, path, GITHUB_BRANCH, GITHUB_TOKEN, DEBUG, requestId);
      if (got.exists) {
        existed = true; sha = got.sha;
        prev = Buffer.from(got.contentB64 || '', got.encoding || 'base64').toString('utf8');
        logDebug(DEBUG, requestId, 'github.get.ok', { existed, prevBytes: prev.length, sha: clip(sha, 12) });
      } else {
        logDebug(DEBUG, requestId, 'github.get.404', { existed: false });
      }
    } catch (e) {
      // On laisse continuer: si GET plante autrement que 404, on verra au PUT
      logDebug(DEBUG, requestId, 'github.get.error', { msg: clip(e.message, 400) });
    }

    // Ecriture (create/update)
    await putFile(
      GITHUB_OWNER, GITHUB_REPO, path, GITHUB_BRANCH, GITHUB_TOKEN,
      (prev || '') + line,
      existed ? sha : null,
      'chore: append feedback',
      DEBUG, requestId
    );

    return ok(res, {
      ok: true,
      path,
      bytes: line.length,
      __requestId: requestId,
      ...(DEBUG ? { envOk, page, lang } : {})
    });
  } catch (e) {
    // Réponse contrôlée + logs
    logDebug(DEBUG, requestId, 'fatal', { msg: clip(e.message, 600), stack: DEBUG ? clip(e.stack, 1000) : undefined });
    return bad(res, 500, 'ff-feedback failed', {
      __requestId: requestId,
      step: 'fatal',
      detail: DEBUG ? clip(e.message, 600) : undefined
    });
  }
}
