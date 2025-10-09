// api/news.js  (Vercel Serverless - ESM)
export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const profile = String(q.profile || q.p || "balanced").toLowerCase();
    const fname = (profile === "balanced") ? "feed.json" : `feed-${profile}.json`;

    // ⚠ adapte owner/repo/branch au besoin
    const githubRaw = `https://raw.githubusercontent.com/Nix177/CV/main/public/news/${fname}`;

    const r = await fetch(githubRaw, { headers: { "User-Agent": "cv-site-news/1.0" } });
    if (!r.ok) {
      res.status(502).json({ error: "Upstream fetch failed", status: r.status, file: fname });
      return;
    }
    const text = await r.text();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message || "unexpected" });
  }
}
