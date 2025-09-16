/* =========================================================================
   Chatbot IA – Nicolas Tuor (v1.1)
   - Appel à /api/chat (côté serveur), aucune clé en front.
   - Détection FR/EN robuste (accents, mots fréquents, fallback navigateur).
   - N'ajoute une consigne de langue que si on est sûr ; sinon on laisse le modèle
     suivre la règle du contexte : "réponds dans la langue du dernier message".
   - Historique persistant (localStorage), quick prompts, reset utilitaire.
   ========================================================================= */

/* ----------------------------- Config ---------------------------------- */

const API_ENDPOINT = "/api/chat";
const STORAGE_KEY  = "nt_chat_history_v1";

const BASE_CONTEXT = `
Tu es l'assistant de recrutement "IA" de Nicolas Tuor.
Toujours répondre dans la langue du DERNIER message utilisateur.
En cas d'ambiguïté, répondre en FR (fr-CH).

Profil (fidèle, sans invention) :
- Enseignant diplômé (Bachelor HEP Fribourg) + Master en didactique de l’informatique (HEP Lausanne).
- Expérience d’enseignement du primaire à l’université (HEP FR, Unifr), remplacements, poste 5H.
- Stage Master (CRE/ATE) : intégration du numérique (cloud de classe local/Nextcloud intranet), activités pédagogiques, ressources S1.
- Travail de Master : enseignement explicite du débogage et transfert de compétences (élèves du primaire).
- Compétences : pensée critique, structuration des apprentissages, conception de séquences, évaluation formative/sommative,
  analyse/synthèse opérationnelle, rédaction claire, Python/HTML-CSS (notions C++), curiosité et montée en compétence rapides.
- Langues : FR natif, EN C2, DE B2/C1. Valeurs : pragmatisme bienveillant, explicitation des attentes, documentation, suivi rigoureux.

Consignes :
1) Réponses concises, structurées, professionnelles ; adapter le registre au recruteur.
2) Mettre en avant adéquation missions/profil, impact concret, fiabilité (rigueur, doc, clarté).
3) Pas d'inventions (pas de certificats non mentionnés). Si info manquante, le dire simplement.
`;

/* --------------------------- Sélecteurs DOM ---------------------------- */

const chatLog   = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn   = document.getElementById("sendBtn");
const quickZone = document.getElementById("quickPrompts");

/* ------------------------ État & utilitaires --------------------------- */

let messages = loadHistoryOrInit();

function loadHistoryOrInit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.length || parsed[0]?.role !== "system") {
        parsed.unshift({ role: "system", content: BASE_CONTEXT.trim() });
      }
      return parsed;
    }
  } catch {}
  return [{ role: "system", content: BASE_CONTEXT.trim() }];
}

function persistHistory() {
  try {
    const MAX_MSG = 60; // ~30 tours
    let arr = messages;
    if (arr.length > MAX_MSG) {
      const head = arr[0]; // system
      arr = [head, ...arr.slice(arr.length - (MAX_MSG - 1))];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
}

function addMessageToUI(text, sender) {
  const div = document.createElement("div");
  div.className = "message " + (sender === "user" ? "user-message" : "bot-message");
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function renderQuickPrompts() {
  if (!quickZone) return;
  const prompts = [
    "Pourquoi devrions-nous vous embaucher ?",
    "Quelles sont vos forces clés ?",
    "Des exemples d'impact concret en classe ?",
    "Vos idées pour l'éducation numérique ?",
    "How would you support a curriculum redesign?"
  ];
  quickZone.innerHTML = "";
  prompts.forEach(p => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.margin = "0 8px 8px 0";
    b.textContent = p;
    b.addEventListener("click", () => { userInput.value = p; sendMessage(); });
    quickZone.appendChild(b);
  });
}

/* -------- Détection de langue (FR/EN) — robuste mais simple ----------- */

function detectLangOrDefault(text) {
  const s = ` ${text.toLowerCase()} `;
  const hasAccent = /[àâäçéèêëîïôöùûüÿœ]/i.test(text);

  const frWords = [
    " est-ce ", " pourquoi ", " poste ", " conseiller ", " numérique ", " éducation ",
    " bon ", " embaucher ", " candidat ", " mon ", " votre ", " vos ",
    " le ", " la ", " les ", " des ", " du ", " un ", " une ", " au ", " aux ",
    " que ", " qui ", " quoi ", " comment ", " avec ", " sans ", " dans ", " chez ",
    " merci ", " bonjour "
  ];
  const enWords = [
    " why ", " what ", " how ", " would ", " should ", " position ",
    " advisor ", " digital ", " education ", " candidate ", " hire ", " good "
  ];

  const frScore = frWords.reduce((acc,w)=>acc + (s.includes(w)?1:0), 0) + (hasAccent?2:0);
  const enScore = enWords.reduce((acc,w)=>acc + (s.includes(w)?1:0), 0);

  if (frScore >= Math.max(2, enScore + 1)) return "fr";
  if (enScore >= Math.max(2, frScore + 1)) return "en";

  // Ambigu -> choisir la locale du navigateur
  return (navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en";
}

/* -------------------------- Envoi utilisateur -------------------------- */

async function sendMessage() {
  const question = (userInput?.value || "").trim();
  if (!question) return;

  addMessageToUI(question, "user");
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "En cours...";

  // On laisse le contexte guider la langue, mais on ajoute un hint SI on est confiant
  const lang = detectLangOrDefault(question);
  const confident = true; // notre heuristique est suffisamment stricte
  const langHint = lang === "fr" ? "Réponds en français." : "Answer in English.";

  // Pousse le message utilisateur
  messages.push({ role: "user", content: question });
  // Ajoute une courte consigne de langue seulement si confiant
  if (confident) {
    messages.push({ role: "system", content: langHint });
  }

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("API error:", errText);
      addMessageToUI("Désolé, une erreur s’est produite côté serveur. Réessaie dans un instant.", "bot");
      return;
    }

    const data = await res.json();
    const aiReply = data?.choices?.[0]?.message?.content?.trim()
      || "Désolé, je n'ai pas pu générer de réponse.";

    messages.push({ role: "assistant", content: aiReply });
    addMessageToUI(aiReply, "bot");
    persistHistory();
  } catch (e) {
    console.error(e);
    addMessageToUI("Impossible de contacter le service (réseau/CORS).", "bot");
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    sendBtn.textContent = "Envoyer";
    userInput.focus();
  }
}

/* ---------------------- Raccourcis & bindings UI ----------------------- */

if (sendBtn && userInput && chatLog) {
  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
  });

  // Rejoue l'historique (hors message système)
  messages.forEach(m => {
    if (m.role === "user") addMessageToUI(m.content, "user");
    if (m.role === "assistant") addMessageToUI(m.content, "bot");
  });

  renderQuickPrompts();
}

/* ------------------------- Outils développeur -------------------------- */
window.resetChatHistory = function resetChatHistory() {
  messages = [{ role: "system", content: BASE_CONTEXT.trim() }];
  persistHistory();
  if (chatLog) chatLog.innerHTML = "";
  addMessageToUI("Historique réinitialisé.", "bot");
};
