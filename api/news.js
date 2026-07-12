// api/news.js  (Vercel Serverless - ESM)
export default async function handler(req, res) {
  const action = String(req.query?.action || "feed").toLowerCase();

  if (action === "check") return checkNews(req, res);
  if (action === "env") return showNewsEnvironment(res);
  return serveNewsFeed(req, res);
}

async function serveNewsFeed(req, res) {
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

async function checkNews(req, res) {
  try {
    const runKey = String(req.query?.run_key || "").trim();
    if (!runKey) return res.status(400).json({ error: "Missing run_key" });

    const owner = process.env.GH_REPO_OWNER || process.env.GITHUB_OWNER || "";
    const repo = process.env.GH_REPO_NAME || process.env.GITHUB_REPO || "";
    const fileIn = process.env.GH_WORKFLOW_FILE || "build-news.yml";
    const token = process.env.GH_WORKFLOW_TOKEN || process.env.GITHUB_TOKEN || "";
    const workflowFile = fileIn.split("/").pop();

    const missing = [];
    if (!owner) missing.push("GH_REPO_OWNER|GITHUB_OWNER");
    if (!repo) missing.push("GH_REPO_NAME|GITHUB_REPO");
    if (!token) missing.push("GH_WORKFLOW_TOKEN|GITHUB_TOKEN");
    if (!workflowFile) missing.push("GH_WORKFLOW_FILE");
    if (missing.length) {
      return res.status(400).json({
        error: "Missing GitHub env vars",
        missing,
        found: false
      });
    }

    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
    const workflowsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows`,
      { headers }
    );
    if (!workflowsResponse.ok) {
      const details = await workflowsResponse.text().catch(() => "");
      return res.status(502).json({
        error: "Cannot list workflows",
        status: workflowsResponse.status,
        details
      });
    }

    const workflows = await workflowsResponse.json();
    const workflow = (workflows.workflows || []).find((item) =>
      (item.path || "").endsWith("/" + workflowFile)
      || item.name === workflowFile
      || item.file_name === workflowFile
    );
    if (!workflow) {
      return res.status(200).json({
        found: false,
        status: "unknown",
        note: `workflow ${workflowFile} not found`
      });
    }

    const runsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow.id}/runs?per_page=20`,
      { headers }
    );
    if (!runsResponse.ok) {
      const details = await runsResponse.text().catch(() => "");
      return res.status(502).json({
        error: "Cannot list runs",
        status: runsResponse.status,
        details
      });
    }

    const runs = await runsResponse.json();
    const run = (runs.workflow_runs || []).find((item) =>
      (item.display_title && item.display_title.includes(runKey))
      || (item.head_commit?.message && item.head_commit.message.includes(runKey))
    );
    if (!run) return res.status(200).json({ found: false, status: "unknown" });

    return res.status(200).json({
      found: true,
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "unexpected" });
  }
}

function showNewsEnvironment(res) {
  return res.status(200).json({
    GH_REPO_OWNER: !!process.env.GH_REPO_OWNER,
    GH_REPO_NAME: !!process.env.GH_REPO_NAME,
    GH_WORKFLOW_FILE: !!process.env.GH_WORKFLOW_FILE,
    GH_WORKFLOW_TOKEN: !!process.env.GH_WORKFLOW_TOKEN,
    GH_REPO_BRANCH: process.env.GH_REPO_BRANCH || "main",
    GITHUB_OWNER: !!process.env.GITHUB_OWNER,
    GITHUB_REPO: !!process.env.GITHUB_REPO,
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN
  });
}
