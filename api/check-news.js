export default async function handler(req, res) {
  try {
    const { run_key } = req.query || {};
    if (!run_key) {
      res.status(400).json({ error: "Missing run_key" });
      return;
    }
    const owner = process.env.GH_REPO_OWNER;
    const repo  = process.env.GH_REPO_NAME;
    const file  = process.env.GH_WORKFLOW_FILE || ".github/workflows/build-news.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;
    if (!owner || !repo || !file || !token) {
      res.status(500).json({ error: "Missing GH_* env vars on server" });
      return;
    }

    // Récupère les runs de ce workflow et filtre par run-name qui contient run_key
    const runsUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/runs?per_page=20&event=workflow_dispatch`;
    const r = await fetch(runsUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });
    if (!r.ok) {
      const txt = await r.text().catch(()=> "");
      res.status(502).json({ error: "GitHub runs fetch failed", status: r.status, details: txt });
      return;
    }
    const data = await r.json();
    const run = (data.workflow_runs || []).find(x => (x.name || "").includes(run_key));
    if (!run) {
      res.status(200).json({ found: false, status: "queued" });
      return;
    }

    res.status(200).json({
      found: true,
      id: run.id,
      name: run.name,
      status: run.status,        // queued|in_progress|completed
      conclusion: run.conclusion, // success|failure|cancelled|null
      html_url: run.html_url,
      updated_at: run.updated_at
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "unexpected" });
  }
}
