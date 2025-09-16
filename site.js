// site.js — gestion du téléchargement protégé du CV
const dlBtn = document.getElementById("dlCvBtn");

async function downloadCV() {
  const code = prompt("Veuillez saisir le code pour télécharger le CV :");
  if (!code) return;

  try {
    const res = await fetch(`/api/cv?code=${encodeURIComponent(code)}`);
    if (!res.ok) {
      const t = await res.text();
      alert("Téléchargement refusé (code invalide ou indisponible).");
      console.error("CV error:", t);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Nicolas_Tuor_CV.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    alert("Erreur réseau. Réessaie plus tard.");
  }
}

if (dlBtn) dlBtn.addEventListener("click", (e) => {
  e.preventDefault();
  downloadCV();
});
