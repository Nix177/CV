/* Aventure linguistique — Conversation IA guidée
   - /api/lang-seed : génère la mission (titre, intro, scènes, objectifs, vocabulaire)
   - /api/lang-reply : évalue la réponse utilisateur, renvoie feedback/correction/ligne PNJ
   - Fallbacks locaux si API indisponible (contenus et évaluation heuristique)
*/
(function(){
  const S = {
    seed: null,        // { title, intro, npc, scenes[], badges[], goals[] }
    sceneIdx: 0,       // index scène courante
    score: 0,
    lang: "en",
    busy: false,
  };

  // --- DOM
  const form = document.getElementById("gl_form");
  const statusEl = document.getElementById("gl_status");
  const badgesEl = document.getElementById("gl_badges");
  const introEl = document.getElementById("gl_intro");
  const scoreEl = document.getElementById("gl_score");
  const stageEl = document.getElementById("gl_stage");
  const dialogEl = document.getElementById("gl_dialog");
  const inputForm = document.getElementById("gl_input");
  const userText = document.getElementById("user_text");
  const hintBtn = document.getElementById("hintBtn");
  const explainBtn = document.getElementById("explainBtn");
  const goalsEl = document.getElementById("gl_goals");

  const hasUI = typeof window.UI?.setBusy === "function";

  function setBusy(el, v){
    if (!hasUI) return;
    UI.setBusy(el, v);
  }

  // --- Helpers UI
  function addMsg({ who, text }){
    const row = document.createElement("div");
    row.className = "msg " + (who==="me" ? "me" : "npc");
    row.innerHTML = `
      <div class="msg-row">
        <div class="avatar">${who==="me"?"🙂":"🧑‍🏫"}</div>
        <div>
          <div class="bubble">${escapeHTML(text)}</div>
          <div class="meta">${who==="me" ? labelMe() : (S.seed?.npc?.name || "Tutor")}</div>
        </div>
      </div>
    `;
    dialogEl.appendChild(row);
    dialogEl.scrollTop = dialogEl.scrollHeight;
  }
  function labelMe(){
    if (S.lang==="fr") return "Vous";
    if (S.lang==="de") return "Sie";
    return "You";
  }

  function updateHUD(){
    scoreEl.textContent = `⭐ ${S.score}`;
    const total = S.seed?.scenes?.length || 0;
    stageEl.textContent = `Scène ${Math.min(S.sceneIdx+1,total)}/${total}`;
  }

  // --- Seed
  async function generateSeed(params){
    try{
      statusEl.textContent = (params.lang==="fr")?"Génération en cours…":(params.lang==="de"?"Wird erstellt…":"Generating…");
      const r = await fetch("/api/lang-seed", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(params)
      });
      const j = await r.json();
      return j && j.title ? j : fallbackSeed(params);
    }catch{
      return fallbackSeed(params);
    } finally {
      statusEl.textContent = "Prêt.";
    }
  }

  function fallbackSeed({lang="en", level="A2", topic="voyage"}){
    const t = topic || (lang==="fr"?"voyage":lang==="de"?"Reise":"travel");
    const npcName = (lang==="fr")?"Agent de gare":(lang==="de")?"Bahnhof-Agent":"Station Agent";
    const title = (lang==="fr")?`Mission: ${t}`:(lang==="de")?`Mission: ${t}`:`Mission: ${t}`;
    const intro = (lang==="fr")
      ? "Vous arrivez dans une gare internationale. Échangez dans la langue cible pour obtenir votre billet et des informations."
      : (lang==="de")
      ? "Sie kommen in einem internationalen Bahnhof an. Sprechen Sie in der Zielsprache, um Ticket und Informationen zu erhalten."
      : "You arrive at an international station. Use the target language to get your ticket and information.";
    const scenes = [
      {
        id: "scene1",
        scene_title: (lang==="fr")?"Trouver le guichet":(lang==="de")?"Schalter finden":"Find the ticket desk",
        situation: (lang==="fr")?"Demandez poliment où acheter un billet pour le centre-ville."
                  :(lang==="de")?"Fragen Sie höflich, wo Sie ein Ticket für die Innenstadt kaufen können."
                  :"Politely ask where to buy a ticket to the city center.",
        goals: [
          (lang==="fr")?"Formuler une question polie":(lang==="de")?"Höfliche Frage formulieren":"Formulate a polite question",
          (lang==="fr")?"Utiliser le vocabulaire du transport":(lang==="de")?"Wortschatz Verkehr nutzen":"Use transport vocabulary"
        ],
        expected_keywords: (lang==="fr")?["où","billet","centre-ville"]
                             :(lang==="de")?["wo","Fahrschein","Stadtzentrum"]
                             :["where","ticket","city center"],
        hints: (lang==="fr")?["Commencez par « Excusez-moi … »","Incluez le mot « billet »"]
              :(lang==="de")?["Beginnen Sie mit „Entschuldigen Sie …“","Benutzen Sie das Wort „Fahrschein“"]
              :["Start with 'Excuse me…'","Include the word 'ticket'"],
        vocab: (lang==="fr")?[{"term":"guichet","translation":"ticket desk"},{"term":"aller simple","translation":"one-way"}]
              :(lang==="de")?[{"term":"Schalter","translation":"guichet/ticket desk"},{"term":"Einzelfahrschein","translation":"aller simple"}]
              :[{"term":"ticket desk","translation":"guichet"},{"term":"one-way","translation":"aller simple"}]
      },
      {
        id: "scene2",
        scene_title: (lang==="fr")?"Choisir le billet":(lang==="de")?"Fahrschein wählen":"Choose the ticket",
        situation: (lang==="fr")?"Demandez un aller-retour pour aujourd’hui et vérifiez le quai."
                  :(lang==="de")?"Bitten Sie um Hin- und Rückfahrt für heute und fragen Sie nach dem Gleis."
                  :"Ask for a return ticket for today and check the platform.",
        goals: [
          (lang==="fr")?"Mentionner type de billet":(lang==="de")?"Art des Tickets angeben":"Specify ticket type",
          (lang==="fr")?"Demander le quai":(lang==="de")?"Nach dem Gleis fragen":"Ask for the platform"
        ],
        expected_keywords: (lang==="fr")?["aller-retour","aujourd’hui","quai"]
                             :(lang==="de")?["Hin- und Rückfahrt","heute","Gleis"]
                             :["return","today","platform"],
        hints: (lang==="fr")?["Utilisez « aller-retour »","Demandez « Quel quai ? »"]
              :(lang==="de")?["Benutzen Sie „Hin- und Rückfahrt“","Fragen Sie: „Welches Gleis?“"]
              :["Say 'return ticket'","Ask: 'Which platform?'"],
        vocab: (lang==="fr")?[{"term":"quai","translation":"platform"},{"term":"horaire","translation":"timetable"}]
              :(lang==="de")?[{"term":"Gleis","translation":"platform/quai"},{"term":"Fahrplan","translation":"timetable"}]
              :[{"term":"platform","translation":"quai"},{"term":"timetable","translation":"horaire"}]
      },
      {
        id: "scene3",
        scene_title: (lang==="fr")?"Situation imprévue":(lang==="de")?"Unerwartete Situation":"Unexpected situation",
        situation: (lang==="fr")?"Le train est retardé. Demandez la durée du retard et une alternative."
                  :(lang==="de")?"Der Zug hat Verspätung. Fragen Sie nach der Dauer und einer Alternative."
                  :"The train is delayed. Ask about the delay and an alternative.",
        goals: [
          (lang==="fr")?"Exprimer une demande polie":(lang==="de")?"Höflich um Auskunft bitten":"Ask politely",
          (lang==="fr")?"Comprendre l’alternative":(lang==="de")?"Alternative verstehen":"Understand the alternative"
        ],
        expected_keywords: (lang==="fr")?["retard","combien de temps","autre/train suivant"]
                             :(lang==="de")?["Verspätung","wie lange","Alternative/nächster Zug"]
                             :["delay","how long","alternative/next train"],
        hints: (lang==="fr")?["Demandez « Combien de temps ? »","Proposez « Y a-t-il un autre train ? »"]
              :(lang==="de")?["Fragen Sie „Wie lange?“","Fragen Sie: „Gibt es einen anderen Zug?“"]
              :["Ask 'How long?'","'Is there another train?'"],
        vocab: (lang==="fr")?[{"term":"retard","translation":"delay"},{"term":"correspondance","translation":"connection"}]
              :(lang==="de")?[{"term":"Verspätung","translation":"retard"},{"term":"Anschluss","translation":"connection"}]
              :[{"term":"delay","translation":"retard"},{"term":"connection","translation":"correspondance"}]
      }
    ];
    return {
      title, intro,
      npc: { name: npcName, persona: (lang==="fr")?"Agent serviable, ton formel (vous).":(lang==="de")?"Hilfsbereiter Agent, Sie-Form.":"Helpful agent, polite tone." },
      badges:[{label: t},{label: `Niveau ${level}`}],
      scenes
    };
  }

  // --- Start mission
  async function startMission(seed){
    S.seed = seed;
    S.sceneIdx = 0;
    S.score = 0;
    S.lang = guessLang(); // from select

    // badges + intro
    badgesEl.innerHTML = (seed.badges||[]).map(b=>`<span class="pill">🏷️ ${escapeHTML(b.label||"")}</span>`).join("");
    introEl.textContent = seed.intro || "";
    updateHUD();

    // reset dialog
    dialogEl.innerHTML = "";
    addMsg({ who:"npc", text: openingLine(seed) });
    showGoals(seed.scenes[0]);
  }

  function openingLine(seed){
    if (S.lang==="fr") return `🎯 ${seed.title}\n${seed.scenes?.[0]?.situation||""}`;
    if (S.lang==="de") return `🎯 ${seed.title}\n${seed.scenes?.[0]?.situation||""}`;
    return `🎯 ${seed.title}\n${seed.scenes?.[0]?.situation||""}`;
  }

  function guessLang(){
    const sel = form.querySelector('[name="lang"]');
    return sel?.value || "en";
  }

  function showGoals(scene){
    goalsEl.innerHTML = `
      <div class="card pad">
        <strong>${escapeHTML(scene.scene_title||"Scene")}</strong>
        <p class="gl-mini">${escapeHTML(scene.situation||"")}</p>
        <ul class="gl-mini" style="margin:0 0 6px 18px">
          ${ (scene.goals||[]).map(g=>`<li>${escapeHTML(g)}</li>`).join("") }
        </ul>
        ${ (scene.vocab?.length) ? `
          <details><summary><strong>Vocabulaire</strong></summary>
            <ul class="gl-mini" style="margin:6px 0 0 18px">
              ${ scene.vocab.map(v=>`<li><code>${escapeHTML(v.term)}</code> — ${escapeHTML(v.translation)}</li>`).join("") }
            </ul>
          </details>` : "" }
      </div>
    `;
  }

  // --- Reply pipeline
  async function sendUserMessage(text, {explain=false, hint=false} = {}){
    const scene = S.seed.scenes[S.sceneIdx];
    addMsg({ who:"me", text });
    setBusy(inputForm.querySelector("[data-busy]"), true);

    try{
      const r = await fetch("/api/lang-reply", {
        method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          lang: S.lang,
          scene,
          user_text: text,
          explain,
          hint
        })
      });
      const j = await r.json();
      handleEval(j, scene);
    } catch {
      // fallback heuristique
      const j = heuristicEval(S.lang, scene, text, {explain, hint});
      handleEval(j, scene);
    } finally {
      setBusy(inputForm.querySelector("[data-busy]"), false);
    }
  }

  function handleEval(j, scene){
    if (j?.npc_line) addMsg({ who:"npc", text: j.npc_line });
    if (j?.feedback) addMsg({ who:"npc", text: j.feedback });
    if (j?.correction) addMsg({ who:"npc", text: j.correction });
    if (j?.hint && j.hint !== true) addMsg({ who:"npc", text: "💡 " + j.hint });

    if (j?.score_inc) { S.score += j.score_inc; }
    updateHUD();

    if (j?.done){
      // next scene or end
      if (S.sceneIdx < (S.seed.scenes.length - 1)){
        S.sceneIdx++;
        const next = S.seed.scenes[S.sceneIdx];
        addMsg({ who:"npc", text: (S.lang==="fr")?"✅ Scène réussie. Scène suivante :":"✅ Szene geschafft. Nächste Szene:" });
        addMsg({ who:"npc", text: `🎯 ${next.scene_title}\n${next.situation}` });
        showGoals(next);
        updateHUD();
      } else {
        addMsg({ who:"npc", text: (S.lang==="fr")?`🏁 Mission terminée ! Score final : ${S.score}`
                                :(S.lang==="de")?`🏁 Mission abgeschlossen! Endpunktzahl: ${S.score}`
                                :`🏁 Mission complete! Final score: ${S.score}` });
      }
    }
  }

  // --- Heuristique locale (fallback si pas d'API)
  function heuristicEval(lang, scene, text, {explain, hint}={}){
    const clean = (s)=> (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    const u = clean(text);
    const kws = (scene.expected_keywords||[]).map(clean);
    let hit = 0;
    kws.forEach(k=>{ if (k && u.includes(k)) hit++; });

    let ok = hit >= Math.max(1, Math.ceil(kws.length/2));
    const out = {
      ok,
      met_goals: ok ? scene.goals : [],
      score_inc: ok ? 20 : 5,
      npc_line: ok
        ? (lang==="fr"?"Bien, merci.":"Gut, danke.")
        : (lang==="fr"?"Je vous propose une reformulation.":"Ich schlage eine Umformulierung vor."),
      feedback: ok
        ? (lang==="fr"?"✅ Votre message répond globalement à la consigne.":"✅ Ihre Nachricht passt insgesamt.")
        : (lang==="fr"?"❌ Il manque certains éléments clés.":"❌ Einige Schlüsselteile fehlen."),
      correction: ok ? null :
        (lang==="fr"?"Exemple possible : « Excusez-moi, où puis-je acheter un billet pour le centre-ville ? »"
                    :"Beispiel: „Entschuldigen Sie, wo kann ich ein Ticket für das Stadtzentrum kaufen?“"),
      done: ok
    };

    if (hint){
      out.hint = (scene.hints?.[0]) || ((lang==="fr")?"Utilisez un ton poli et le mot-clé du thème.":"Nutzen Sie Höflichkeitsform und das Schlüsselwort.");
    }
    if (explain){
      out.feedback = (lang==="fr")
        ? "Objectifs : utilisez un ton poli et au moins deux mots-clés du thème."
        : (lang==="de")
        ? "Ziele: höfliche Form und mindestens zwei thematische Schlüsselwörter verwenden."
        : "Goals: polite tone and at least two topic keywords.";
    }
    return out;
  }

  // --- Events
  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = form.querySelector("[data-busy]");
    setBusy(btn, true);
    try{
      const fd = new FormData(form);
      const lang = fd.get("lang") || "en";
      const level = (fd.get("level")||"A2").toString().trim();
      const topic = (fd.get("topic")||"voyage").toString().trim();

      S.lang = lang;
      const seed = await generateSeed({ lang, level, topic });
      await startMission(seed);
    } finally {
      setBusy(form.querySelector("[data-busy]"), false);
    }
  });

  inputForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const text = (userText.value||"").trim();
    if (!text) return;
    userText.value = "";
    await sendUserMessage(text);
  });

  hintBtn.addEventListener("click", async ()=>{
    await sendUserMessage("(hint)", { hint:true });
  });
  explainBtn.addEventListener("click", async ()=>{
    await sendUserMessage("(explain)", { explain:true });
  });

  function escapeHTML(s){return (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
})();
