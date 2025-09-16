import fs from "fs";
import path from "path";

function isAllowed(code) {
  const list =
    (process.env.CV_ACCESS_CODE || "nicolastuorcv|nicolastuor")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  return !!code && list.includes(code);
}

export default async function handler(req, res) {
  try {
    const { code = "" } = req.query || {};
    if (!isAllowed(code)) return res.status(401).end("Unauthorized");

    const pdfPath = path.join(process.cwd(), "public", "CV_Nicolas_Tuor.pdf");
    if (!fs.existsSync(pdfPath)) return res.status(404).end("PDF not found");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="CV_Nicolas_Tuor.pdf"');
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=600");

    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).end("pdf-error");
  }
}
