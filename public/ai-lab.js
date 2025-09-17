/* ============ QUIZ ============ */

// Lang strings (court; français par défaut)
const I18N = {
  fr: {
    right: "Juste",
    wrong: "Faux",
    explain: "Je n’ai pas compris",
    check: "Corriger",
    again: "Rejouer / Regénérer",
    empty: "Aucune question reçue.",
    badge: "Cycle",
  },
  de: {
    right: "Richtig",
    wrong: "Falsch",
    explain: "Ich habe es nicht verstanden",
    check: "Prüfen",
    again: "Neu generieren",
    empty: "Keine Fragen empfangen.",
    badge: "Zyklus",
  },
  en: {
    right: "Correct",
    wrong: "Wrong",
    explain: "I didn’t understand",
    check: "Check",
    again: "Regenerate",
    empty: "No questions received.",
    badge: "Cycle",
  }
};

const $qTheme = document.getElementById("qTheme");
const $qAge   = document.getElementById("qAge");
const $qCnt   = document.getElementById("qCount");
const $qObj   = document.getElementById("qObjectives");
const $qLang  = document.getElementById("qLang");
const $qOut   = document.getElementById("qOut");
const $qGen   = document.getElementById("qGen");

$qGen.addEventListener("click", () => {
  const lang = $qLang.value;
  const t = ($qTheme.value || "").trim().toLowerCase();
  const age = Math.max(4, Math.min(17, Number($qAge.value) || 10));
  const count = Math.max(3, Math.min(15, Number($qCnt.value) || 5));
  const obj = ($qObj.value || "").trim();

  const cycle = ageToCycle(age); // C1/C2/C3
  const qs = generateQuiz({ theme: t, cycle, count, lang, objectives: obj });
  renderQuiz(qs, lang, cycle);
});

function ageToCycle(age){
  if (age <= 8) return "C1";     // 1–2P
  if (age <= 11) return "C2";    // 3–6P
  return "C3";                   // 7–8–9–11S (approx)
}

/* Thèmes PER (très simplifiés / exemples) */
const BANK = {
  // Français (lecture, vocabulaire, compréhension)
  FR: {
    C1: [
      qTF("Dans une histoire, le titre aide à deviner de quoi parle le texte.", true, "Le titre donne un indice important sur le sujet."),
      qMC("Quel mot rime avec 'chat' ?", ["rat","nez","livre"], 0, "On écoute la fin du mot : chat / rat."),
      qMC("Dans la phrase « Le chien court vite », quel est le verbe ?", ["chien","court","vite"], 1, "Le verbe indique l’action : ‘court’.")
    ],
    C2: [
      qTF("Un paragraphe commence généralement par une majuscule.", true, "On respecte la mise en page et la ponctuation."),
      qMC("Quel synonyme convient pour 'content' ?", ["heureux","triste","ennuyé"], 0, "‘Heureux’ signifie ‘content’."),
      qMC("Repère la phrase exclamative.", ["Aide-moi.","Quel beau jour !","Je viens."], 1, "Le point d’exclamation marque l’exclamation.")
    ],
    C3: [
      qTF("Un argument doit être justifié par un exemple ou une preuve.", true, "On développe avec des exemples."),
      qMC("Quel connecteur introduit une cause ?", ["par conséquent","parce que","cependant"], 1, "‘Parce que’ explique la raison."),
      qMC("Dans un récit, la focalisation interne suit la vision d’un personnage.", ["Vrai","Faux"], 0, "On sait ce que pense/voit un personnage.")
    ],
  },

  // Mathématiques (MSN)
  MSN: {
    C1: [
      qMC("Combien font 7 + 5 ?", ["10","12","13"], 1, "On additionne : 7 + 5 = 12."),
      qTF("Un rectangle a quatre côtés.", true, "Deux paires de côtés parallèles."),
      qMC("Quelle monnaie vaut 1 franc ?", ["2 pièces de 20 ct","4 pièces de 20 ct","1 pièce de 50 ct et 1 de 20 ct"], 1, "4×20ct=80ct ≠ 1fr ; 50+20=70ct ≠ 1fr ; (question piège)")
    ],
    C2: [
      qMC("La moitié de 18 est…", ["8","9","10"], 1, "18 ÷ 2 = 9."),
      qTF("Une fraction 3/4 signifie trois parts sur quatre parts égales.", true, "Numérateur/denominateur."),
      qMC("Le périmètre d’un rectangle 5×3 est…", ["8","15","16"], 2, "2×(5+3)=16.")
    ],
    C3: [
      qMC("10% de 250 = ?", ["20","25","30"], 1, "10% = 1/10 → 250/10=25."),
      qTF("Une droite perpendiculaire forme un angle de 90°.", true, "Angle droit."),
      qMC("La médiane d’une série [2,9,1,5,5] est…", ["5","4","3"], 0, "Triée [1,2,5,5,9] → médiane 5.")
    ],
  },

  // NMG / Sciences / Histoire / Climat (simplifié)
  SCI: {
    C1: [
      qTF("Le soleil est une étoile.", true, "C’est l’étoile au centre du système solaire."),
      qMC("Quelle saison suit l’automne ?", ["hiver","printemps","été"], 0, "Automne → hiver."),
      qMC("Lequel est un animal domestique ?", ["vache","renard","loutre"], 0, "La vache peut être domestiquée (ferme).")
    ],
    C2: [
      qTF("Le recyclage permet d’économiser des ressources.", true, "On réutilise la matière."),
      qMC("Quel gaz est majoritaire dans l’air ?", ["oxygène","dioxyde de carbone","azote"], 2, "≈78% azote."),
      qMC("En Suisse, un canton est…", ["une ville","une région administrative","un pays"], 1, "Subdivision de la Confédération.")
    ],
      C3: [
      qTF("L’effet de serre retient une partie de la chaleur terrestre.", true, "Gaz à effet de serre."),
      qMC("Un referendum permet au peuple de…", ["élire le Conseil fédéral","voter une loi","nommer les juges"], 1, "Démocratie directe."),
      qMC("Quel est l’ordre croissant ?", ["-3, -1, 0, 2","2,0,-1,-3","0,-1,2,-3"], 0, "Du plus petit au plus grand.")
    ],
  }
};

