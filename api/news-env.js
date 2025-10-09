// api/news-env.js
export default function handler(req, res) {
  res.status(200).json({
    GH_REPO_OWNER:  !!process.env.GH_REPO_OWNER,
    GH_REPO_NAME:   !!process.env.GH_REPO_NAME,
    GH_WORKFLOW_FILE: !!process.env.GH_WORKFLOW_FILE,
    GH_WORKFLOW_TOKEN: !!process.env.GH_WORKFLOW_TOKEN,
    GH_REPO_BRANCH: process.env.GH_REPO_BRANCH || "main",

    // alias que tu utilises déjà (capture)
    GITHUB_OWNER: !!process.env.GITHUB_OWNER,
    GITHUB_REPO:  !!process.env.GITHUB_REPO,
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN
  });
}
