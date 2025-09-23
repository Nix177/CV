// api/ff-feedback.js — Edge Runtime
// Stocke le feedback dans GitHub (JSONL mois par mois) sinon renvoie 202
export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  let body = {};
  try { body = await req.json(); } catch {}
  const item = {
    message: String(body.message || '').slice(0, 5000),
    pageUrl: String(body.pageUrl || ''),
    pageTitle: String(body.pageTitle || ''),
    userAgent: String(body.userAgent || ''),
    ts: new Date().toISOString(),
    ip: req.headers.get('x-forwarded-for') || ''
  };

  const token  = process.env.GITHUB_TOKEN;
  const owner  = process.env.GITHUB_OWNER;
  const repo   = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  // Si non configuré → 202
  if (!token || !owner || !repo) {
    console.warn('[ff-feedback] missing env, payload:', item);
    return ok({ ok:true, stored:false }, 202);
  }

  const y = new Date().toISOString().slice(0,7); // "YYYY-MM"
  const path = `feedback/ff-${y}.jsonl`;
  const url  = (p) => `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}`;
  const hdrs = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'ff-bot',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  let sha = null, currentContent = '';
  try {
    const rGet = await fetch(url(path), { headers: hdrs });
    if (rGet.ok) {
      const j = await rGet.json();
      sha = j.sha || null;
      currentContent = fromBase64(j.content || '');
    }
  } catch (e) {
    // on continue en création
  }

  const next = (currentContent ? currentContent + '\n' : '') + JSON.stringify(item);
  try {
    const rPut = await fetch(url(path), {
      method: 'PUT',
      headers: hdrs,
      body: JSON.stringify({
        message: `feedback: ${item.pageTitle || '(no title)'} — ${item.ts}`,
        content: toBase64(next),
        sha,
        branch
      })
    });
    if (!rPut.ok) {
      const t = await rPut.text();
      console.error('[ff-feedback] GitHub PUT failed:', rPut.status, t);
      // Ne casse pas l’UX: 202
      return ok({ ok:true, stored:false }, 202);
    }
  } catch (e) {
    console.error('[ff-feedback] GitHub error:', e?.message || e);
    return ok({ ok:true, stored:false }, 202);
  }

  return ok({ ok:true, stored:true }, 200);
}

/* helpers Edge */
function ok(obj, status=200){
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}
function toBase64(str){ return btoa(unescape(encodeURIComponent(str))); }
function fromBase64(b64){ try{ return decodeURIComponent(escape(atob(b64))); }catch{ return ''; } }