// Constructeurs rapides
function qTF(prompt, truth, exp){ 
  return {type:"tf", prompt, choices:["Vrai","Faux"], answer: truth ? 0 : 1, explain: exp };
}
function qMC(prompt, choices, goodIndex, exp){
  return {type:"mc", prompt, choices, answer: goodIndex, explain: exp };
}

function pick(arr, k){
  const pool = [...arr], out=[];
  while (pool.length && out.length < k){
    const i = Math.floor(Math.random()*pool.length);
    out.push(pool.splice(i,1)[0]);
  }
  return out;
}

function generateQuiz({theme, cycle, count, lang, objectives}){
  // Sélection automatique d’un “domaine” à partir du thème
  const t = theme || "";
  let dom = "SCI";
  if (/fra|vocab|lecture|orth|gram/i.test(t)) dom = "FR";
  if (/math|msn|fraction|périm|pourcent|angle|géom/i.test(t)) dom = "MSN";
  if (/climat|histo|geo|science|energie|suisse/i.test(t)) dom = "SCI";

  let bank = (BANK[dom] && BANK[dom][cycle]) ? [...BANK[dom][cycle]] : [];
  // Si l’utilisateur tape un code PER, on “biaise” un peu la banque
  if (objectives) {
    if (/FRAN|FRA/i.test(objectives)) bank = bank.concat(BANK.FR[cycle]||[]);
    if (/MSN/i.test(objectives))      bank = bank.concat(BANK.MSN[cycle]||[]);
    if (/NMG|SCI|HIST|GEO/i.test(objectives)) bank = bank.concat(BANK.SCI[cycle]||[]);
  }
  if (!bank.length) return [];

  return pick(bank, Math.min(count, bank.length)).map((q,i)=>({
    ...q,
    id: `q${Date.now()}_${i+1}`,
    meta: { theme: theme || dom, cycle }
  }));
}

