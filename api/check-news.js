// api/check-news.js
export default async function handler(req, res) {
  try {
    const runKey = (req.query.run_key || "").trim();
    if (!runKey) {
      res.status(400).json({ error: "Missing run_key" });
      return;
    }

    // fallback envs
    const owner  = process.env.GH_REPO_OWNER || process.env.GITHUB_OWNER || "";
    const repo   = process.env.GH_REPO_NAME  || process.env.GITHUB_REPO  || "";
    const file   = process.env.GH_WORKFLOW_FILE || ".github/workflows/build-news.yml";
    const token  = process.env.GH_WORKFLOW_TOKEN || process.env.GITHUB_TOKEN || "";

    const missing = [];
    if (!owner) missing.push("GH_REPO_OWNER|GITHUB_OWNER");
    if (!repo)  missing.push("GH_REPO_NAME|GITHUB_REPO");
    if (!file)  missing.push("GH_WORKFLOW_FILE");
    if (!token) missing.push("GH_WORKFLOW_TOKEN|GITHUB_TOKEN");
    if (missing.length) {
      res.status(400).json({ error: "Missing GitHub env vars", missing, found:false });
      return;
    }

    // 1) Lire l'id du workflow
    const wfResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    if (!wfResp.ok) {
      const txt = await wfResp.text().catch(()=> "");
      res.status(502).json({ error: "Cannot read workflow", status: wfResp.status, details: txt });
      return;
    }
    const wf = await wfResp.json();
    const workflowId = wf.id;

    // 2) Lister les runs (les plus récents)
    const runsResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=20`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    if (!runsResp.ok) {
      const txt = await runsResp.text().catch(()=> "");
      res.status(502).json({ error: "Cannot list runs", status: runsResp.status, details: txt });
      return;
    }
    const j = await runsResp.json();

    // 3) Trouver le run par le run-name (run_key)
    const run = (j.workflow_runs || []).find(r =>
      (r.display_title && r.display_title.includes(runKey)) ||
      (r.head_commit && r.head_commit.message && r.head_commit.message.includes(runKey))
    );

    if (!run) {
      res.status(200).json({ found:false, status:"unknown" });
      return;
    }

    res.status(200).json({
      found: true,
      id: run.id,
      status: run.status,         // queued | in_progress | completed
      conclusion: run.conclusion, // success | failure | cancelled | null si pas fini
      html_url: run.html_url
    });
  } catch (e) {
    res.status(500).json({ error: e.message || "unexpected" });
  }
}
