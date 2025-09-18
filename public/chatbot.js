// public/chatbot.js — client léger pour /api/chat
(function(){
  "use strict";

  // ---------- utils ----------
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const log = (...a)=>console.log("%c[chatbot]","color:#0af",...a);

  // ---------- langue : auto-détection + overrides ----------
  const URL_LANG = new URLSearchParams(location.search).get("lang");
  const PAGE_LANG = (document.documentElement.lang || "fr").slice(0,2).toLowerCase();
  const PRESET_LANG = (window.__CHATBOT_LANG || "").slice(0,2).toLowerCase();

  // Dictionnaires ultra-légers pour heuristique
  const EN_WORDS = ["what","who","which","how","his","her","their","can","could","does","do","tell","about","strength","strengths","talent","talents","experience","skills"];
  const DE_WORDS = ["was","wer","wie","welche","welcher","welches","seine","ihre","deren","kann","können","stärken","talent","talente","erfahrung","fähigkeiten","kompetenzen"];
  const FR_WORDS = ["quel","quelle","quels","quelles","est-ce","peut","peut-il","ses","compétences","atouts","forces","talent","talents","expérience"];

  function countMatches(words, text){
    const t = " " + text.toLowerCase() + " ";
    let n = 0;
    for (const w of words){
      if (t.includes(" " + w + " ")) n++;
    }
    return n;
  }

  function detectLangFromInput(q){
    const s = String(q || "").trim();
    if (!s) return null;

    // Indices simples : caractères spécifiques DE/FR
    if (/[äöüß]/i.test(s)) return "de";
    if (/[àâçéèêëîïôûùüÿœ]/i.test(s)) return "fr";

    // Scores mots-clés
    const en = countMatches(EN_WORDS, s);
    const de = countMatches(DE_WORDS, s);
    const fr = countMatches(FR_WORDS, s);

    if (en > de && en > fr) return "en";
    if (de > en && de > fr) return "de";
    if (fr > en && fr > de) return "fr";
    return null;
  }

  function resolveLang(q){
    // 1) URL ?lang=  2) variable globale  3) auto-détection du message  4) <html lang>  5) fr
    return (URL_LANG && URL_LANG.match(/^(fr|en|de)$/)?.[0])
        || (PRESET_LANG && PRESET_LANG.match(/^(fr|en|de)$/)?.[0])
        || detectLangFromInput(q)
        || (PAGE_LANG.match(/^(fr|en|de)$/)?.[0] || "fr");
  }

  function langHint(l){
    if (l === "en") return "[Please answer in English.] ";
    if (l === "de") return "[Bitte antworte auf Deutsch.] ";
    return "[Réponds en français.] ";
  }

  // ---------- refs UI ----------
  const logEl     = $("#chatLog");
  const input     = $("#chatInput");
  const sendBtn   = $("#chatSend");
  const conciseCb = $("#concise");
  const radios    = $$("#liberty input[type=radio]");
  const legacyRange = $("#libertySlider"); // s'il existe encore

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

    // langue choisie pour CETTE question
    const lang = resolveLang(q);
    const hint = langHint(lang);

    const body = {
      message: hint + q,
      liberty: getLiberty(),
      history: [],
      lang // si ton backend veut aussi en tenir compte
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
          lang==="de" ? "Der Dienst ist vorübergehend nicht verfügbar."
          : lang==="en" ? "The service is temporarily unavailable."
          : "Désolé, le service est momentanément indisponible.",
          "bot"
        );
        return;
      }

      const content = (typeof data.answer === "string")
        ? data.answer
        : (data.answer?.content || "");

      addBubble(makeConcise(content), "bot");
    }catch(e){
      console.error(e);
      addBubble(
        "fr"===resolveLang("") ? "Erreur réseau. Réessayez dans un instant."
        : "de"===resolveLang("") ? "Netzwerkfehler. Bitte versuchen Sie es gleich noch einmal."
        : "Network error. Please try again in a moment.",
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
  const helloLang = resolveLang("");
  const hello =
    helloLang==="de" ? "Hallo! Stellen Sie eine Frage zum Kandidaten."
    : helloLang==="en" ? "Hello! Ask a question about the candidate."
    : "Bonjour ! Posez une question sur le candidat.";
  addBubble(hello, "bot");
})();
