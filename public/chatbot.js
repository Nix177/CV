/* public/js/chatbot.js
   Front-end du chatbot : envoie les requêtes à /api/chat et gère le slider "Liberté". */
(function(){
  "use strict";
  const $ = (s, r=document)=>r.querySelector(s);
  const logBox = $("#chatBox");
  const input  = $("#chatInput");
  const sendBt = $("#chatSend");
  const slider = $("#liberty");
  const libLbl = $("#libLabel");
  const libInfo = $("#libInfo");

  const HISTORY = []; // contexte léger côté client

  function addBubble(text, who="bot"){
    const b = document.createElement("div");
    b.className = "bubble " + (who==="user"?"user":"bot");
    b.textContent = String(text || "");
    logBox.appendChild(b);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function libText(v){
    return (v==0)
      ? "0 : strict et factuel — aucune supposition."
      : (v==1)
      ? "1 : prudent — petites inférences, indiquées comme déduites."
      : "2 : interprétatif responsable — rapproche, explicite, indique clairement les déductions.";
  }
  function updateLibUI(){
    const v = Number(slider.value || 1);
    libLbl.textContent = v;
    libInfo.textContent = libText(v);
  }

  async function ask(){
    const q = input.value.trim();
    if(!q) return;
    input.value = "";
    addBubble(q, "user");
    HISTORY.push({ role:"user", content:q });

    try{
      const liberty = Number(slider.value || 1);
      const r = await fetch("/api/chat", {
        method:"POST",
        headers:{ "content-type":"application/json" },
        body: JSON.stringify({
          message: q,
          liberty,
          history: HISTORY.slice(-8) // petit contexte
        })
      });
      const json = await r.json();
      const content = (json && json.answer && (json.answer.content || json.answer)) || "(Réponse vide)";
      addBubble(content, "bot");
      HISTORY.push({ role:"assistant", content: String(content) });
    }catch(e){
      addBubble("Désolé, une erreur est survenue : " + (e?.message || e), "bot");
    }
  }

  sendBt.addEventListener("click", ask);
  input.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" && !e.shiftKey){
      e.preventDefault(); ask();
    }
  });
  slider.addEventListener("input", updateLibUI);

  updateLibUI();
  addBubble("Bonjour ! Posez une question sur le candidat.", "bot");
})();
