// /api/ff-feedback.js
// Append JSONL to data/ff-feedback/YYYY-MM.jsonl in your GitHub repo.
// Requires: GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, (optional) GITHUB_BRANCH, ALLOWED_ORIGINS

const fetch = global.fetch;

const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (!ALLOWED.length || ALLOWED.some(p => origin.endsWith(p.replace(/^\*\./, '')) || origin === p)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function ok(res, data) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function bad(res, code, msg) {
  res.statusCode = code || 500;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: msg || 'error' }));
}

async function getFile(owner, repo, path, branch, token) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'nicolastuor-ch/ff-feedback' } });
  if (r.status === 404) return { exists: false };
  if (!r.ok) throw new Error('github_get_failed');
  const j = await r.json();
  return { exists: true, sha: j.sha, contentB64: j.content, encoding: j.encoding };
}

async function putFile(owner, repo, path, branch, token, content, sha = null, message = 'chore: append feedback') {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;
  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'nicolastuor-ch/ff-feedback',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`github_put_failed(${r.status})`);
  return r.json();
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return ok(res, { ok: true });
  if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');

  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH = 'main' } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    return bad(res, 500, 'Missing GitHub env');
  }

  try {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

    const text = (body.text || '').toString().trim();
    const lang = (body.lang || 'fr').toString().slice(0, 5);
    const page = (body.page || '').toString().slice(0, 200);
    const tz = (body.tz || '').toString().slice(0, 64);
    const ua = (body.ua || '').toString().slice(0, 256);
    const ip =
      req.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '';

    if (!text || text.length < 2) return bad(res, 400, 'empty');

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const iso = now.toISOString();

    const line = JSON.stringify({ ts: iso, lang, page, tz, ua, ip, text }) + '\n';
    const filePath = `data/ff-feedback/${yyyy}-${mm}.jsonl`;

    // récupère contenu existant (si existe)
    let existed = false;
    let sha = null;
    let prev = '';
    try {
      const got = await getFile(GITHUB_OWNER, GITHUB_REPO, filePath, GITHUB_BRANCH, GITHUB_TOKEN);
      if (got.exists) {
        existed = true;
        sha = got.sha;
        const buff = Buffer.from(got.contentB64, got.encoding || 'base64');
        prev = buff.toString('utf8');
      }
    } catch (_) {
      // ignorer, on créera le fichier
    }

    const next = (prev || '') + line;
    await putFile(GITHUB_OWNER, GITHUB_REPO, filePath, GITHUB_BRANCH, GITHUB_TOKEN, next, existed ? sha : null, 'chore: append feedback');

    return ok(res, { ok: true });
  } catch (e) {
    return bad(res, 500, `ff-feedback failed: ${e.message}`);
  }
};
