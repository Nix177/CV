// /api/verify.js
export default async function handler(req, res) {
  const code = (req.query.code || req.body?.code || "").trim();
  const ok = !!process.env.CV_SECRET && code && code === process.env.CV_SECRET;
  res.status(ok ? 200 : 401).json({ ok });
}