function renderQuiz(questions, lang, cycle){
  const L = I18N[lang] || I18N.fr;
  if (!questions.length){
    $qOut.classList.add("empty");
    $qOut.textContent = L.empty;
    return;
  }
  $qOut.classList.remove("empty");
  const frag = document.createDocumentFragment();

  // barre d’actions globale
  const topBar = document.createElement("div");
  topBar.className = "q-actions";
  const cycleBadge = document.createElement("span");
  cycleBadge.className = "badge";
  cycleBadge.textContent = `${L.badge}: ${cycle}`;
  topBar.appendChild(cycleBadge);

  const checkBtn = document.createElement("button");
  checkBtn.className = "btn";
  checkBtn.textContent = L.check;
  topBar.appendChild(checkBtn);

  const regenBtn = document.createElement("button");
  regenBtn.className = "btn";
  regenBtn.textContent = L.again;
  regenBtn.addEventListener("click", ()=> $qGen.click());
  topBar.appendChild(regenBtn);

  frag.appendChild(topBar);
  frag.appendChild(document.createElement("div")).className = "sep";

  questions.forEach((q,idx)=>{
    const item = document.createElement("div");
    item.className = "q-item";

    const head = document.createElement("div");
    head.className = "q-head";
    head.innerHTML = `<span class="q-num">${idx+1}.</span> <div>${q.prompt}</div>`;
    item.appendChild(head);

    const choice = document.createElement("div");
    choice.className = "choice";

    q.choices.forEach((c,i)=>{
      const id = `${q.id}_${i}`;
      const label = document.createElement("label");
      label.setAttribute("for", id);
      label.innerHTML = `<input type="radio" name="${q.id}" id="${id}" value="${i}"> ${c}`;
      choice.appendChild(label);
    });
    item.appendChild(choice);

    const exp = document.createElement("div");
    exp.className = "q-exp muted";
    const expBtn = document.createElement("button");
    expBtn.className = "btn";
    expBtn.textContent = I18N[lang]?.explain || I18N.fr.explain;
    expBtn.addEventListener("click", ()=>{
      exp.textContent = q.explain || "";
    });
    item.appendChild(expBtn);
    item.appendChild(exp);

    frag.appendChild(item);
  });

  $qOut.innerHTML = "";
  $qOut.appendChild(frag);

  // correction
  topBar.querySelector(".btn").addEventListener("click", ()=>{
    let good=0, total=questions.length;
    questions.forEach(q=>{
      const checked = document.querySelector(`input[name="${q.id}"]:checked`);
      const ok = checked && Number(checked.value)===q.answer;
      if (ok) good++;
    });
    const res = document.createElement("div");
    res.className = "q-item";
    res.innerHTML = `<b>${good}/${total}</b> ${I18N[lang]?.right || I18N.fr.right} – ${total-good} ${I18N[lang]?.wrong || I18N.fr.wrong}`;
    $qOut.appendChild(res);
  });
}

/* ============ JEU OSSELETS (CANVAS) ============ */

const cvs   = document.getElementById("game");
const ctx   = cvs.getContext("2d");
const $score= document.getElementById("score");
const $goal = document.getElementById("goal");
const $time = document.getElementById("time");

const W = cvs.width, H = cvs.height;
let t0 = performance.now(), running = true;

const keys = {left:false, right:false, jump:false};
document.addEventListener("keydown", (e)=>{
  if (e.code==="ArrowLeft") keys.left=true;
  if (e.code==="ArrowRight") keys.right=true;
  if (e.code==="ArrowUp"||e.code==="Space") keys.jump=true;
});
document.addEventListener("keyup", (e)=>{
  if (e.code==="ArrowLeft") keys.left=false;
  if (e.code==="ArrowRight") keys.right=false;
  if (e.code==="ArrowUp"||e.code==="Space") keys.jump=false;
});
document.querySelector("[data-left]") .addEventListener("touchstart", e=>{e.preventDefault();keys.left=true;});
document.querySelector("[data-left]") .addEventListener("touchend",   ()=>keys.left=false);
document.querySelector("[data-right]").addEventListener("touchstart", e=>{e.preventDefault();keys.right=true;});
document.querySelector("[data-right]").addEventListener("touchend",   ()=>keys.right=false);
document.querySelector("[data-jump]") .addEventListener("touchstart", e=>{e.preventDefault();keys.jump=true;});
document.querySelector("[data-jump]") .addEventListener("touchend",   ()=>keys.jump=false);

