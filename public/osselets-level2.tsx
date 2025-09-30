/* /osselets-level2.tsx
   JEU 2 — « Écrire avec les os » (24 trous / 4 faces opposées, ancrages Hole_*)
   - Aucune injection <script> supplémentaire : imports ESM dynamiques et mis en cache global.
   - Caméra + HUD 2D : clic/drag pour relier des ancres dans l’ordre des lettres du mot cible.
   - Occlusion réelle : lettres cachées si derrière l’os (raycaster).
   - UI : Réinitialiser, Annuler, Mot suivant, Rotation ↶ ↷, Mute.
   - Score simple (temps + erreurs), localStorage.
*/

;(() => {
  const h = React.createElement;

  /* -------------------- Chemins & constantes -------------------- */
  const BASE      = "/assets/games/osselets/level2/";
  const MODEL     = BASE + "3d/astragalus.glb";      // modèle trous (24 ancres "Hole_…")
  const WORDS_JS  = BASE + "3d/letters.json";        // optionnel { words:[{gr,en,hint}], options? }
  const CANVAS_W  = 960, CANVAS_H = 540, DPR_MAX = 2.5;
  const SNAP_PX   = 20;      // rayon de snap écran (sélection trou)
  const ROT_STEP  = 12;      // rotation par bouton (degrés)
  const IDLE_SPIN = 0.0025;  // rotation lente si inactif
  const HUD_FONT  = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";

  // Alphabet grec (24) dans l'ordre
  const GREEK = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* -------------------- Three ESM (version unique & cache global) -------------------- */
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;

  async function ensureThreeOnce(){
    const w = window;
    if (w.__LxThree) return w.__LxThree; // { THREE, GLTFLoader }
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const out = { THREE, GLTFLoader };
    w.__LxThree = out;
    return out;
  }

  /* -------------------- Utils -------------------- */
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);

  function fmtMs(ms){
    const s = Math.floor(ms/1000), m = Math.floor(s/60), r = s%60;
    return (m? (m+"m ") : "") + r + "s";
  }

  function setCtxFont(ctx, sizePx, weight=400){ ctx.font = `${weight} ${sizePx}px ${HUD_FONT}`; }

  /* -------------------- Composant principal -------------------- */
  function AstragalusLevel2(){
    const wrapRef     = React.useRef(null);
    const glRef       = React.useRef(null);
    const hudRef      = React.useRef(null);
    const rendererRef = React.useRef(null);
    const sceneRef    = React.useRef(null);
    const cameraRef   = React.useRef(null);
    const modelRef    = React.useRef(null);
    const anchorsRef  = React.useRef([]);  // 24 nodes Hole_*
    const holesRef    = React.useRef([]);  // {x,y,label,index,hidden}
    const ctxRef      = React.useRef(null);
    const THREEref    = React.useRef(null);
    const rayRef      = React.useRef(null);

    const viewRef     = React.useRef({ w:CANVAS_W, h:CANVAS_H, dpr:1 });
    const dragRef     = React.useRef({ down:false, last:null });

    // Jeu / progression
    const [ready, setReady]       = React.useState(false);
    const [muted, setMuted]       = React.useState(false);
    const [msg, setMsg]           = React.useState("Relie les trous (ancres visibles) pour épeler le mot.");
    const [wordIdx, setWordIdx]   = React.useState(0);
    const seqRef                  = React.useRef([]);     // indices choisis
    const startTimeRef            = React.useRef(0);
    const errCountRef             = React.useRef(0);
    const [scoreStr, setScoreStr] = React.useState("");

    const WORDS = React.useRef([
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ]);

    /* ---------- Resize ---------- */
    React.useEffect(()=>{
      function onResize(){
        const wrap = wrapRef.current, cv = glRef.current, hud = hudRef.current;
        const renderer = rendererRef.current, cam = cameraRef.current;
        if (!wrap || !cv || !hud || !renderer || !cam) return;

        const w = Math.max(320, wrap.clientWidth|0);
        const h = Math.round(w*(CANVAS_H/CANVAS_W));
        const dpr = clamp(window.devicePixelRatio||1, 1, DPR_MAX);
        viewRef.current = { w, h, dpr };

        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        cv.style.width = w+"px"; cv.style.height = h+"px";

        cam.aspect = w/h; cam.updateProjectionMatrix();

        hud.width  = Math.floor(w*dpr);
        hud.height = Math.floor(h*dpr);
        hud.style.width  = w+"px";
        hud.style.height = h+"px";
        const ctx = hud.getContext("2d");
        // Transform pour dessiner "en coordonnées 960x540" indépendamment du true-size
        ctx.setTransform((w*dpr)/CANVAS_W,0,0,(h*dpr)/CANVAS_H,0,0);
        ctxRef.current = ctx;
      }
      onResize();
      const ro = (typeof ResizeObserver!=="undefined") ? new ResizeObserver(onResize) : null;
      if (ro && wrapRef.current) ro.observe(wrapRef.current);
      window.addEventListener("resize", onResize);
      return ()=>{ if (ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
    },[]);

    /* ---------- Init Three + modèle ---------- */
    React.useEffect(()=>{
      let canceled=false;
      (async ()=>{
        const { THREE, GLTFLoader } = await ensureThreeOnce();
        THREEref.current = THREE;
        rayRef.current   = new THREE.Raycaster(undefined, undefined, 0.01, 100);

        // Renderer
        const gl = glRef.current;
        const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias:true, alpha:true });
        renderer.setPixelRatio(viewRef.current.dpr);
        renderer.setSize(viewRef.current.w, viewRef.current.h, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        rendererRef.current = renderer;

        // Scene + caméra
        const scene = new THREE.Scene();
        scene.background = null;
        sceneRef.current = scene;

        const cam = new THREE.PerspectiveCamera(45, 16/9, 0.1, 50);
        cam.position.set(2.2, 1.45, 2.5);
        cam.lookAt(0, 0.25, 0);
        cameraRef.current = cam;

        scene.add(new THREE.AmbientLight(0xffffff, .72));
        const dir = new THREE.DirectionalLight(0xffffff, .95);
        dir.position.set(2.6, 3.2, 2.8);
        scene.add(dir);

        // Words optionnels
        const cfg = await fetchJSON(WORDS_JS);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0, 12);

        // Modèle
        const loader = new GLTFLoader();
        loader.load(MODEL, (gltf)=>{
          if (canceled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ setMsg("Modèle vide."); return; }

          // standard materials
          root.traverse(o=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial){
                o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:.6, metalness:.05 });
              }
            }
          });

          // Normalisation (échelle/centrage)
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const s = 1.25 / Math.max(size.x, size.y, size.z);
          root.scale.setScalar(s);
          box.setFromObject(root);
          const c = box.getCenter(new THREE.Vector3());
          root.position.sub(c);

          scene.add(root);
          modelRef.current = root;

          // Collecter ancres Hole_*
          const anchors = [];
          root.traverse(n=>{ if(/^hole[_\s-]?/i.test(n.name||"")) anchors.push(n); });
          anchorsRef.current = anchors;

          // Démarrage jeu
          setReady(true);
          seqRef.current = [];
          startTimeRef.current = performance.now();
          errCountRef.current = 0;

          animate();
        }, undefined, (err)=>{ console.error("[L2] GLB load error", err); setMsg("Échec chargement du modèle."); fallbackCircle(); });
      })();

      function animate(){
        if (canceled) return;
        const THREE = THREEref.current, renderer = rendererRef.current, scene = sceneRef.current, cam = cameraRef.current;
        if (!renderer || !scene || !cam || !THREE) return;

        // Idle spin si aucune interaction récente (légère)
        if (!dragRef.current.down && modelRef.current) {
          modelRef.current.rotation.y += IDLE_SPIN;
        }

        projectHoles();
        renderer.render(scene, cam);
        drawHUD();

        requestAnimationFrame(animate);
      }

      return ()=>{ canceled = true; };
    },[]);

    /* ---------- Projection + occlusion ---------- */
    function projectHoles(){
      const THREE = THREEref.current, cam = cameraRef.current;
      if (!THREE || !cam) return;
      const anchors = anchorsRef.current||[];
      const v = new THREE.Vector3();

      if (anchors.length === 24){
        const { w, h } = viewRef.current, sx = CANVAS_W / w, sy = CANVAS_H / h;
        const camPos = new THREE.Vector3(); cam.getWorldPosition(camPos);
        const dir    = new THREE.Vector3();
        const world  = new THREE.Vector3();
        const rc     = rayRef.current;
        const model  = modelRef.current;

        holesRef.current = anchors.map((n,i)=>{
          // position monde
          n.getWorldPosition(world);

          // test occlusion avec raycaster : si un triangle est AVANT le point, la lettre est cachée
          let hidden = false;
          if (rc && model){
            dir.copy(world).sub(camPos).normalize();
            rc.set(camPos, dir);
            const hits = rc.intersectObject(model, true);
            if (hits && hits.length){
              const dHole = camPos.distanceTo(world);
              if (hits[0].distance < dHole - 1e-3) hidden = true;
            }
          }

          // projection en NDC → pixels (w,h) → coordonnées HUD (CANVAS_W,CANVAS_H)
          v.copy(world).project(cam);
          const px = (v.x*0.5+0.5) * w, py = (-v.y*0.5+0.5) * h;
          return { x:px*sx, y:py*sy, label:GREEK[i], index:i, hidden };
        });
      } else {
        // fallback : cercle régulier
        fallbackCircle();
      }
    }

    function fallbackCircle(){
      holesRef.current = new Array(24).fill(0).map((_,i)=>{
        const t = (i/24)*Math.PI*2, R = 220;
        return { x:CANVAS_W/2 + Math.cos(t)*R, y:CANVAS_H/2 + Math.sin(t)*R, label:GREEK[i], index:i, hidden:false };
      });
    }

    /* ---------- HUD dessin ---------- */
    function drawHUD(){
      const ctx = ctxRef.current; if (!ctx) return;
      ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

      // fil (séquence en cours)
      ctx.strokeStyle="#60a5fa"; ctx.lineWidth=2;
      if (seqRef.current.length>1){
        ctx.beginPath();
        const s = seqRef.current[0], p0 = holesRef.current[s];
        if (p0) ctx.moveTo(p0.x, p0.y);
        for (let i=1;i<seqRef.current.length;i++){
          const p = holesRef.current[seqRef.current[i]];
          if (p) ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // points + lettres visibles
      for (const p of holesRef.current){
        ctx.beginPath();
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.32)" : "#0ea5e9";
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
        if (!p.hidden){
          ctx.fillStyle = "#e6f1ff";
          setCtxFont(ctx, 12, 600);
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label, p.x, p.y);
        }
      }

      // Pied de page : mot & hint & score
      const w = WORDS.current[wordIdx] || WORDS.current[0];
      setCtxFont(ctx, 16, 700);
      ctx.fillStyle="#e6f1ff"; ctx.textAlign="start"; ctx.textBaseline="alphabetic";
      ctx.fillText("Mot : " + w.gr + " (" + w.en + ")", 16, CANVAS_H-44);

      setCtxFont(ctx, 12, 500);
      ctx.fillStyle="#9cc0ff";
      ctx.fillText("Indice : " + (w.hint||""), 16, CANVAS_H-24);

      if (scoreStr){
        setCtxFont(ctx, 12, 600);
        ctx.fillStyle="#b0f1a1";
        ctx.fillText(scoreStr, 16, CANVAS_H-8);
      }
    }

    /* ---------- Sélection clic/drag ---------- */
    React.useEffect(()=>{
      function pick(event){
        const hud = hudRef.current; if (!hud) return { x:0, y:0, ok:false };
        const r = hud.getBoundingClientRect();
        const { w, h } = viewRef.current;
        const px = (event.clientX - r.left) * (w / r.width);
        const py = (event.clientY - r.top)  * (h / r.height);
        const x  = px * (CANVAS_W / w);
        const y  = py * (CANVAS_H / h);
        return { x, y, ok:true };
      }

      function nearestHole(x,y){
        let best=-1, bd=9999;
        for (let i=0;i<holesRef.current.length;i++){
          const p = holesRef.current[i]; if (!p || p.hidden) continue;
          const d = Math.hypot(p.x-x, p.y-y);
          if (d<bd){ bd=d; best=i; }
        }
        return (bd <= SNAP_PX) ? best : -1;
      }

      function onDown(e){
        const p = pick(e); if (!p.ok) return;
        dragRef.current.down = true; dragRef.current.last = {x:p.x, y:p.y};
        trySelectAt(p.x,p.y,true);
      }
      function onMove(e){
        if (!dragRef.current.down) return;
        const p = pick(e); if (!p.ok) return;
        dragRef.current.last = {x:p.x, y:p.y};
        trySelectAt(p.x,p.y,false);
      }
      function onUp(){ dragRef.current.down = false; }

      function trySelectAt(x,y, allowRepeat){
        const idx = nearestHole(x,y);
        if (idx<0) return;
        // éviter doublons consécutifs
        if (!allowRepeat && seqRef.current.length && seqRef.current[seqRef.current.length-1]===idx) return;

        const expected = letterIndexExpected();
        if (idx === expected){
          seqRef.current.push(idx);
          if (!muted) try{ playClick(1); }catch{}
          checkCompletion();
        } else {
          // erreur (ignorer le clic si trou non attendu)
          errCountRef.current++;
          if (!muted) try{ playClick(0); }catch{}
          flashMessage("Mauvais trou : essaie encore.", 800);
        }
      }

      const hud = hudRef.current;
      if (hud){
        hud.addEventListener("pointerdown", onDown);
        hud.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }
      return ()=>{
        if (hud){
          hud.removeEventListener("pointerdown", onDown);
          hud.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        }
      };
    },[muted, wordIdx]);

    /* ---------- Logique de mot & score ---------- */
    function letterIndexExpected(){
      const w = WORDS.current[wordIdx] || WORDS.current[0];
      // Mapping simple : index 0..23 → Α..Ω.
      // On convertit la lettre-cible grecque → index grec (position dans GREEK)
      const pos = seqRef.current.length; // prochaine lettre à placer
      const ch  = (w.gr || "").normalize("NFC").charAt(pos);
      const idx = GREEK.indexOf(ch);
      return idx >= 0 ? idx : -1;
    }

    function checkCompletion(){
      const w = WORDS.current[wordIdx] || WORDS.current[0];
      const done = seqRef.current.length >= (w.gr || "").length;
      if (!done) return;

      const dt = Math.max(0, performance.now() - (startTimeRef.current||performance.now()));
      const base = 10 + 2*(w.gr.length);
      const penalty = errCountRef.current;
      const timeBonus = dt<25000 ? 5 : (dt<40000 ? 2 : 0);
      const score = Math.max(0, base + timeBonus - penalty);

      setScoreStr(`Terminé en ${fmtMs(dt)} — erreurs:${penalty} — score:+${score}`);
      flashMessage("Bravo ! Mot complété.", 1200);
      // Persist (localStorage simple)
      try {
        const key = "osselets-l2-best";
        const prev = JSON.parse(localStorage.getItem(key)||"{}");
        const best = Math.max(prev[w.en]||0, score);
        localStorage.setItem(key, JSON.stringify({...prev, [w.en]:best}));
      } catch {}
    }

    function flashMessage(s, ms=900){
      setMsg(s);
      setTimeout(()=>setMsg("Relie les trous (ancres visibles) pour épeler le mot."), ms);
    }

    function resetSeq(){
      seqRef.current = [];
      errCountRef.current = 0;
      startTimeRef.current = performance.now();
      setScoreStr("");
    }

    function nextWord(){
      setWordIdx(i => (i+1)%WORDS.current.length);
      // petite latence visuelle, puis reset
      setTimeout(resetSeq, 60);
    }

    /* ---------- Rotation & Mute ---------- */
    function rotate(deltaDeg){
      const root = modelRef.current; if (!root) return;
      const THREE = THREEref.current;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), (deltaDeg*Math.PI/180));
      root.quaternion.premultiply(q);  // rotation autour de Y monde
    }

    /* ---------- Audio (facultatif, discret) ---------- */
    function playClick(ok){
      // petit bip en web audio (aucun asset)
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type="sine";
      o.frequency.value = ok ? 660 : 240;
      g.gain.value = 0.06;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
    }

    /* ---------- UI React (sans JSX) ---------- */
    return h("div", { ref:wrapRef, style:{ position:"relative" } },
      // WebGL + HUD 2D
      h("canvas", { ref:glRef, width:CANVAS_W, height:CANVAS_H, style:{ display:"block", borderRadius:12, background:"transparent" }}),
      h("canvas", { ref:hudRef, width:CANVAS_W, height:CANVAS_H, style:{ position:"absolute", inset:0, pointerEvents:"auto" }}),

      // Toolbar
      h("div", { style:{ display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap" } },
        h("button", { className:"btn", onClick:resetSeq }, "Réinitialiser"),
        h("button", { className:"btn", onClick:()=>{ seqRef.current.pop(); setScoreStr(""); } }, "Annuler"),
        h("button", { className:"btn", onClick:nextWord }, "Mot suivant"),
        h("span", { className:"badge", style:{ marginLeft:6, opacity:.85 } }, msg),
        h("span", null, "—"),
        h("button", { className:"btn", onClick:()=>rotate(-ROT_STEP), title:"Tourner gauche" }, "↶"),
        h("button", { className:"btn", onClick:()=>rotate(+ROT_STEP), title:"Tourner droite" }, "↷"),
        h("label", { style:{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:10 }},
          h("input", {
            type:"checkbox",
            checked:muted,
            onChange:(e)=>setMuted(!!e.target.checked)
          }),
          "Silence"
        )
      ),

      h("div", { style:{ fontSize:12, color:"#9cc0ff", marginTop:8 } },
        h("code", null, "level2/3d/astragalus.glb"),
        " — 24 nœuds ",
        h("code", null, "Hole_…"),
        ". Lettres cachées si l’ancre est occluse par le modèle."
      ),

      !ready && h("div", { style:{ marginTop:8, color:"#9aa6bd" } }, "Chargement du modèle 3D…")
    );
  }

  // Export global (montage via ton portfolio.html existant)
  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
