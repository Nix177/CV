// public/chatbot.js — client léger pour /api/chat
(function(){
  "use strict";

  // ---------- utils ----------
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s,r));
  const log = (...a)=>console.log("%c[chatbot]","color:#0af",...a);

  // Détection de langue UI (forçage de la langue de réponse)
  const uiLang = (window.__CHATBOT_LANG || document.documentElement.lang || "fr").slice(0,2).toLowerCase();
  function langHintFor(l){
    if (l === "en") return "[Please answer in English.] ";
    if (l === "de") return "[Bitte antworte auf Deutsch.] ";
    return "[Réponds en français.] ";
  }
  const LANG_HINT = langHintFor(uiLang);

  // ---------- refs UI ----------
  const logEl     = $("#chatLog");
  const input     = $("#chatInput");
  const sendBtn   = $("#chatSend");
  const conciseCb = $("#concise");
  const radios    = $$("#liberty input[type=radio]");
  const legacyRange = $("#libertySlider"); // au cas où il existe encore

  // Valeurs par défaut souhaitées : liberté=2, concis décoché
  function setDefaults(){
    const r2 = $("#lib2");
    if (r2) r2.checked = true;
    if (legacyRange) legacyRange.value = "2";
    if (conciseCb) conciseCb.checked = false;
  }
  setDefaults();

  // ---------- rendu bulles ----------
  function addBubble(text, who="bot"){
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text || "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------- lecture liberté ----------
  function getLiberty(){
    const r = radios.find(x=>x && x.checked);
    if (r) return Number(r.value);
    if (legacyRange) return Number(legacyRange.value || 2);
    return 2;
  }

  // ---------- “réponses concises” (2 phrases max, sans lookbehind) ----------
  function makeConcise(s){
    if (!conciseCb?.checked) return s;
    const str = String(s || "").replace(/\s+/g," ").trim();
    if (!str) return str;
    let count = 0;
    let out = "";
    for (let i = 0; i < str.length; i++){
      const ch = str[i];
      out += ch;
      if (ch === "." || ch === "!" || ch === "?"){
        count++;
        if (count >= 2) return out.trim();
      }
    }
    return out.trim();
  }

  // ---------- appel API ----------
  async function ask(){
    const q = input.value.trim();
    if (!q) return;
    addBubble(q, "user");
    input.value = "";

    const body = {
      // on injecte un "hint langue" en tête du message => force la langue de réponse
      message: LANG_HINT + q,
      liberty: getLiberty(),
      history: [] // à étendre si tu veux garder un petit historique côté client
    };
    log("[payload]", body);

    try{
      const r = await fetch("/api/chat",{
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      log("[used]", data.used);

      if (!data?.ok){
        addBubble(
          uiLang==="de" ? "Der Dienst ist vorübergehend nicht verfügbar."
          : uiLang==="en" ? "The service is temporarily unavailable."
          : "Désolé, le service est momentanément indisponible.",
          "bot"
        );
        return;
      }

      // Affiche uniquement le contenu textuel du modèle
      const content = (typeof data.answer === "string")
        ? data.answer
        : (data.answer?.content || "");

      addBubble(makeConcise(content), "bot");
    }catch(e){
      console.error(e);
      addBubble(
        uiLang==="de" ? "Netzwerkfehler. Bitte versuchen Sie es gleich noch einmal."
        : uiLang==="en" ? "Network error. Please try again in a moment."
        : "Erreur réseau. Réessayez dans un instant.",
        "bot"
      );
    }
  }

  // ---------- events ----------
  sendBtn?.addEventListener("click", ask);
  input?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      ask();
    }
  });

  // ---------- message d’accueil ----------
  const hello =
    uiLang==="de" ? "Hallo! Stellen Sie eine Frage zum Kandidaten."
    : uiLang==="en" ? "Hello! Ask a question about the candidate."
    : "Bonjour ! Posez une question sur le candidat.";
  addBubble(hello, "bot");
})();
