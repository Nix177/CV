export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }
    const {
      use_openai = true,
      profile = "balanced",
      score_min = "65",
      min_publish = "12",
      output_cap = "60",
      max_items = "100",
      custom_weights = "",   // "R,P,I,M"
      run_key
    } = req.body || {};

    const owner = process.env.GH_REPO_OWNER;
    const repo  = process.env.GH_REPO_NAME;
    const file  = process.env.GH_WORKFLOW_FILE || ".github/workflows/build-news.yml";
    const token = process.env.GH_WORKFLOW_TOKEN;

    if (!owner || !repo || !file || !token) {
      res.status(500).json({ error: "Missing GH_* env vars on server" });
      return;
    }

    const key = run_key || (Date.now().toString(36) + Math.random().toString(36).slice(2,8));

    const body = {
      ref: "main",
      inputs: {
        use_openai: String(use_openai) === "false" ? "false" : "true",
        profile,
        score_min: String(score_min),
        min_publish: String(min_publish),
        output_cap: String(output_cap),
        max_items: String(max_items),
        custom_weights: String(custom_weights || ""),
        run_key: key
      }
    };

    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(file)}/dispatches`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (r.status !== 204) {
      const txt = await r.text().catch(()=> "");
      res.status(502).json({ error: "GitHub dispatch failed", status: r.status, details: txt });
      return;
    }

    res.status(200).json({ ok: true, run_key: key });
  } catch (e) {
    res.status(500).json({ error: e.message || "unexpected" });
  }
}
