// api/ff-feedback.js
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
  };

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) {
    console.log('[ff-feedback]', item); // pas de secrets -> OK en 202
    return new Response(JSON.stringify({ ok:true, stored:false }), {
      status: 202, headers: { 'content-type': 'application/json' }
    });
  }

  const y = new Date().toISOString().slice(0,7); // "YYYY-MM"
  const path = `feedback/ff-${y}.jsonl`;
  const api = (p) => `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(p)}`;
  const hdrs = {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'ff-bot',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  // Récupère pour obtenir le sha + contenu courant
  let sha = null, currentContent = '';
  const getRes = await fetch(api(path), { headers: hdrs });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha || null;
    currentContent = fromBase64(data.content || '');
  }

  const nextContent = (currentContent ? currentContent + '\n' : '') + JSON.stringify(item);
  const putRes = await fetch(api(path), {
    method: 'PUT',
    headers: hdrs,
    body: JSON.stringify({
      message: `feedback: ${item.pageTitle || '(no title)'} — ${item.ts}`,
      content: toBase64(nextContent),
      sha,
      branch: 'main'
    })
  });

  if (!putRes.ok) {
    const t = await putRes.text();
    console.error('[ff-feedback] push failed', t);
    return new Response(JSON.stringify({ ok:false }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok:true }), {
    headers: { 'content-type':'application/json' }
  });
}

// --- helpers base64 (UTF-8 safe) pour Edge runtime ---
function toBase64(str){
  return btoa(unescape(encodeURIComponent(str)));
}
function fromBase64(b64){
  try { return decodeURIComponent(escape(atob(b64))); }
  catch { return ''; }
}