const GRAV = 0.6, FRICTION=0.8, SPEED=2.7, JUMP=-10.8;

const player = {x:60,y:H-80,w:26,h:34, vx:0, vy:0, onGround:false};
const plats = [
  {x:0,y:H-20,w:W,h:30},
  {x:120,y:H-110,w:160,h:14},
  {x:340,y:H-180,w:140,h:14},
  {x:560,y:H-140,w:160,h:14},
  {x:260,y:H-260,w:120,h:14},
];

const osselets = [];
const TOTAL = 10;
for (let i=0;i<TOTAL;i++){
  const p = plats[1 + (i% (plats.length-1))];
  osselets.push({
    x: p.x + 20 + (i*37)% (p.w-40),
    y: p.y - 18,
    r: 8,
    a: Math.random()*Math.PI*2,
    col:false
  });
}
$goal.textContent = osselets.length;

function collideRect(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function loop(t){
  if (!running) return;
  const dt = (t - t0)/1000; t0 = t;
  $time.textContent = (Number($time.textContent)+dt).toFixed(1);

  // Physique joueur
  player.vx = (keys.left?-SPEED:0) + (keys.right?SPEED:0);
  player.vy += GRAV;
  player.x += player.vx;
  player.y += player.vy;

  // Collisions plateformes
  player.onGround=false;
  plats.forEach(p=>{
    if (collideRect(player,{x:p.x,y:p.y,w:p.w,h:p.h})){
      // venant du haut
      if (player.vy>0 && player.y+player.h - player.vy <= p.y){
        player.y = p.y - player.h; player.vy=0; player.onGround=true;
      } else if (player.vy<0 && player.y - player.vy >= p.y+p.h){
        player.y = p.y+p.h; player.vy=0;
      } else if (player.vx>0){
        player.x = p.x - player.w;
      } else if (player.vx<0){
        player.x = p.x + p.w;
      }
    }
  });

  // Saut
  if (keys.jump && player.onGround){ player.vy = JUMP; }

  // Limits
  player.x = Math.max(0, Math.min(W-player.w, player.x));
  if (player.y > H) { // tombe -> reset
    player.x=60; player.y=H-80; player.vx=player.vy=0; $time.textContent="0.0";
  }

  // Collecte
  osselets.forEach(o=>{
    o.a += 0.08;
    if (!o.col){
      const dx = (player.x+player.w/2) - o.x, dy=(player.y+player.h/2)-o.y;
      if (dx*dx+dy*dy < (player.w/2+o.r)*(player.w/2+o.r)){
        o.col=true;
        const s = Number($score.textContent||"0")+1;
        $score.textContent = s;
        if (s===osselets.length){
          // GG
          setTimeout(()=>alert("Bravo ! Tous les osselets sont collectés 🦴"), 50);
          running=false;
        }
      }
    }
  });

  // Rendu
  ctx.clearRect(0,0,W,H);
  // fond
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,"#0a1930");g.addColorStop(1,"#06101f");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // plateformes
  plats.forEach(p=>{
    ctx.fillStyle="#17324f"; ctx.fillRect(p.x,p.y,p.w,p.h);
    ctx.strokeStyle="#2a4e79"; ctx.strokeRect(p.x+0.5,p.y+0.5,p.w-1,p.h-1);
  });

  // osselets
  osselets.forEach(o=>{
    if (o.col) return;
    const y = o.y + Math.sin(o.a)*3;
    ctx.save();
    ctx.translate(o.x,y);
    ctx.rotate(Math.sin(o.a)*0.15);
    ctx.fillStyle="#d3e7ff";
    ctx.beginPath(); // petit losange "osselet"
    ctx.moveTo(0,-o.r); ctx.lineTo(o.r,0); ctx.lineTo(0,o.r); ctx.lineTo(-o.r,0); ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // joueur
  ctx.fillStyle="#7dd3fc";
  ctx.fillRect(player.x,player.y,player.w,player.h);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ============ FIN ============ */
