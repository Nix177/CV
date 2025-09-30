/* /osselets-level2.tsx — JEU 2 « Écrire avec les os »
   - Centrage & cadrage robustes (pivot + framing caméra).
   - Panneau de contrôles (flèches) pour tourner/pivoter, déplacer (pan) et zoomer.
   - Lettres projetées + occlusion réelle + fil des clics (mot grec).
   - Aucun <script> ajouté : imports ESM (three + GLTFLoader) en cache global.
*/

;(() => {
  const h = React.createElement;

  /* -------------------- Chemins & constantes -------------------- */
  const BASE      = "/assets/games/osselets/level2/";
  const MODEL     = BASE + "3d/astragalus.glb";
  const WORDS_JS  = BASE + "3d/letters.json"; // optionnel
  const CANVAS_W  = 960, CANVAS_H = 540, DPR_MAX = 2.5;

  const SNAP_PX   = 20;      // rayon de snap écran (sélection trou)
  const ROT_Y_DEG = 12;      // pas rotation Y (yaw)
  const ROT_X_DEG = 8;       // pas rotation X (pitch)
  const PAN_STEP  = 0.08;    // déplacement X/Z
  const ZOOM_STEP = 0.12;    // zoom caméra (vers la cible)
  const IDLE_SPIN = 0.0020;  // rotation lente auto quand inactif

  const HUD_FONT  = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const GREEK     = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

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
  function setCtxFont(ctx, sizePx, weight=400){ ctx.font = `${weight} ${sizePx}px ${HUD_FONT}`; }
  function fmtMs(ms){ const s=Math.floor(ms/1000), m=(s/60)|0; return (m?`${m}m `:"")+`${s%60}s`; }

  /* -------------------- Composant principal -------------------- */
  function AstragalusLevel2(){
    const wrapRef     = React.useRef(null);
    const glRef       = React.useRef(null);
    const hudRef      = React.useRef(null);

    const rendererRef = React.useRef(null);
    const sceneRef    = React.useRef(null);
    const cameraRef   = React.useRef(null);

    const pivotRef    = React.useRef(null);  // pivot (au centre du modèle)
    const modelRef    = React.useRef(null);  // mesh root (enfant du pivot)
    const anchorsRef  = React.useRef([]);    // 24 nodes Hole_*
    const holesRef    = React.useRef([]);    // {x,y,label,index,hidden}

    const ctxRef      = React.useRef(null);
    const THREEref    = React.useRef(null);
    const rayRef      = React.useRef(null);

    const viewRef     = React.useRef({ w:CANVAS_W, h:CANVAS_H, dpr:1 });
    const dragRef     = React.useRef({ down:false, last:0 });
    const lastInteractRef = React.useRef(0);

    // Jeu / progression
    const [ready, setReady]       = React.useState(false);
    const [muted, setMuted]       = React.useState(false);
    const [msg, setMsg]           = React.useState("Relie les trous visibles pour épeler le mot.");
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

        const cam = new THREE.PerspectiveCamera(46, 16/9, 0.05, 100);
        cameraRef.current = cam;

        scene.add(new THREE.AmbientLight(0xffffff, .72));
        const dir = new THREE.DirectionalLight(0xffffff, .95);
        dir.position.set(2.6, 3.2, 2.8);
        dir.castShadow = false;
        scene.add(dir);

        // pivot au centre monde
        const pivot = new THREE.Group();
        pivotRef.current = pivot;
        scene.add(pivot);

        // Words optionnels
        const cfg = await fetchJSON(WORDS_JS);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0, 12);

        // Modèle
        const loader = new GLTFLoader();
        loader.load(MODEL, (gltf)=>{
          if (canceled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ setMsg("Modèle vide."); return; }

          root.traverse(o=>{
            if (o.isMesh){
              if (!o.material || !o.material.isMeshStandardMaterial){
                o.material = new THREE.MeshStandardMaterial({ color:0xf3f6fb, roughness:.6, metalness:.05 });
              }
              o.castShadow = false; o.receiveShadow = false;
            }
          });

          // Normalisation : scale + recentrer -> origine du pivot
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const scale = 1.28 / Math.max(size.x, size.y, size.z);
          root.scale.setScalar(scale);
          box.setFromObject(root);
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center); // l'origine du pivot devient le centre du modèle
          pivot.add(root);

          // Collecter ancres Hole_*
          const anchors = [];
          root.traverse(n=>{ if(/^hole[_\s-]?/i.test(n.name||"")) anchors.push(n); });
          anchorsRef.current = anchors;
          modelRef.current   = root;

          // Cadrer caméra sur l'objet
          frameCameraToObject(cam, root, THREE, 1.22);
          cam.updateProjectionMatrix();

          // Démarrer jeu
          setReady(true);
          seqRef.current = [];
          errCountRef.current = 0;
          startTimeRef.current = performance.now();

          animate();
        }, undefined, (err)=>{ console.error("[L2] GLB load error", err); setMsg("Échec chargement du modèle."); fallbackCircle(); });

      })();

      function animate(){
        if (canceled) return;
        const THREE = THREEref.current, renderer = rendererRef.current, scene = sceneRef.current, cam = cameraRef.current;
        if (!renderer || !scene || !cam || !THREE) return;

        // légère rotation auto si pas d'interaction récente
        if (performance.now() - (lastInteractRef.current||0) > 1200 && modelRef.current){
          pivotRef.current.rotation.y += IDLE_SPIN;
        }

        projectHoles();
        renderer.render(scene, cam);
        drawHUD();

        requestAnimationFrame(animate);
      }

      return ()=>{ canceled = true; };
    },[]);

    /* ---------- Cadrage / centrage caméra ---------- */
    function frameCameraToObject(cam, object3D, THREE, fit=1.2){
      const box   = new THREE.Box3().setFromObject(object3D);
      const size  = box.getSize(new THREE.Vector3());
      const center= box.getCenter(new THREE.Vector3());

      // cam lookAt le centre du pivot (0,0,0) => recentrer pivot en monde
      pivotRef.current.position.set(0,0,0);
      cam.lookAt(0,0,0);

      // distance pour contenir la plus grande dimension dans le FOV vertical
      const maxDim = Math.max(size.y, size.x / cam.aspect, size.z); // sécurité aspect
      const dist   = (maxDim*fit) / (2*Math.tan(cam.fov*Math.PI/360));
      cam.position.set(0, dist*0.72, dist); // légère plongée
      cam.near = Math.max(0.02, dist*0.02);
      cam.far  = dist*6;
      cam.updateProjectionMatrix();
    }

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
          n.getWorldPosition(world);

          // occlusion : un triangle plus proche que l'ancre => hidden
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

          v.copy(world).project(cam);
          const px = (v.x*0.5+0.5) * w, py = (-v.y*0.5+0.5) * h;
          return { x:px*sx, y:py*sy, label:GREEK[i], index:i, hidden };
        });
      } else {
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
          setCtxFont(ctx, 12, 700);
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label, p.x, p.y);
        }
      }

      // Pied de page : mot & hint & score
      const w = WORDS.current[wordIdx] || WORDS.current[0];
      setCtxFont(ctx, 16, 800);
      ctx.fillStyle="#e6f1ff"; ctx.textAlign="start"; ctx.textBaseline="alphabetic";
      ctx.fillText("Mot : " + w.gr + " (" + w.en + ")", 16, CANVAS_H-54);

      setCtxFont(ctx, 12, 500);
      ctx.fillStyle="#9cc0ff";
      ctx.fillText("Indice : " + (w.hint||""), 16, CANVAS_H-34);

      if (scoreStr){
        setCtxFont(ctx, 12, 700);
        ctx.fillStyle="#b0f1a1";
        ctx.fillText(scoreStr, 16, CANVAS_H-14);
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
        dragRef.current.down = true; dragRef.current.last = performance.now();
        trySelectAt(p.x,p.y,true);
      }
      function onMove(e){
        if (!dragRef.current.down) return;
        const p = pick(e); if (!p.ok) return;
        trySelectAt(p.x,p.y,false);
      }
      function onUp(){ dragRef.current.down = false; }

      function trySelectAt(x,y, allowRepeat){
        const idx = nearestHole(x,y); if (idx<0) return;
        const expected = letterIndexExpected();
        if (!allowRepeat && seqRef.current.length && seqRef.current[seqRef.current.length-1]===idx) return;

        if (idx === expected){
          seqRef.current.push(idx);
          lastInteractRef.current = performance.now();
          if (!muted) try{ playClick(1); }catch{}
          checkCompletion();
        } else {
          errCountRef.current++;
          lastInteractRef.current = performance.now();
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
      const pos = seqRef.current.length;
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
      try {
        const key = "osselets-l2-best";
        const prev = JSON.parse(localStorage.getItem(key)||"{}");
        const best = Math.max(prev[w.en]||0, score);
        localStorage.setItem(key, JSON.stringify({...prev, [w.en]:best}));
      } catch {}
    }

    function flashMessage(s, ms=900){
      setMsg(s);
      setTimeout(()=>setMsg("Relie les trous visibles pour épeler le mot."), ms);
    }

    function resetSeq(){
      seqRef.current = [];
      errCountRef.current = 0;
      startTimeRef.current = performance.now();
      setScoreStr("");
    }

    function nextWord(){
      setWordIdx(i => (i+1)%WORDS.current.length);
      setTimeout(resetSeq, 60);
    }

    /* ---------- Contrôles manuels (flèches + clavier) ---------- */
    function bumpInteract(){ lastInteractRef.current = performance.now(); }

    function rotateY(sign){ const p=pivotRef.current; if(!p) return; p.rotation.y += sign * (ROT_Y_DEG*Math.PI/180); bumpInteract(); }
    function rotateX(sign){
      const p=pivotRef.current; if(!p) return;
      p.rotation.x = clamp(p.rotation.x + sign*(ROT_X_DEG*Math.PI/180), -Math.PI/2+0.05, Math.PI/2-0.05);
      bumpInteract();
    }
    function pan(dx, dz){
      const p=pivotRef.current; if(!p) return;
      p.position.x += dx; p.position.z += dz; bumpInteract();
    }
    function zoom(sign){
      const cam=cameraRef.current; if(!cam) return;
      const dir = new (THREEref.current).Vector3(0,0,-1).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(dir, sign*ZOOM_STEP);
      cam.updateProjectionMatrix(); bumpInteract();
    }
    function recenter(){
      const cam=cameraRef.current, root=modelRef.current, THREE=THREEref.current; if(!cam||!root||!THREE) return;
      pivotRef.current.rotation.set(0,0,0);
      pivotRef.current.position.set(0,0,0);
      frameCameraToObject(cam, root, THREE, 1.22);
      bumpInteract();
    }

    React.useEffect(()=>{
      function onKey(e){
        if (e.defaultPrevented) return;
        const k = e.key;
        if (k==="ArrowLeft"){ rotateY(+1); e.preventDefault(); }
        else if (k==="ArrowRight"){ rotateY(-1); e.preventDefault(); }
        else if (k==="ArrowUp"){ if (e.shiftKey) pan(0,-PAN_STEP); else rotateX(+1); e.preventDefault(); }
        else if (k==="ArrowDown"){ if (e.shiftKey) pan(0,+PAN_STEP); else rotateX(-1); e.preventDefault(); }
        else if (k==="a" || k==="A"){ pan(-PAN_STEP,0); }
        else if (k==="d" || k==="D"){ pan(+PAN_STEP,0); }
        else if (k==="w" || k==="W"){ pan(0,-PAN_STEP); }
        else if (k==="s" || k==="S"){ pan(0,+PAN_STEP); }
        else if (k==="+" || k==="="){ zoom(-1); }
        else if (k==="-" || k==="_"){ zoom(+1); }
        else if (k==="r" || k==="R"){ recenter(); }
      }
      window.addEventListener("keydown", onKey);
      return ()=>window.removeEventListener("keydown", onKey);
    },[]);

    /* ---------- Audio (léger bip) ---------- */
    function playClick(ok){
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type="sine"; o.frequency.value = ok ? 660 : 240;
      g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
    }

    /* ---------- UI React (sans JSX) ---------- */
    return h("div", { ref:wrapRef, style:{ position:"relative" } },
      // WebGL + HUD
      h("canvas", { ref:glRef, width:CANVAS_W, height:CANVAS_H, style:{ display:"block", borderRadius:12, background:"transparent" }}),
      h("canvas", { ref:hudRef, width:CANVAS_W, height:CANVAS_H, style:{ position:"absolute", inset:0, pointerEvents:"auto" }}),

      // Toolbar principale
      h("div", { style:{ display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap" } },
        h("button", { className:"btn", onClick:resetSeq }, "Réinitialiser"),
        h("button", { className:"btn", onClick:()=>{ seqRef.current.pop(); setScoreStr(""); } }, "Annuler"),
        h("button", { className:"btn", onClick:nextWord }, "Mot suivant"),
        h("span", { className:"badge", style:{ marginLeft:6, opacity:.85 } }, ready ? "Prêt." : "Chargement…"),
        h("span", { className:"badge", style:{ opacity:.85 } }, msg),
        h("label", { style:{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:10 }},
          h("input", {
            type:"checkbox",
            checked:muted,
            onChange:(e)=>setMuted(!!e.target.checked)
          }),
          "Silence"
        )
      ),

      // Panneau « flèches » : rotation / pan / zoom / centrer
      h("div", {
        style:{
          position:"absolute", right:12, bottom:12, display:"grid",
          gridTemplateColumns:"repeat(3, 36px)", gap:"6px",
          background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:"12px",
          padding:"10px"
        }
      },
        // Ligne 1 (pitch + pan avant)
        h("button", { className:"btn", title:"Tourner (pitch +)", onClick:()=>rotateX(+1) }, "⟰"),
        h("button", { className:"btn", title:"Avancer (pan -Z)", onClick:()=>pan(0,-PAN_STEP) }, "↑"),
        h("button", { className:"btn", title:"Zoom +", onClick:()=>zoom(-1) }, "+"),
        // Ligne 2 (yaw gauche / centrer / yaw droite)
        h("button", { className:"btn", title:"Tourner (yaw gauche)", onClick:()=>rotateY(+1) }, "⟲"),
        h("button", { className:"btn", title:"Centrer", onClick:recenter }, "●"),
        h("button", { className:"btn", title:"Tourner (yaw droite)", onClick:()=>rotateY(-1) }, "⟳"),
        // Ligne 3 (pitch - / pan arrière / zoom -)
        h("button", { className:"btn", title:"Tourner (pitch −)", onClick:()=>rotateX(-1) }, "⟱"),
        h("button", { className:"btn", title:"Reculer (pan +Z)", onClick:()=>pan(0,+PAN_STEP) }, "↓"),
        h("button", { className:"btn", title:"Zoom −", onClick:()=>zoom(+1) }, "−"),
        // Ligne 4 (pan gauche / bascule latérale / pan droite)
        h("button", { className:"btn", title:"Gauche (pan −X)", onClick:()=>pan(-PAN_STEP,0) }, "←"),
        h("span",   { style:{ display:"inline-flex", alignItems:"center", justifyContent:"center", color:"#9bb2d4" } }, "Nav"),
        h("button", { className:"btn", title:"Droite (pan +X)", onClick:()=>pan(+PAN_STEP,0) }, "→")
      ),

      h("div", { style:{ fontSize:12, color:"#9cc0ff", marginTop:8 } },
        h("code", null, "level2/3d/astragalus.glb"),
        " — 24 nœuds ",
        h("code", null, "Hole_…"),
        ". Centrage pivot + cadrage auto. Flèches = rotation/pan/zoom. R = recentrer, ←/→ = yaw, ↑/↓ = pitch, Shift+↑/↓ = pan Z, A/D/W/S = pan."
      )
    );
  }

  // Export global (montage via ton portfolio.html existant)
  // @ts-ignore
  window.AstragalusLevel2 = AstragalusLevel2;
})();
