// public/chatbot.js — client léger pour /api/chat
(function(){
  "use strict";
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s,r));
  const log = (...a)=>console.log("%c[chatbot]","color:#0af",...a);

  // ---- refs
  const logEl    = $("#chatLog");
  const input    = $("#chatInput");
  const sendBtn  = $("#chatSend");
  const conciseCb= $("#concise");
  const radios   = $$("#liberty input[type=radio]");
  const range    = $("#libertySlider"); // legacy éventuel

  // ---- défauts souhaités : liberté=2, concis décoché
  function setDefaults(){
    const r2 = $("#lib2"); if (r2) r2.checked = true;
    if (conciseCb) conciseCb.checked = false;
  }
  setDefaults();

  // ---- rendu bulles
  function addBubble(text, who="bot"){
    const line = document.createElement("div");
    line.className = "bubble " + who;
    line.textContent = String(text || "");
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---- lecture liberté (radios → sinon slider legacy → sinon 2)
  function getLiberty(){
    const r = radios.find(x=>x.checked);
    if (r) return Number(r.value);
    if (range) return Number(range.value || 2);
    return 2;
  }

  // ---- post-traitement concis (coupe à ~2 phrases)
  function concise(text){
    if (!conciseCb?.checked) return text;
    const s = String(text || "").replace(/\s+/g," ").trim();
    const m = s.match(/^(.+?[\.!?])\s+(.+?[\.!?]).*$/);
    return m ? (m[1] + " " + m[2]) : s;
  }

  async function ask(){
    const q = input.value.trim();
    if (!q) return;
    addBubble(q, "user");
    input.value = "";

    const body = {
      message: q,
      liberty: getLiberty(),
      history: []  // tu peux pousser ici le mini historique si besoin
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
        addBubble("Désolé, le service est momentanément indisponible.", "bot");
        return;
      }
      // Certaines réponses “génériques” du modèle peuvent survenir
      // si liberty=1 et contexte faible ; ici on affiche le contenu uniquement.
      const content = (typeof data.answer === "string")
        ? data.answer
        : (data.answer?.content || "(réponse vide)");

      addBubble(concise(content), "bot");
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

  addBubble("Bonjour ! Posez une question sur le candidat.", "bot");
})();
