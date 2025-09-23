// api/ff-feedback.js
// Ajoute chaque message en JSONL dans feedback/ff-YYYY-MM.jsonl via GitHub API.
// Si non configuré (GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO), on log et on renvoie 202.

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
    console.log('[ff-feedback]', item);
    return new Response(JSON.stringify({ ok:true, stored:false }), {
      status: 202, headers: { 'content-type': 'application/json' }
    });
  }

  const y = new Date().toISOString().slice(0,7); // "YYYY-MM"
  const path = `feedback/ff-${y}.jsonl`;

  // Récupère le fichier courant (pour obtenir le sha), sinon créera
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  let sha = null, currentContent = '';
  const getRes = await fetch(getUrl, { headers:{ Authorization:`Bearer ${token}`, 'User-Agent':'ff-bot' } });
  if (getRes.ok) {
    const data = await getRes.json();
    sha = data.sha;
    currentContent = Buffer.from(data.content || '', 'base64').toString('utf8');
  }

  const nextContent = (currentContent ? currentContent + '\n' : '') + JSON.stringify(item);
  const putRes = await fetch(getUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'ff-bot',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `feedback: ${item.pageTitle || '(no title)'} — ${item.ts}`,
      content: Buffer.from(nextContent, 'utf8').toString('base64'),
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
