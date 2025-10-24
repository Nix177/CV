// api/trigger-news.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const bodyIn = (await parseJson(req)) || {};
    const {
      use_openai = true,
      model,
      profile = "balanced",
      score_min = "65",
      min_publish = "12",
      output_cap = "60",
      max_items = "100",
      custom_weights = "",
      // l'UI actuelle envoie ces 3 champs :
      bucket_policy_label = "",
      bucket_policy_desc = "",
      bucket_policy_keywords = "",
      // si jamais tu passes directement un JSON :
      policy_overrides,
      run_key
    } = bodyIn;

    // ---- ENV avec fallback sur tes variables "GITHUB_*" ----
    const owner  = process.env.GH_REPO_OWNER || process.env.GITHUB_OWNER || "";
    const repo   = process.env.GH_REPO_NAME  || process.env.GITHUB_REPO  || "";
    const fileIn = process.env.GH_WORKFLOW_FILE || ".github/workflows/build-news.yml";
    const token  = process.env.GH_WORKFLOW_TOKEN || process.env.GITHUB_TOKEN || "";
    const branch = process.env.GH_REPO_BRANCH || "main";

    const workflowFile = (fileIn || "").split("/").pop();

    const missing = [];
    if (!owner) missing.push("GH_REPO_OWNER|GITHUB_OWNER");
    if (!repo)  missing.push("GH_REPO_NAME|GITHUB_REPO");
    if (!token) missing.push("GH_WORKFLOW_TOKEN|GITHUB_TOKEN");
    if (!workflowFile) missing.push("GH_WORKFLOW_FILE");
    if (missing.length) {
      res.status(400).json({ error: "Missing GitHub env vars", missing });
      return;
    }

    // run_key pour suivre le run
    const key = run_key || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

    // Compacte les overrides en un seul JSON (pour rester <= 10 inputs)
    let po = policy_overrides;
    if (!po) {
      const obj = {
        label: (bucket_policy_label || "").trim(),
        desc: (bucket_policy_desc || "").trim(),
        keywords: (bucket_policy_keywords || "").trim()
      };
      // si tout est vide, on laisse vide pour ne rien envoyer
      if (obj.label || obj.desc || obj.keywords) {
        po = JSON.stringify(obj);
      }
    }

    // Inputs (max 10)
    const inputs = {
      use_openai: String(use_openai) === "false" ? "false" : "true",
      model: model || undefined, // défaut YAML si absent
      profile,
      score_min: String(score_min),
      min_publish: String(min_publish),
      output_cap: String(output_cap),
      max_items: String(max_items),
      custom_weights: String(custom_weights || ""),
      publish_target,   // <= NEW
      run_key: key,
      policy_overrides: po || undefined,
      run_key: key
    };
    Object.keys(inputs).forEach(k => inputs[k] === undefined && delete inputs[k]);

    const payload = { ref: branch, inputs };

    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;
    const r = await fetch(ghUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (r.status !== 204) {
      let details = "";
      try { details = await r.text(); } catch {}
      return res.status(502).json({
        ok: false,
        error: "GitHub dispatch failed",
        status: r.status,
        details: (details || "").slice(0, 1200),
        hint: [
          "Vérifie:",
          "- le token: Actions=Read&Write (ou PAT classic repo+workflow) et SSO autorisé",
          `- le workflow: ${workflowFile} (basename, pas le chemin)`,
          `- la branche ref: ${branch}`,
          "- que le YAML contient bien 'workflow_dispatch'"
        ].join("\n")
      });
    }

    res.status(200).json({ ok: true, run_key: key });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "unexpected" });
  }
}

async function parseJson(req) {
  try {
    if (!req.body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString("utf8");
      return raw ? JSON.parse(raw) : {};
    }
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    return req.body || {};
  } catch {
    return {};
  }
}
