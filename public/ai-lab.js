/* AI Lab — Générateur de quiz (FR/EN/DE) */
(function () {
  "use strict";

  const $id = (id) => document.getElementById(id);
  const pick = (...ids) => ids.map((i) => $id(i)).find(Boolean);

  // Tolère camelCase et kebab-case
  const el = {
    theme:      pick("qTheme", "q-theme"),
    age:        pick("qAge", "q-age"),
    count:      pick("qCount", "q-n", "q-count"),
    lang:       pick("qLang", "q-lang"),
    objectives: pick("qObjectives", "q-objectives"),
    gen:        pick("qGen", "q-generate"),
    status:     pick("qStatus", "q-status"),
    output:     pick("qOutput", "q-output")
  };

  function setStatus(txt) {
    if (el.status) el.status.textContent = txt || "";
  }

  function renderQuiz(text) {
    if (!el.output) return;
    el.output.innerHTML = "";
    const pre = document.createElement("pre");
    pre.textContent = text || "(vide)";
    el.output.appendChild(pre);
  }

  async function generate() {
    try {
      setStatus("… génération");
      const body = {
        theme: el.theme && el.theme.value,
        age: el.age && el.age.value,
        count: el.count ? Number(el.count.value || 5) : 5,
        lang: el.lang && el.lang.value,
        objectives: el.objectives && el.objectives.value
      };
      const r = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      const data = await r.json().catch(() => ({}));
      // accepte {quiz:"..."} ou {text:"..."} ou string
      const txt = typeof data === "string" ? data : (data.quiz || data.text || JSON.stringify(data, null, 2));
      renderQuiz(txt);
      setStatus("ok");
    } catch (e) {
      console.error(e);
      setStatus("échec");
      renderQuiz("Erreur de génération. Réessayez.");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (el.gen)  el.gen.addEventListener("click", generate);
    // Au cas où : Enter dans textarea lance aussi
    if (el.objectives) el.objectives.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") generate();
    });
  });
})();
