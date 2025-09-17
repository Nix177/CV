// api/verify.js
export default function handler(req, res) {
  try {
    const { code = "" } = req.query || {};
    const list = (process.env.CV_ACCESS_CODE || "nicolastuorcv|nicolastuor")
      .split("|")
      .map(s => s.trim()).filter(Boolean);
    if (!code || !list.includes(code)) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "verify-failed" });
  }
}
