(function(){
  const hasUI = typeof window.UI === "object" && window.UI?.setBusy;

  // --------- QUIZ ----------
  const qForm = document.getElementById("quizForm");
  const qOut  = document.getElementById("quizOut");

  qForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = qForm.querySelector("[data-busy]");
    hasUI && UI.setBusy(btn, true);
    qOut.innerHTML = "";

    try{
      const fd = new FormData(qForm);
      const payload = {
        topic: fd.get("topic") || "",
        age: +(fd.get("age")||12),
        per: fd.get("per")||"",
        count: +(fd.get("count")||5),
        language: "fr"
      };

      const r = await fetch("/api/quiz", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(payload)
      });
      if(!r.ok) throw new Error("quiz-failed");
      const data = await r.json();

      renderQuiz(data);
    } catch(err){
      qOut.innerHTML = `<div class="card pad">Erreur. Réessaie.</div>`;
    } finally {
      hasUI && UI.setBusy(qForm.querySelector("[data-busy]"), false);
    }
  });

  function renderQuiz(data){
    const questions = Array.isArray(data?.questions)? data.questions : [];
    if(!questions.length){
      qOut.innerHTML = `<div class="card pad">Aucune question reçue.</div>`;
      return;
    }

    qOut.innerHTML = questions.map((q,i)=>`
      <div class="card pad stack">
        <div><strong>Q${i+1}.</strong> ${escapeHTML(q.q||"")}</div>
        <div class="grid" style="grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:8px">
          ${ (q.choices||[]).map(c=>`
            <button class="btn choice" data-q="${i}" data-choice="${escapeHTML(c)}">${escapeHTML(c)}</button>
          `).join("") }
        </div>
        <div class="muted" id="q_msg_${i}"></div>
        <div class="row gap">
          <button class="btn chip" data-explain="${i}">Je n’ai pas compris</button>
        </div>
      </div>
    `).join("");

    qOut.querySelectorAll(".choice").forEach(btn=>{
      btn.addEventListener("click", (e)=>{
        const qi = +btn.dataset.q;
        const pick = btn.dataset.choice;
        const ok = (questions[qi]?.answer||"") === pick;
        const msg = document.getElementById(`q_msg_${qi}`);
        msg.textContent = ok ? "✅ Correct !" : `❌ Réponse attendue : ${questions[qi]?.answer||"?"}`;
      });
    });

    qOut.querySelectorAll("[data-explain]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const i = +btn.dataset.explain;
        try{
          hasUI && UI.setBusy(btn, true);
          const r = await fetch("/api/quiz-explain", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({
              question: questions[i]?.q || "",
              topic: (document.querySelector("#quizForm [name=topic]")?.value)||"",
              age: +(document.querySelector("#quizForm [name=age]")?.value||12),
              per: (document.querySelector("#quizForm [name=per]")?.value)||"",
              language:"fr"
            })
          });
          const j = await r.json();
          const msg = document.getElementById(`q_msg_${i}`);
          msg.textContent = j?.explain || "…";
        }catch{
          /* ignore */
        }finally{
          hasUI && UI.setBusy(btn, false);
        }
      })
    });
  }

  // --------- VOCAB ----------
  const vForm = document.getElementById("vocabForm");
  const vOut  = document.getElementById("vocabOut");

  vForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = vForm.querySelector("[data-busy]") || vForm.querySelector("button");
    hasUI && UI.setBusy(btn, true);
    vOut.innerHTML = "";

    try{
      const fd = new FormData(vForm);
      const payload = {
        lang:  fd.get("lang") || "anglais",
        level: fd.get("level")||"A1",
        topic: fd.get("topic")||"vie quotidienne",
        count: 10,
        language: "fr"
      };
      const r = await fetch("/api/vocab", {
        method:"POST", headers:{ "Content-Type":"application/json"},
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      renderVocab(data);
    } catch(err){
      vOut.innerHTML = `<div class="card pad">Erreur. Réessaie.</div>`;
    } finally {
      hasUI && UI.setBusy(btn, false);
    }
  });

  function renderVocab(data){
    const items = Array.isArray(data?.items)? data.items : [];
    if(!items.length){
      vOut.innerHTML = `<div class="card pad">Aucun item reçu.</div>`;
      return;
    }

    vOut.innerHTML = `
      <div class="grid" style="grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap:12px">
        ${ items.map((it,idx)=>`
          <article class="card3d" tabindex="0">
            <div class="inner">
              <div class="face front">
                <div class="emoji">🗣️</div>
                <div class="card-title">${escapeHTML(it.term || "?")}</div>
              </div>
              <div class="face back">
                <strong>${escapeHTML(it.translation || "")}</strong><br/>
                <small class="muted">${escapeHTML(it.example || "")}</small><br/>
                <small>${escapeHTML(it.tip || "")}</small>
              </div>
            </div>
          </article>
        `).join("") }
      </div>
    `;

    // flip
    vOut.querySelectorAll(".card3d").forEach(card=>{
      card.addEventListener("click", ()=>card.classList.toggle("is-flipped"));
      card.addEventListener("keydown", (e)=>{ if(e.key==="Enter") card.classList.toggle("is-flipped"); });
    });
  }

  function escapeHTML(s){return (s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));}
})();
