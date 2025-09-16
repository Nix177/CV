// Configuration de base du chatbot avec le contexte du CV de Nicolas
const messages = [
  { role: "system", content: 
    "Tu es l'assistant de recrutement 'IA' de Nicolas Tuor. "
    + "Tu connais son CV et ses lettres de motivation, et tu réponds aux questions sur son profil en mettant en valeur ses compétences et ses expériences. "
    + "Nicolas Tuor est un enseignant et didacticien en informatique (Master HEP Lausanne) avec de l'expérience du primaire à l'université. "
    + "Il est pédagogue, structuré et bienveillant, possédant de solides compétences en programmation (Python, HTML/CSS, C++) et en conception de formations. "
    + "Il a également fait de la recherche (analyse de données, synthèse) et de la coordination de projets éducatifs. "
    + "Il parle français (langue maternelle), anglais (C2) et allemand (B2/C1). "
    + "Il apprend rapidement les nouvelles technologies et utilise des outils d'IA dans son travail. "
    + "Réponds de façon professionnelle et convaincante. Si la question est posée en anglais, réponds en anglais; si elle est en français, réponds en français." }
];

// Sélection des éléments du DOM
const chatLog = document.getElementById('chatLog');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

// Envoi du message de l'utilisateur au chatbot
async function sendMessage() {
  const question = userInput.value.trim();
  if (question === "") return;  // ne rien faire si le champ est vide

  // Ajouter le message de l'utilisateur à l'interface
  addMessage(question, "user");

  // Préparer le message utilisateur pour l'API
  messages.push({ role: "user", content: question });

  // Désactiver l'input et le bouton pendant la requête
  userInput.value = "";
  userInput.disabled = true;
  sendBtn.disabled = true;
  sendBtn.innerText = "En cours...";

  try {
    // Appel à l'API OpenAI (GPT-3.5 Turbo)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer maclefapi"
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages
      })
    });
    const data = await response.json();
    // Récupérer la réponse textuelle de l'IA
    const aiReply = data.choices[0].message.content;
    // Ajouter la réponse de l'IA à la liste des messages pour conserver le contexte
    messages.push({ role: "assistant", content: aiReply });
    // Afficher la réponse de l'IA dans l'interface
    addMessage(aiReply, "bot");
  } catch (error) {
    console.error("Erreur API OpenAI:", error);
    addMessage("Désolé, une erreur est survenue. Veuillez réessayer plus tard.", "bot");
  } finally {
    // Réactiver le champ de saisie et le bouton
    userInput.disabled = false;
    sendBtn.disabled = false;
    sendBtn.innerText = "Envoyer";
    userInput.focus();
  }
}

// Fonction utilitaire pour afficher un message dans la chat-log
function addMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "message " + (sender === "user" ? "user-message" : "bot-message");
  msgDiv.textContent = text;
  chatLog.appendChild(msgDiv);
  // Faire défiler vers le bas pour voir le dernier message
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Envoyer le message quand on clique sur le bouton ou presse "Entrée"
sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    sendMessage();
    e.preventDefault(); // empêche le saut de ligne
  }
});
