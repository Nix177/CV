// api/trigger-news.js
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
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
      max_items = "100",              // utilisé éventuellement côté script, mais PAS envoyé à GitHub
      custom_weights = "",
      // l'UI FR envoie ces 3 champs :
      bucket_policy_label = "",
      bucket_policy_desc = "",
      bucket_policy_keywords = "",
      // si jamais tu passes directement un JSON complet :
      policy_overrides,
      run_key,
      // UI EN : envoie "preview": "true"/"false"
      preview,
      // UI FR : envoie "publish_target": "default" | "preview"
      publish_target: publishTargetIn
    } = bodyIn;

    // ---- ENV avec fallback sur tes variables "GITHUB_*" ----
    const owner  = process.env.GH_REPO_OWNER    || process.env.GITHUB_OWNER   || "";
    const repo   = process.env.GH_REPO_NAME     || process.env.GITHUB_REPO    || "";
    const fileIn = process.env.GH_WORKFLOW_FILE || ".github/workflows/build-news.yml";
    const token  = process.env.GH_WORKFLOW_TOKEN || process.env.GITHUB_TOKEN || "";
    const branch = process.env.GH_REPO_BRANCH   || "main";

    const workflowFile = (fileIn || "").split("/").pop();

    const missing = [];
    if (!owner)        missing.push("GH_REPO_OWNER|GITHUB_OWNER");
    if (!repo)         missing.push("GH_REPO_NAME|GITHUB_REPO");
    if (!token)        missing.push("GH_WORKFLOW_TOKEN|GITHUB_TOKEN");
    if (!workflowFile) missing.push("GH_WORKFLOW_FILE");
    if (missing.length) {
      res.status(400).json({ ok: false, error: "Missing GitHub env vars", missing });
      return;
    }

    // run_key pour suivre le run
    const key = run_key || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

    // ---- Normalisation du publish_target (default | preview) ----
    let PUBLISH_TARGET = (publishTargetIn || "").toString().toLowerCase().trim();

    if (!PUBLISH_TARGET) {
      const pv = (preview === true || preview === "true" || preview === "1");
      PUBLISH_TARGET = pv ? "preview" : "default";
    }
    if (PUBLISH_TARGET !== "preview") {
      PUBLISH_TARGET = "default";
    }

    // Compacte les overrides en un seul JSON (pour rester <= 10 inputs)
    let po = policy_overrides;
    if (!po) {
      const obj = {
        label: (bucket_policy_label || "").trim(),
        desc: (bucket_policy_desc || "").trim(),
        keywords: (bucket_policy_keywords || "").trim()
      };
      if (obj.label || obj.desc || obj.keywords) {
        po = JSON.stringify(obj);
      }
    }

    // Inputs (max 10) alignés sur build-news.yml
    const inputs = {
      use_openai: String(use_openai) === "false" ? "false" : "true",
      model: model || undefined,               // défaut YAML si absent
      profile,
      score_min: String(score_min),
      min_publish: String(min_publish),
      output_cap: String(output_cap),
      custom_weights: String(custom_weights || ""),
      publish_target: PUBLISH_TARGET,          // "default" | "preview"
      run_key: key,
      policy_overrides: po || undefined
      // max_items N'EST PAS ENVOYÉ ici pour rester <= 10 inputs
    };
    Object.keys(inputs).forEach(k => {
      if (inputs[k] === undefined) delete inputs[k];
    });

    console.log("[trigger-news] Dispatching workflow", {
      owner,
      repo,
      workflowFile,
      ref: branch,
      inputs
    });

    const payload = { ref: branch, inputs };

    const url = `https://api.github.com/repos/${owner}/${repo}`
              + `/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`;

    const ghRes = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "User-Agent": "nix177-cv-trigger-news"
      },
      body: JSON.stringify(payload)
    });

    if (!ghRes.ok) {
      let detail = null;
      try { detail = await ghRes.json(); } catch { /* ignore */ }
      console.error("[trigger-news] GitHub dispatch failed", ghRes.status, detail);
      res.status(500).json({
        ok: false,
        error: "GitHub workflow dispatch failed",
        status: ghRes.status,
        detail
      });
      return;
    }

    res.status(200).json({
      ok: true,
      run_key: key,
      workflowFile,
      ref: branch,
      inputs
    });
  } catch (e) {
    console.error("[trigger-news] Fatal error", e);
    res.status(500).json({
      ok: false,
      error: e && e.message ? e.message : String(e)
    });
  }
}

// Petit helper JSON safe
async function parseJson(req) {
  try {
    const chunks = [];
    for await (const ch of req) chunks.push(ch);
    if (!chunks.length) return null;
    const txt = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(txt);
  } catch {
    return null;
  }
}
