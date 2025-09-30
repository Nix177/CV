/* /osselets-level2.tsx — JEU 2 « Écrire avec les os » (version complète)
   - Centrage solide (pivot au centre du mesh) + cadrage caméra auto.
   - Occlusion réelle (raycaster) : les lettres masquées ne s’affichent pas ni ne sont cliquables.
   - Tracé du “fil” en cliquant des trous (mode LIBRE) ou selon un MOT (mode MOT).
   - Panneau latéral EDITABLE : 24 lettres associées aux 24 trous (persistées en localStorage).
   - Pavé de navigation (flèches) + raccourcis: ←→ (yaw), ↑↓ (pitch), Shift+↑/↓ (pan Z), A/D/W/S (pan), +/− (zoom), R (recentrer).
   - AUCUN <script> ajouté : import() ESM (three + GLTFLoader) avec cache global pour éviter les doubles imports.
*/

;(() => {
  const h = React.createElement;

  /* -------------------- Chemins & constantes -------------------- */
  const BASE      = "/assets/games/osselets/level2/";
  const MODEL     = BASE + "3d/astragalus.glb";
  const WORDS_JS  = BASE + "3d/letters.json";        // optionnel (mots)
  const MAP_KEY   = "osselets-l2-map-v1";            // mapping lettres ↔ trous (24)
  const CANVAS_W  = 960, CANVAS_H = 540, DPR_MAX = 2.5;

  const SNAP_PX   = 20;      // rayon de snap écran (sélection trou)
  const ROT_Y_DEG = 12;      // pas rotation Y (yaw)
  const ROT_X_DEG = 8;       // pas rotation X (pitch)
  const PAN_STEP  = 0.08;    // déplacement X/Z
  const ZOOM_STEP = 0.12;    // zoom caméra (vers la cible)
  const IDLE_SPIN = 0.0020;  // rotation lente auto quand inactif

  const HUD_FONT  = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  const GREEK_DEF = ["Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"];

  /* -------------------- Three ESM (version unique & cache global) -------------------- */
  const THREE_VER = "0.158.0";
  const THREE_URL = `https://esm.sh/three@${THREE_VER}`;
  const GLTF_URL  = `https://esm.sh/three@${THREE_VER}/examples/jsm/loaders/GLTFLoader.js`;
  async function ensureThreeOnce(){
    const w = window as any;
    if (w.__LxThree) return w.__LxThree; // { THREE, GLTFLoader }
    const THREE = await import(THREE_URL);
    const { GLTFLoader } = await import(GLTF_URL);
    const out = { THREE, GLTFLoader };
    w.__LxThree = out;
    return out;
  }

  /* -------------------- Utils -------------------- */
  const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
  const fetchJSON = (u:string)=>fetch(u,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null);
  function setCtxFont(ctx:CanvasRenderingContext2D, sizePx:number, weight=400){ ctx.font = `${weight} ${sizePx}px ${HUD_FONT}`; }
  function fmtMs(ms:number){ const s=Math.floor(ms/1000), m=(s/60)|0; return (m?`${m}m `:"")+`${s%60}s`; }

  /* -------------------- Composant principal -------------------- */
  function AstragalusLevel2(){
    const wrapRef     = React.useRef<HTMLDivElement|null>(null);
    const glRef       = React.useRef<HTMLCanvasElement|null>(null);
    const hudRef      = React.useRef<HTMLCanvasElement|null>(null);

    const rendererRef = React.useRef<any>(null);
    const sceneRef    = React.useRef<any>(null);
    const cameraRef   = React.useRef<any>(null);

    const pivotRef    = React.useRef<any>(null);  // pivot (au centre du modèle)
    const modelRef    = React.useRef<any>(null);  // mesh root (enfant du pivot)
    const anchorsRef  = React.useRef<any[]>([]);  // 24 nodes Hole_*
    const holesRef    = React.useRef<any[]>([]);  // {x,y,label,index,hidden}

    const ctxRef      = React.useRef<CanvasRenderingContext2D|null>(null);
    const THREEref    = React.useRef<any>(null);
    const rayRef      = React.useRef<any>(null);

    const viewRef     = React.useRef({ w:CANVAS_W, h:CANVAS_H, dpr:1 });
    const dragRef     = React.useRef({ down:false, last:0 });
    const lastInteractRef = React.useRef(0);

    // Jeu / progression
    const [ready, setReady]       = React.useState(false);
    const [muted, setMuted]       = React.useState(false);
    const [msg, setMsg]           = React.useState("Relie les trous visibles pour tracer le fil.");
    const [wordIdx, setWordIdx]   = React.useState(0);
    const [mode, setMode]         = React.useState<"mot"|"libre">("mot");
    const seqRef                  = React.useRef<number[]>([]);  // indices cliqués
    const startTimeRef            = React.useRef(0);
    const errCountRef             = React.useRef(0);
    const [scoreStr, setScoreStr] = React.useState("");
    const [openMap, setOpenMap]   = React.useState(false);
    const [spellStr, setSpellStr] = React.useState("");          // mot en cours (mode LIBRE)

    // Mots (optionnel)
    const WORDS = React.useRef<{gr:string,en:string,hint?:string}[]>([
      { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
      { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
      { gr:"ΜΑΤΙ",  en:"MATI",  hint:"« Mauvais œil » — apotropaïon." }
    ]);

    // Mapping lettres ↔ trous (24) — éditable & persistant
    const [mapArr, setMapArr] = React.useState<string[]>(
      (()=>{ try{ const m=JSON.parse(localStorage.getItem(MAP_KEY)||"[]"); if(Array.isArray(m)&&m.length===24) return m; }catch{} return [...GREEK_DEF]; })()
    );
    const mapRef = React.useRef<string[]>(mapArr);
    React.useEffect(()=>{ mapRef.current = mapArr; try{ localStorage.setItem(MAP_KEY, JSON.stringify(mapArr)); }catch{} drawHUD(); }, [mapArr]);

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
        const gl = glRef.current!;
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

        // Mots optionnels
        const cfg = await fetchJSON(WORDS_JS);
        if (cfg?.words?.length) WORDS.current = cfg.words.slice(0, 24);

        // Modèle
        const loader = new GLTFLoader();
        loader.load(MODEL, (gltf:any)=>{
          if (canceled) return;
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (!root){ setMsg("Modèle vide."); return; }

          root.traverse((o:any)=>{
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
          const scale = 1.35 / Math.max(size.x, size.y, size.z);
          root.scale.setScalar(scale);
          box.setFromObject(root);
          const center = box.getCenter(new THREE.Vector3());
          root.position.sub(center); // l'origine du pivot devient le centre du modèle
          pivot.add(root);

          // Collecter ancres Hole_*
          const anchors:any[] = [];
          root.traverse((n:any)=>{ if(/^hole[_\s-]?/i.test(n.name||"")) anchors.push(n); });
          // tri par nom pour ordre déterministe
          anchors.sort((a:any,b:any)=> (a.name||"").localeCompare(b.name||""));
          anchorsRef.current = anchors;
          modelRef.current   = root;

          // Cadrer caméra sur l'objet
          frameCameraToObject(cam, root, THREE, 1.22);
          cam.updateProjectionMatrix();

          // Démarrer jeu
          setReady(true);
          resetSeq();
          animate();
        }, undefined, (err:any)=>{ console.error("[L2] GLB load error", err); setMsg("Échec chargement du modèle."); fallbackCircle(); });

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
    function frameCameraToObject(cam:any, object3D:any, THREE:any, fit=1.2){
      const box   = new THREE.Box3().setFromObject(object3D);
      const size  = box.getSize(new THREE.Vector3());
      const center= box.getCenter(new THREE.Vector3());

      pivotRef.current.position.set(0,0,0);
      cam.lookAt(0,0,0);

      // distance pour contenir la plus grande dimension dans le FOV vertical
      const maxDim = Math.max(size.y, size.x / cam.aspect, size.z);
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

        holesRef.current = anchors.map((n:any,i:number)=>{
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
          const label = mapRef.current[i] || "";
          return { x:px*sx, y:py*sy, label, index:i, hidden };
        });
      } else {
        fallbackCircle();
      }
    }

    function fallbackCircle(){
      holesRef.current = new Array(24).fill(0).map((_,i)=>{
        const t = (i/24)*Math.PI*2, R = 220;
        return { x:CANVAS_W/2 + Math.cos(t)*R, y:CANVAS_H/2 + Math.sin(t)*R, label:(mapRef.current[i]||""), index:i, hidden:false };
      });
    }

    /* ---------- HUD dessin ---------- */
    function drawHUD(){
      const ctx = ctxRef.current!; if (!ctx) return;
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
        ctx.fillStyle = p.hidden ? "rgba(14,165,233,.28)" : "#0ea5e9";
        ctx.arc(p.x,p.y,10,0,Math.PI*2); ctx.fill();
        if (!p.hidden){
          ctx.fillStyle = "#e6f1ff";
          setCtxFont(ctx, 12, 700);
          ctx.textAlign="center"; ctx.textBaseline="middle";
          ctx.fillText(p.label || "", p.x, p.y);
        }
      }

      // Pied : mot & hint & score / épellation (mode LIBRE)
      if (mode==="mot"){
        const w = WORDS.current[wordIdx] || WORDS.current[0];
        setCtxFont(ctx, 16, 800);
        ctx.fillStyle="#e6f1ff"; ctx.textAlign="start"; ctx.textBaseline="alphabetic";
        ctx.fillText("Mot : " + w.gr + " (" + w.en + ")", 16, CANVAS_H-56);

        setCtxFont(ctx, 12, 500);
        ctx.fillStyle="#9cc0ff";
        ctx.fillText("Indice : " + (w.hint||""), 16, CANVAS_H-36);

        if (scoreStr){
          setCtxFont(ctx, 12, 700);
          ctx.fillStyle="#b0f1a1";
          ctx.fillText(scoreStr, 16, CANVAS_H-16);
        }
      } else {
        setCtxFont(ctx, 14, 700);
        ctx.fillStyle="#e6f1ff"; ctx.textAlign="start"; ctx.textBaseline="alphabetic";
        ctx.fillText("Épellation : " + (spellStr||"—"), 16, CANVAS_H-24);
      }
    }

    /* ---------- Sélection clic/drag ---------- */
    React.useEffect(()=>{
      function pick(event:PointerEvent){
        const hud = hudRef.current!; if (!hud) return { x:0, y:0, ok:false };
        const r = hud.getBoundingClientRect();
        const { w, h } = viewRef.current;
        const px = (event.clientX - r.left) * (w / r.width);
        const py = (event.clientY - r.top)  * (h / r.height);
        const x  = px * (CANVAS_W / w);
        const y  = py * (CANVAS_H / h);
        return { x, y, ok:true };
      }
      function nearestHole(x:number,y:number){
        let best=-1, bd=9999;
        for (let i=0;i<holesRef.current.length;i++){
          const p = holesRef.current[i]; if (!p || p.hidden) continue;
          const d = Math.hypot(p.x-x, p.y-y);
          if (d<bd){ bd=d; best=i; }
        }
        return (bd <= SNAP_PX) ? best : -1;
      }

      function onDown(e:PointerEvent){
        const p = pick(e); if (!p.ok) return;
        dragRef.current.down = true; dragRef.current.last = performance.now();
        trySelectAt(p.x,p.y,true);
      }
      function onMove(e:PointerEvent){
        if (!dragRef.current.down) return;
        const p = pick(e); if (!p.ok) return;
        trySelectAt(p.x,p.y,false);
      }
      function onUp(){ dragRef.current.down = false; }

      function trySelectAt(x:number,y:number, allowRepeat:boolean){
        const idx = nearestHole(x,y); if (idx<0) return;
        if (!allowRepeat && seqRef.current.length && seqRef.current[seqRef.current.length-1]===idx) return;

        lastInteractRef.current = performance.now();

        if (mode==="libre"){
          seqRef.current.push(idx);
          const label = (mapRef.current[idx]||"");
          setSpellStr(s => s + (label||""));
          if (!muted) try{ playClick(1); }catch{}
          return;
        }

        // mode "mot" → guidage
        const expected = letterIndexExpected();
        if (idx === expected){
          seqRef.current.push(idx);
          if (!muted) try{ playClick(1); }catch{}
          checkCompletion();
        } else {
          errCountRef.current++;
          if (!muted) try{ playClick(0); }catch{}
          flashMessage("Mauvais trou : essaie encore.", 800);
        }
      }

      const hud = hudRef.current!;
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
    },[muted, wordIdx, mode]);

    /* ---------- Logique de mot & score ---------- */
    function letterIndexExpected(){
      const w = WORDS.current[wordIdx] || WORDS.current[0];
      const pos = seqRef.current.length;
      const ch  = (w.gr || "").normalize("NFC").charAt(pos);
      // on cherche la lettre dans le mapping courant (première occurrence)
      const idx = mapRef.current.findIndex(L => (L||"") === ch);
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

    function flashMessage(s:string, ms=900){
      setMsg(s);
      setTimeout(()=>setMsg("Relie les trous visibles pour tracer le fil."), ms);
    }

    function resetSeq(){
      seqRef.current = [];
      errCountRef.current = 0;
      startTimeRef.current = performance.now();
      setScoreStr("");
      setSpellStr("");
    }

    function nextWord(){
      setWordIdx(i => (i+1)%WORDS.current.length);
      setTimeout(resetSeq, 60);
    }

    /* ---------- Contrôles manuels (flèches + clavier) ---------- */
    function bumpInteract(){ lastInteractRef.current = performance.now(); }

    function rotateY(sign:number){ const p=pivotRef.current; if(!p) return; p.rotation.y += sign * (ROT_Y_DEG*Math.PI/180); bumpInteract(); }
    function rotateX(sign:number){
      const p=pivotRef.current; if(!p) return;
      p.rotation.x = clamp(p.rotation.x + sign*(ROT_X_DEG*Math.PI/180), -Math.PI/2+0.05, Math.PI/2-0.05);
      bumpInteract();
    }
    function pan(dx:number, dz:number){
      const p=pivotRef.current; if(!p) return;
      p.position.x += dx; p.position.z += dz; bumpInteract();
    }
    function zoom(sign:number){
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
      function onKey(e:KeyboardEvent){
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
    function playClick(ok:number){
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type="sine"; o.frequency.value = ok ? 660 : 240;
      g.gain.value = 0.06; o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
    }

    /* ---------- Panneau mapping éditable ---------- */
    function MappingPanel(){
      const [local, setLocal] = React.useState<string[]>(mapArr);

      function apply(){
        const clean = local.map(s => (s||"").trim().slice(0,2).toUpperCase());
        setMapArr(clean);
      }
      function resetDefault(){
        setLocal([...GREEK_DEF]); setMapArr([...GREEK_DEF]);
      }
      React.useEffect(()=>setLocal(mapArr), [openMap]);

      return h("div", {
        style:{
          position:"absolute", right:12, top:12, width: openMap ? 260 : 46,
          background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:"12px",
          padding: openMap ? "10px" : "6px", transition:"width .18s ease"
        }
      },
        openMap
          ? h(React.Fragment, null,
              h("div", { style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8} },
                h("strong", null, "Lettres (24)"),
                h("button", { className:"btn", onClick:()=>setOpenMap(false) }, "Fermer")
              ),
              h("div", { style:{maxHeight: "56vh", overflow:"auto", borderTop:"1px solid #ffffff22", paddingTop:8} },
                local.map((val, i)=> h("div", { key:i, style:{display:"grid",gridTemplateColumns:"36px 1fr",gap:8,alignItems:"center",marginBottom:6} },
                  h("span", { className:"badge", style:{textAlign:"center"} }, (i+1).toString().padStart(2,"0")),
                  h("input", {
                    value:val||"",
                    onChange:(e:any)=>{ const v=[...local]; v[i]=(e.target.value||"").toUpperCase().slice(0,2); setLocal(v); },
                    placeholder:GREEK_DEF[i],
                    style:{ width:"100%", padding:"6px 8px", borderRadius:8, border:"1px solid #2d3b52", background:"#0b1f33", color:"#e6f1ff" }
                  })
                ))
              ),
              h("div", { style:{display:"flex", gap:8, marginTop:8} },
                h("button", { className:"btn", onClick:apply }, "Appliquer"),
                h("button", { className:"btn", onClick:resetDefault }, "Réinit.")
              ),
              h("div", { style:{fontSize:12, color:"#9bb2d4", marginTop:6} },
                "Associe une lettre à chaque trou (persisté localement)."
              )
            )
          : h("button", { className:"btn", onClick:()=>setOpenMap(true), title:"Éditer les lettres" }, "📝")
      );
    }

    /* ---------- UI React (sans JSX) ---------- */
    return h("div", { ref:wrapRef, style:{ position:"relative" } },
      // WebGL + HUD
      h("canvas", { ref:glRef, width:CANVAS_W, height:CANVAS_H, style:{ display:"block", borderRadius:12, background:"transparent" }}),
      h("canvas", { ref:hudRef, width:CANVAS_W, height:CANVAS_H, style:{ position:"absolute", inset:0, pointerEvents:"auto" }}),

      // Barre haute (mode, actions)
      h("div", { style:{ display:"flex", gap:8, marginTop:10, alignItems:"center", flexWrap:"wrap" } },
        h("button", { className:"btn", onClick:resetSeq }, "Réinitialiser"),
        h("button", { className:"btn", onClick:()=>{ seqRef.current.pop(); if(mode==="libre") setSpellStr(s=>s.slice(0,-1)); setScoreStr(""); } }, "Annuler"),
        h("button", { className:"btn", onClick:nextWord, disabled: mode!=="mot" }, "Mot suivant"),
        h("label", { className:"badge", style:{ marginLeft:6, opacity:.85 } }, ready ? "Prêt." : "Chargement…"),
        h("span", { className:"badge", style:{ opacity:.85 } }, msg),
        h("label", { style:{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:10 }},
          h("input", { type:"checkbox", checked:muted, onChange:(e:any)=>setMuted(!!e.target.checked) }), "Silence"
        ),
        h("div", { style:{marginLeft:"auto", display:"inline-flex", alignItems:"center", gap:8} },
          h("label", { className:"badge" }, "Mode"),
          h("button", {
            className:"btn",
            onClick:()=>{ setMode("mot"); resetSeq(); },
            style:{ background: mode==="mot" ? "#198754" : "#0b1f33", borderColor:"#2d3b52" }
          }, "Mot"),
          h("button", {
            className:"btn",
            onClick:()=>{ setMode("libre"); resetSeq(); },
            style:{ background: mode==="libre" ? "#198754" : "#0b1f33", borderColor:"#2d3b52" }
          }, "Libre")
        )
      ),

      // Panneau mapping éditable (dépliable)
      h(MappingPanel, null),

      // Pavé « flèches » : rotation / pan / zoom / centrer
      h("div", {
        style:{
          position:"absolute", right: openMap ? 280 : 12, bottom:12, display:"grid",
          gridTemplateColumns:"repeat(3, 36px)", gap:"6px",
          background:"#0b2237cc", border:"1px solid #ffffff22", borderRadius:"12px",
          padding:"10px", transition:"right .18s ease"
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
        // Ligne 4 (pan gauche / note / pan droite)
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
