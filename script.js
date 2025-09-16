/* =========================================================================
   Chatbot IA – Nicolas Tuor
   Frontend minimal qui appelle une route serveur /api/chat (Vercel/Next API).
   - Aucune clé OpenAI dans le client.
   - Historique conservé dans localStorage (clé: "nt_chat_history_v1").
   - Répond en français ou en anglais selon la langue de la question.
   - Inclut des "quick prompts" cliquables si présents dans la page.
   -------------------------------------------------------------------------
   HTML attendu (extrait de chatbot.html) :
     <div id="chatLog" class="chat-log"></div>
     <div class="chat-input-area">
       <input type="text" id="userInput" placeholder="Votre question..." />
       <button id="sendBtn" class="btn primary-btn">Envoyer</button>
     </div>
     <!-- (optionnel) zone de chips -->
     <div id="quickPrompts" class="quick-prompts"></div>
   ========================================================================= */

/* ----------------------------- Config ---------------------------------- */

// Point d’accès à la route serverless (Vercel / Next.js API Routes)
const API_ENDPOINT = "/api/chat";

// Nom de la clé de stockage local pour persister la conversation
const STORAGE_KEY = "nt_chat_history_v1";

// Contexte de base envoyé au modèle (résumé concis du CV + lettres)
const BASE_CONTEXT = `
Tu es l'assistant de recrutement "IA" de Nicolas Tuor.
Objectif: répondre de manière convaincante et précise aux questions sur son profil,
et formuler des arguments clairs "Pourquoi l'embaucher ?".

Profil condensé (véridique, ne rien inventer) :
- Enseignant diplômé (Bachelor HEP Fribourg) et Master en didactique de l’informatique (HEP Lausanne).
- Expérience d’enseignement du primaire à l’université (HEP FR, Unifr), remplacements, poste 5H.
- Stage de master (CRE/ATE HEP FR) : projets d’intégration du numérique (cloud de classe local / Nextcloud, intranet),
  activités pédagogiques, ressources associées au secondaire I ; initiation à la recherche de terrain.
- Travail de master : enseignement explicite du débogage et transfert de compétences (élèves du primaire).
- Compétences fortes : pensée critique, structuration des apprentissages, conception de séquences,
  évaluation formative/sommative, analyse de corpus, synthèse opérationnelle, rédaction claire.
- Techniques/numérique : Python, HTML/CSS, notions C++; Moodle côté enseignant; curiosité et montée en compétence rapides.
- Langues : Français (natif), Anglais (C2), Allemand (B2/C1).
- Valeurs : pragmatisme bienveillant, explicitation des attentes, documentation, suivi rigoureux.
- Intérêts : éducation numérique, IA (agents/outils), pédagogie informatique, vulgarisation scientifique.

Consignes de réponse :
1) Utiliser la langue détectée dans la question (FR ou EN).
2) Être concis, structuré, professionnel; mettre en avant adéquation poste-missions,
   impact concret et fiabilité de la démarche (rigueur, documentation, clarté).
3) Suggérer si pertinent un court call-to-action (ex: "Souhaitez-vous un court debrief projet ?").
4) Ne pas inventer de certificats/diplômes; rester fidèle au profil ci-dessus.
`;

/* --------------------------- Sélecteurs DOM ---------------------------- */

const chatLog  = document.getElementById("chatLog");
const userInput = document.getElementById("userInput");
const sendBtn   = document.getElementById("sendBtn");
const quickZone = document.getElementById("quickPrompts");

/* ------------------------ État & utilitaires --------------------------- */

// Historique maintenu côté client et envoyé côté serveur à chaque tour.
let messages = loadHistoryOrInit();

/** Charge l'historique depuis localStorage ou initialise avec le message système. */
function loadHistoryOrInit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // S'assure qu'il existe au moins un message système au début :
      if (!parsed.length || parsed[0]?.role !== "system") {
        parsed.unshift({ role: "system", content: BASE_CONTEXT.trim() });
      }
      return parsed;
    }
  } catch {}
  return [{ role: "system", content: BASE_CONTEXT.trim() }];
}

