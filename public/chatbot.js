// public/chatbot.js — client léger pour /api/chat

(function(){
  "use strict";
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s,r));
  const log = (...a)=>console.log("%c[chatbot]","color:#0af",...a);

  // ---- UI ----
  const logEl   = $("#chatLog");
  const input   = $("#chatInput");
  const sendBtn = $("#chatSend");
  const conciseCb = $("#concise");        // par défaut décoché (HTML)
  const libRadios = $$("#liberty input[type=radio]"); // 0 / 1 / 2

  // Valeurs par défaut souhaitées
  // -> Liberté = 2 (interprétatif), Réponses concises décoché
  function setDefaults(){
    const r2 = $("#lib2");
    if (r2) r2.checked = true;
    if (conciseCb) conciseCb.checked = false;
  }
  setDefaults();

  // ---- rendu bulles ----
  function addBubble(text, who="bot"){
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text || "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---- lecture liberté ----
  function getLiberty(){
    const r = libRadios.find(x=>x.checked);
    return r ? Number(r.value) : 2;
  }

  // ---- post-traitement concis ----
  function concise(text){
    if (!conciseCb?.checked) return text;
    const s = String(text || "").replace(/\s+/g," ").trim();
    // coupe grossièrement à deux phrases
    const m = s.match(/^(.+?[\.!?])\s+(.+?[\.!?]).*$/);
    return m ? (m[1] + " " + m[2]) : s;
  }

  // ---- appel API ----
  async function ask(){
    const q = input.value.trim();
    if (!q) return;
    addBubble(q, "user");
    input.value = "";

    const body = {
      message: q,
      liberty: getLiberty(),
      history: [] // on peut pousser l'historique si besoin
    };

    try{
      const r = await fetch("/api/chat", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data?.ok){
        addBubble("Désolé, le service est momentanément indisponible.", "bot");
        return;
      }
      const content = (typeof data.answer === "string")
        ? data.answer
        : (data.answer?.content || "");

      addBubble(concise(content), "bot");
      log("[chatbot] used:", data.used);
    }catch(e){
      console.error(e);
      addBubble("Erreur réseau. Réessayez dans un instant.", "bot");
    }
  }

  sendBtn?.addEventListener("click", ask);
  input?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter" && !e.shiftKey){
      e.preventDefault();
      ask();
    }
  });

  // message d’accueil
  addBubble("Bonjour ! Posez une question sur le candidat.", "bot");
})();
