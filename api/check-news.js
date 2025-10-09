// api/check-news.js
export default async function handler(req, res) {
  try {
    const runKey = (req.query.run_key || "").trim();
    if (!runKey) return res.status(400).json({ error: "Missing run_key" });

    const owner  = process.env.GH_REPO_OWNER || process.env.GITHUB_OWNER || "";
    const repo   = process.env.GH_REPO_NAME  || process.env.GITHUB_REPO  || "";
    const fileIn = process.env.GH_WORKFLOW_FILE || "build-news.yml";
    const token  = process.env.GH_WORKFLOW_TOKEN || process.env.GITHUB_TOKEN || "";

    const workflowFile = fileIn.split("/").pop();

    const missing = [];
    if (!owner) missing.push("GH_REPO_OWNER|GITHUB_OWNER");
    if (!repo)  missing.push("GH_REPO_NAME|GITHUB_REPO");
    if (!token) missing.push("GH_WORKFLOW_TOKEN|GITHUB_TOKEN");
    if (!workflowFile) missing.push("GH_WORKFLOW_FILE");
    if (missing.length) {
      return res.status(400).json({ error: "Missing GitHub env vars", missing, found:false });
    }

    // 1) Récupère la liste des workflows et trouve l'ID par nom de fichier
    const list = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    if (!list.ok) {
      const txt = await list.text().catch(()=> "");
      return res.status(502).json({ error:"Cannot list workflows", status:list.status, details:txt });
    }
    const all = await list.json();
    const wf = (all.workflows || []).find(w => (w.path || "").endsWith("/" + workflowFile) || w.name === workflowFile || w.file_name === workflowFile);
    if (!wf) return res.status(200).json({ found:false, status:"unknown", note:`workflow ${workflowFile} not found` });

    // 2) Récupère les runs récents
    const runsResp = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${wf.id}/runs?per_page=20`,
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
      return res.status(502).json({ error:"Cannot list runs", status:runsResp.status, details:txt });
    }
    const j = await runsResp.json();

    // 3) Trouve le run contenant la run_key dans le run-name (display_title)
    const run = (j.workflow_runs || []).find(r =>
      (r.display_title && r.display_title.includes(runKey)) ||
      (r.head_commit && r.head_commit.message && r.head_commit.message.includes(runKey))
    );

    if (!run) return res.status(200).json({ found:false, status:"unknown" });

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
