// Vercel serverless function
import crypto from "node:crypto";

export default async function handler(req, res){
  if (req.method !== "POST") {
    res.setHeader("Allow","POST");
    return res.status(405).end("Method Not Allowed");
  }
  try{
    const origin = req.headers.origin || "";
    const allowed = /nicolastuor\.ch$/i.test(new URL(origin).host) || origin === "";
    if (!allowed) return res.status(403).json({error:"forbidden"});

    const { text, lang, page, ua, tz } = req.body || {};
    if (!text || typeof text!=="string" || text.trim().length<2){
      return res.status(400).json({error:"bad payload"});
    }
    const entry = {
      ts: new Date().toISOString(),
      lang: (lang||"fr"),
      page: page || "fun-facts",
      tz: tz || "UTC",
      ua: (ua||"").slice(0,200),
      text: text.trim()
    };

    // prepare path by month
    const dt = new Date();
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth()+1).padStart(2,"0");
    const path = `data/ff-feedback/${yyyy}-${mm}.jsonl`;

    // read current file (if any), append, and commit via GitHub API
    const owner = process.env.GITHUB_OWNER;
    const repo  = process.env.GITHUB_REPO;
    const token = process.env.GITHUB_TOKEN;
    const api = "https://api.github.com";

    // get sha if exists
    let sha = null;
    const getResp = await fetch(`${api}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      headers: { Authorization:`Bearer ${token}`, "Accept":"application/vnd.github+json" }
    });
    let existing = "";
    if (getResp.ok){
      const js = await getResp.json();
      sha = js.sha;
      existing = Buffer.from(js.content, "base64").toString("utf8");
    }

    const newContent = (existing ? existing + "\n" : "") + JSON.stringify(entry);
    const b64 = Buffer.from(newContent, "utf8").toString("base64");

    const putResp = await fetch(`${api}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method:"PUT",
      headers: { Authorization:`Bearer ${token}`, "Accept":"application/vnd.github+json" },
      body: JSON.stringify({
        message: `chore(feedback): append ${yyyy}-${mm}`,
        content: b64,
        sha
      })
    });

    if (!putResp.ok){
      const t = await putResp.text();
      return res.status(500).json({error:"github put failed", details:t});
    }

    return res.status(200).json({ok:true});
  }catch(err){
    return res.status(500).json({error:"server error", details:String(err)});
  }
}
