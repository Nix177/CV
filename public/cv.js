export default function handler(req, res) {
  try {
    const { code = "" } = req.query || {};
    // Codes autorisés : depuis l'env, sinon fallback pour ne pas bloquer
    const list =
      (process.env.CV_ACCESS_CODE || "nicolastuorcv|nicolastuor")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);

    const ok = !!code && list.includes(code);
    if (!ok) return res.status(401).json({ ok: false });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "verify-failed" });
  }
}