/** Persiste l'historique dans localStorage (limité à ~30 tours pour rester léger). */
function persistHistory() {
  try {
    const capped = [...messages];
    // Cap le nombre de tours (messages user/assistant) pour éviter un stockage trop lourd
    const MAX_MSG = 60; // ~30 aller-retour
    if (capped.length > MAX_MSG) {
      // On garde le system + les X derniers messages
      const system = capped[0];
      const tail = capped.slice(capped.length - (MAX_MSG - 1));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([system, ...tail]));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
  } catch {}
}

/** Ajoute un message dans l'UI. */
function addMessageToUI(text, sender) {
  const div = document.createElement("div");
  div.className = "message " + (sender === "user" ? "user-message" : "bot-message");
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

/** Petites suggestions cliquables pour accélérer le test. */
function renderQuickPrompts() {
  if (!quickZone) return;
  const prompts = [
    "Pourquoi devrions-nous vous embaucher ?",
    "Quelles sont vos forces clés ?",
    "Parlez-moi de vos projets d'éducation numérique.",
    "How would you support a curriculum redesign?",
    "Exemples concrets d'impact en classe ?"
  ];
  quickZone.innerHTML = ""; // reset
  prompts.forEach(p => {
    const b = document.createElement("button");
    b.className = "btn";
    b.style.margin = "0 8px 8px 0";
    b.textContent = p;
    b.addEventListener("click", () => {
      userInput.value = p;
      sendMessage();
    });
    quickZone.appendChild(b);
  });
}

/** (Optionnel) Détecte si le texte saisi est plutôt EN/FR — ici purement heuristique. */
function detectLang(s) {
  // simple heuristique : présence importante de mots vides FR
  const frHints = [" le ", " la ", " les ", " des ", " pourquoi ", " expérience ", " compétences ", " projet "];
  const lower = ` ${s.toLowerCase()} `;
  let score = 0;
  frHints.forEach(h => { if (lower.includes(h)) score++; });
  return score >= 2 ? "fr" : "en";
}

/* -------------------------- Envoi utilisateur -------------------------- */

async function sendMessage() {
  const question = (userInput?.value || "").trim();
  if (!question) return;

  // UI utilisateur
  addMessageToUI(question, "user");
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.textContent = "En cours...";

  // Ajoute au contexte
  // Petite consigne de langue injectée (sans refaire tout le système) :
  const lang = detectLang(question);
  const langHint = lang === "fr"
    ? "Réponds en français."
    : "Answer in English.";

  messages.push({ role: "user", content: `${question}\n\n${langHint}` });

  try {
    const res = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("API error:", errText);
      addMessageToUI("Désolé, une erreur est survenue côté serveur. Réessaie dans un instant.", "bot");
      return;
    }

    const data = await res.json();
    const aiReply =
      (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
        ? data.choices[0].message.content.trim()
        : "Désolé, je n'ai pas pu générer de réponse.";

    messages.push({ role: "assistant", content: aiReply });
    addMessageToUI(aiReply, "bot");
    persistHistory();
  } catch (e) {
    console.error(e);
    addMessageToUI("Impossible de contacter le service pour le moment (réseau ou CORS).", "bot");
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
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });

  // Au chargement, on ré-affiche l’historique (hors message system)
  messages.forEach((m) => {
    if (m.role === "user") addMessageToUI(m.content, "user");
    if (m.role === "assistant") addMessageToUI(m.content, "bot");
  });

  // Affiche des chips de questions rapides si zone présente
  renderQuickPrompts();
}

/* ------------------------- Outils développeur -------------------------- */
// Réinitialiser l’historique depuis la console : window.resetChatHistory()
window.resetChatHistory = function resetChatHistory() {
  messages = [{ role: "system", content: BASE_CONTEXT.trim() }];
  persistHistory();
  if (chatLog) chatLog.innerHTML = "";
  addMessageToUI("Historique réinitialisé.", "bot");
};
