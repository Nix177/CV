/* =========================================================
   Fun Facts — API-first
   - GET /api/ff-batch?lang=xx&count=9&q=...
   - POST /api/ff-feedback
   Fallback: /facts-data.json (si API HS)
   ========================================================= */
(() => {
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  // Lang depuis l'URL (fun-facts[-en|-de].html)
  const path = (location.pathname.split('/').pop() || 'fun-facts.html').trim();
  const m = path.match(/^(.+?)(?:-(en|de))?\.html?$/i);
  const lang = (m && m[2]) ? m[2] : 'fr';

  const I18N = {
    fr:{ searchPh:"Rechercher une idée reçue…", random:"🎲 Nouveau lot aléatoire", source:"Source", seeSource:"Voir la source", flip:"Retourner", myth:"Mythe", fact:"Fait vérifié", items:n=>`${n} idées`, thanks:"Merci !", error:"Échec d’envoi. Réessaie." },
    en:{ searchPh:"Search a misconception…",  random:"🎲 New random batch",       source:"Source", seeSource:"See source",   flip:"Flip",     myth:"Myth",  fact:"Verified fact", items:n=>`${n} items`, thanks:"Thanks!", error:"Send failed. Try again." },
    de:{ searchPh:"Irrtum suchen…",            random:"🎲 Neuer zufälliger Satz",   source:"Quelle", seeSource:"Quelle öffnen", flip:"Umdrehen", myth:"Mythos", fact:"Geprüfte Tatsache", items:n=>`${n} Einträge`, thanks:"Danke!", error:"Senden fehlgeschlagen." }
  }[lang];

  // UI strings
  document.addEventListener('DOMContentLoaded', ()=>{
    const s=$("#ff_search"); if (s) s.placeholder=I18N.searchPh;
    const r=$("#ff_random"); if (r) r.textContent=I18N.random;
  });

  // --- Data ---------------------------------------------------------------
  async function fetchBatchAPI({q="", count=9}={}){
    const url = `/api/ff-batch?lang=${encodeURIComponent(lang)}&count=${count}${q?`&q=${encodeURIComponent(q)}`:""}`;
    const r = await fetch(url, {cache:'no-store'});
    if (!r.ok) throw new Error("API batch error");
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error("Bad API payload");
    return data;
  }

  async function loadFallbackFile(){
    const candidates = ["/facts-data.json","/assets/data/facts-data.json"];
    for (const u of candidates){
      try{
        const r = await fetch(u, {cache:'no-store'});
        if (r.ok){
          const json = await r.json();
          return Array.isArray(json.items||json) ? (json.items||json) : [];
        }
      }catch{}
    }
    return [];
  }

  const rand = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
  const shuffle = arr => arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(v=>v[1]);
  const words = t => (t||"").trim().split(/\s+/).filter(Boolean);
  const trimWords = (t,max=30)=>{const w=words(t); return w.length<=max?t:w.slice(0,max).join(" ")+"…";};
  const byLang = (obj, fallback) => (obj && (obj[lang]||obj['en']||obj['fr'])) || fallback || "";

  function pickRandomBatch(all, n=9, q=""){
    let pool = all.slice();
    if (q){
      const t=q.toLowerCase();
      pool = pool.filter(f =>
        (f.title && (f.title[lang]||f.title.en||f.title.fr||"").toLowerCase().includes(t)) ||
        (f.claim && (f.claim[lang]||f.claim.en||f.claim.fr||"").toLowerCase().includes(t)) ||
        (f.truth && (f.truth[lang]||f.truth.en||f.truth.fr||"").toLowerCase().includes(t)) ||
        (f.category && (f.category[lang]||f.category.en||f.category.fr||"").toLowerCase().includes(t)) ||
        ((f.type||"").toLowerCase().includes(t))
      );
    }
    return shuffle(pool).slice(0,n);
  }

  function renderCards(root, items){
    root.innerHTML="";
    for (const f of items){
      const title = byLang(f.title, f.claim || "—");
      const claim = byLang(f.claim, title);
      const truth = trimWords(byLang(f.truth, ""), 30);
      const cat   = byLang(f.category, f.type || "");
      const src   = (f.sources && f.sources[0]) ? f.sources[0] : null;

      const el = document.createElement("article");
      el.className = "ff-card";
      el.innerHTML = `
        <div class="inner">
          <div class="ff-face ff-front">
            <div class="ff-tags">
              <span class="ff-badge">${I18N.myth}</span>
              ${cat?`<span class="ff-badge">${cat}</span>`:""}
            </div>
            <h3 class="h3" style="margin:4px 0 2px">${title}</h3>
            ${claim && claim!==title ? `<p class="muted" style="margin:0">${claim}</p>`:""}
            <div class="ff-actions">
              <button class="btn" data-act="flip">${I18N.flip}</button>
              ${src?`<a class="btn linkish" target="_blank" rel="noopener" href="${src.url}">${I18N.seeSource}</a>`:""}
            </div>
          </div>
          <div class="ff-face ff-back">
            <div class="ff-tags">
              <span class="ff-badge">${I18N.fact}</span>
              ${cat?`<span class="ff-badge">${cat}</span>`:""}
            </div>
            <p style="margin:4px 0 8px">${truth || "—"}</p>
            <div class="ff-actions">
              <button class="btn" data-act="flip">${I18N.flip}</button>
              ${src?`<a class="btn" target="_blank" rel="noopener" href="${src.url}">${I18N.source}</a>`:""}
            </div>
          </div>
        </div>`;
      el.addEventListener("click",(ev)=>{
        if (ev.target.closest("[data-act='flip']")){
          el.dataset.flipped = el.dataset.flipped==="1" ? "0" : "1";
        }
      });
      root.appendChild(el);
    }
  }

  function renderCloud(box, items){
    box.innerHTML="";
    const pad=12, W=box.clientWidth||900, H=Math.max(box.clientHeight||300,260);
    const used=[];
    const ok = r => !used.some(u=>Math.hypot((u.x+u.r)-(r.x+r.r),(u.y+u.r)-(r.y+r.r))<(u.r+r.r+8));
    for (const f of items){
      const w=rand(120,200), h=rand(60,100);
      const r={x:rand(pad,Math.max(pad,W-w-pad)), y:rand(pad,Math.max(pad,H-h-pad)), r:Math.min(w,h)/2};
      let tries=60; while(tries-- && !ok(r)){ r.x=rand(pad,Math.max(pad,W-w-pad)); r.y=rand(pad,Math.max(pad,H-h-pad)); }
      used.push(r);
      const b=document.createElement("button");
      b.className="ff-bubble";
      b.style.cssText=`left:${r.x}px;top:${r.y}px;width:${w}px;height:${h}px`;
      b.innerHTML=`<span>${byLang(f.title,f.claim||"—")}</span>`;
      b.addEventListener("click", ()=>{
        const idx = items.indexOf(f);
        const card = $$(".ff-card")[idx];
        if (card){ card.scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>{card.dataset.flipped="1"},250); }
      });
      box.appendChild(b);
    }
  }

  function updateCount(n){ const el=$("#ff_count"); if (el) el.textContent=I18N.items(n); }

  // --- Feedback ------------------------------------------------------------
  function enqueueLocalFeedback(entry){
    const k="ff_feedback_queue";
    const q=JSON.parse(localStorage.getItem(k)||"[]");
    q.push(entry);
    localStorage.setItem(k, JSON.stringify(q));
  }
  async function flushQueue(){
    const k="ff_feedback_queue";
    const q=JSON.parse(localStorage.getItem(k)||"[]");
    if (!q.length) return;
    const keep=[];
    for (const entry of q){
      try{ await sendFeedback(entry); }
      catch{ keep.push(entry); }
    }
    localStorage.setItem(k, JSON.stringify(keep));
  }
  async function sendFeedback({text, lang, page}){
    const res = await fetch("/api/ff-feedback",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({
        text, lang, page,
        ua: navigator.userAgent,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      })
    });
    if (!res.ok) throw new Error("feedback failed");
  }
  function mountFeedback(){
    const form=$("#ff_feedback_form"); if(!form) return;
    const ta=$("#ff_feedback");
    const hp=$("#ff_hp");
    const msg=$("#ff_msg");
    form.addEventListener("submit", async (e)=>{
      e.preventDefault();
      const text=(ta.value||"").trim();
      if (hp.value) return; // honeypot
      if (!text) return;
      const entry={text, lang, page:"fun-facts", ts:new Date().toISOString()};
      try{
        await sendFeedback(entry);
        msg.textContent = I18N.thanks;
      }catch{
        enqueueLocalFeedback(entry);
        msg.textContent = I18N.thanks; // on remercie quand même; sera flush plus tard
      }
      ta.value="";
      setTimeout(()=>{ msg.textContent=""; },3000);
    });
    window.addEventListener("online", flushQueue);
    flushQueue();
  }

  // --- Orchestration -------------------------------------------------------
  let FALLBACK = [];
  async function refreshFromAPI(){
    const q=$("#ff_search")?.value?.trim()||"";
    const cards=$("#ff_cards"); const cloud=$("#ff_cloud");
    const batch = await fetchBatchAPI({q, count:9});
    renderCards(cards,batch);
    renderCloud(cloud,batch);
    updateCount(batch.length);
  }
  function refreshFromFallback(){
    const q=$("#ff_search")?.value?.trim()||"";
    const cards=$("#ff_cards"); const cloud=$("#ff_cloud");
    const batch = pickRandomBatch(FALLBACK, 9, q);
    renderCards(cards,batch);
    renderCloud(cloud,batch);
    updateCount(batch.length);
  }

  async function main(){
    mountFeedback();
    const root=$("#ff_root");

    // essai API
    try{
      await refreshFromAPI();
      $("#ff_random")?.addEventListener("click", refreshFromAPI);
      $("#ff_search")?.addEventListener("input", refreshFromAPI);
      root.classList.remove("ff-pending"); root.classList.add("ff-ready");
      return;
    }catch{
      // fallback file
      FALLBACK = await loadFallbackFile();
      if (FALLBACK.length){
        refreshFromFallback();
        $("#ff_random")?.addEventListener("click", refreshFromFallback);
        $("#ff_search")?.addEventListener("input", refreshFromFallback);
      }
      root.classList.remove("ff-pending"); root.classList.add("ff-ready");
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
})();
