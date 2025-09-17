// public/cv-context.js
// Ajoute window.augmentWithCv(question, lang) sans rien casser.
// Détecte si la question concerne le CV (mots-clés) ou si elle commence par "/cv ".
// Si oui, préfixe la question avec un extrait texte du PDF: /CV_Nicolas_Tuor.pdf

(function () {
  "use strict";

  const PAGE_LIMIT = 12000;     // max chars à lire depuis le PDF
  const INJECT_LIMIT = 8000;    // max chars à injecter dans la question

  const DOC_LANG = (document.documentElement.lang || "fr").slice(0, 2).toLowerCase();
  const HDR = {
    fr: "Contexte CV — extrait brut (utiliser seulement si pertinent) :",
    en: "CV context — raw extract (use only if relevant):",
    de: "CV-Kontext — Rohauszug (nur verwenden, wenn relevant):",
  };

  let CV_TEXT = "";
  async function loadCv() {
    if (!window.pdfjsLib) return "";
    try {
      // Worker PDF.js
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js";

      const doc = await window.pdfjsLib.getDocument("/CV_Nicolas_Tuor.pdf").promise;
      let out = "";
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const c = await page.getTextContent();
        out += c.items.map((i) => i.str).join(" ") + "\n";
        if (out.length > PAGE_LIMIT) break;
      }
      // Nettoyage léger
      return out.replace(/\s+/g, " ").trim();
    } catch (e) {
      console.warn("CV load failed:", e);
      return "";
    }
  }

  function looksLikeCvQuestion(q) {
    const s = (q || "").toLowerCase();
    if (s.startsWith("/cv ")) return true; // force
    return /\b(cv|curriculum|résumé|resume|lebenslauf|parcours|expériences?|experience|skills?|compétences|dipl[oô]me|formation|linkedin|nicolas|tuor)\b/.test(
      s
    );
  }

  // API publique: retourne la question, éventuellement augmentée du contexte CV
  window.augmentWithCv = async function (question, lang) {
    try {
      if (!question) return question;
      const need = looksLikeCvQuestion(question);
      if (!need) return question;

      if (!CV_TEXT) CV_TEXT = await loadCv();
      if (!CV_TEXT) return question; // pas de CV dispo

      const L = lang && HDR[lang] ? lang : DOC_LANG;
      const header = HDR[L] || HDR.fr;
      const snippet = CV_TEXT.slice(0, INJECT_LIMIT);

      // On garde la charge utile en fin de message
      return `${header}\n${snippet}\n---\nQuestion: ${question.replace(/^\/cv\s*/i, "")}`;
    } catch {
      return question;
    }
  };

  // Préchargement discret
  document.addEventListener("DOMContentLoaded", async () => {
    CV_TEXT = await loadCv();
    window.__cvLoaded = !!CV_TEXT;
  });
})();
