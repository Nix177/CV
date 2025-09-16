// api/cv.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const { code } = req.query; // GET /api/cv?code=XXXX
    const SECRET = process.env.CV_SECRET;

    if (!SECRET) {
      return res.status(500).json({ error: "CV_SECRET non configuré côté serveur." });
    }
    if (!code || code !== SECRET) {
      return res.status(401).json({ error: "Code invalide." });
    }

    // Le PDF doit être commité dans /public/
    const pdfPath = path.join(process.cwd(), "public", "CV_Nicolas_Tuor.pdf");
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ error: "CV introuvable sur le serveur." });
    }

    const stat = fs.statSync(pdfPath);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", 'attachment; filename="Nicolas_Tuor_CV.pdf"');

    const stream = fs.createReadStream(pdfPath);
    stream.pipe(res);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur interne." });
  }
}
