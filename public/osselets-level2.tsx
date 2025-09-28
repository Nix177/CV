// public/osselets-level2.tsx
// LEVEL 2 — “Écrire avec les os” (24 trous / 4 faces opposées)
// - Charge le modèle 3D troué: /assets/games/osselets/level2/3d/astragalus.glb
// - Projette les nœuds Hole_* en 2D (960×540 logiques) et affiche 24 points lettrés
// - Règle : entrer par Hole_<face>_<n> et ressortir par le même <n> de la face opposée
// - Fallback si modèle/ancres absents : cercle 2D de 24 points (toujours jouable)
// - Zéro import ESM : utilise window.THREE + window.GLTFLoader déjà injectés par portfolio.html

const { useEffect, useRef, useState } = React;

/* -------------------- Constantes & chemins -------------------- */
const L2_BASE = "/assets/games/osselets/level2/";
const MODEL_URL = L2_BASE + "3d/astragalus.glb";
const LETTERS_URL = L2_BASE + "3d/letters.json"; // optionnel

const L2_W = 960;
const L2_H = 540;
const DPR_MAX = 2.5;

const GREEK = [
  "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ",
  "Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω"
]; // 24

/* -------------------- Helpers -------------------- */
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function fetchJSON(url){
  return fetch(url, { cache:"no-store" }).then(r => r.ok ? r.json() : null).catch(()=>null);
}

/* -------------------- Composant -------------------- */
function AstragalusLevel2(){
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);     // HUD 2D
  const ctxRef    = useRef(null);

  const glCanvasRef = useRef(null);   // arrière-plan 3D
  const rendererRef = useRef(null);
  const sceneRef    = useRef(null);
  const cameraRef   = useRef(null);
  const modelRef    = useRef(null);
  const anchorsRef  = useRef([]);     // Object3D[] Hole_*

  const sizeRef   = useRef({ w:L2_W, h:L2_H, dpr:1 });
  const holes     = useRef([]);       // [{x,y,label,index}]
  const currentLine = useRef([]);     // indices cliqués

  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState("24 trous (6 par face) reliés aux 24 lettres grecques. Suis le fil pour épeler un mot.");
  const [wordIdx, setWordIdx] = useState(0);

  // Petit corpus de mots (peut être remplacé par letters.json)
  const WORDS = useRef([
    { gr:"ΕΛΠΙΣ", en:"ELPIS", hint:"Espoir — bon présage." },
    { gr:"ΝΙΚΗ",  en:"NIKĒ",  hint:"Victoire — élan de réussite." },
    { gr:"ΜΑΤΙ",  en:"MATI",  hint:"Mauvais œil — apotropaïon." }
  ]);

  /* -------------------- Resize & DPR -------------------- */
  useEffect(()=>{
    function onResize(){
      const wrap=wrapRef.current, hud=canvasRef.current, glc=glCanvasRef.current, renderer=rendererRef.current, cam=cameraRef.current;
      if (!wrap || !hud || !glc) return;
      const w = Math.max(320, wrap.clientWidth|0);
      const h = Math.round(w * (L2_H/L2_W));
      const dpr = clamp(window.devicePixelRatio||1, 1, DPR_MAX);
      sizeRef.current = { w, h, dpr };

      // HUD 2D
      hud.width  = Math.floor(w * dpr);
      hud.height = Math.floor(h * dpr);
      hud.style.width = w+"px"; hud.style.height = h+"px";
      const ctx = hud.getContext("2d");
      ctx.setTransform(0,0,0,0,0,0);
      ctx.setTransform((w*dpr)/L2_W, 0, 0, (h*dpr)/L2_H, 0, 0);
      ctxRef.current = ctx;

      // GL
      if (renderer) {
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        glc.style.width=w+"px"; glc.style.height=h+"px";
      }
      if (cam) { cam.aspect = w/h; cam.updateProjectionMatrix(); }
    }
    onResize();
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", onResize);
    return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  /* -------------------- Init Three -------------------- */
  useEffect(()=>{
    const THREE = window.THREE;
    if (!THREE){
      setMsg("Three.js manquant (three.min.js).");
      return;
    }
    const GLTFLoader = THREE.GLTFLoader || window.GLTFLoader;
    if (!GLTFLoader){
      setMsg("GLTFLoader manquant (examples/js/loaders/GLTFLoader.js).");
      return;
    }

    // Renderer 3D (fond)
    const glc = glCanvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias:true, alpha:true });
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, 16/9, 0.1, 50);
    cam.position.set(2.0, 1.3, 2.3);
    cam.lookAt(0, 0.25, 0);
    cameraRef.current = cam;

    // Lights doux
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2.5, 3.5, 2.5);
    scene.add(dir);

    // Sol “tapis”
    const g = new THREE.PlaneGeometry(8, 4.5);
    const m = new THREE.MeshBasicMaterial({ color:0x071425 });
    const floor = new THREE.Mesh(g, m);
    floor.rotation.x = -Math.PI/2;
    floor.position.y = -0.02;
    scene.add(floor);

    let cancelled=false;

    (async ()=>{
      // letters.json optionnel (ordre/assignation)
      const cfg = await fetchJSON(LETTERS_URL);
      if (cfg?.words && Array.isArray(cfg.words) && cfg.words.length){
        WORDS.current = cfg.words.slice(0,6);
      }

      const loader = new GLTFLoader();
      loader.load(MODEL_URL, (gltf)=>{
        if (cancelled) return;
        const root = gltf.scene || gltf.scenes?.[0];
        if (!root){ setMsg("Modèle vide."); return; }

        // Mat doux + échelle
        root.traverse((o)=>{
          if (o.isMesh){
            o.material = new THREE.MeshStandardMaterial({ color:0xf7efe7, roughness:0.6, metalness:0.05 });
          }
        });
        // normalise
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.2 / Math.max(size.x, size.y, size.z);
        root.scale.setScalar(scale);
        box.setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.sub(c);
        scene.add(root);
        modelRef.current = root;

        // Récupère 24 ancres Hole_*
        const anchors=[];
        root.traverse((n)=>{
          if (/^Hole_/i.test(n.name)) anchors.push(n);
        });
        anchorsRef.current = anchors;

        // Premier placement et boucle
        setReady(true);
        animate();
      }, undefined, (err)=>{
        console.error("GLB load error", err);
        setMsg("Échec du chargement du modèle 3D. Vérifie le chemin : " + MODEL_URL);
      });
    })();

    function animate(){
      let last=performance.now();
      function frame(){
        if (cancelled) return;
        const t=performance.now(), dt=Math.min(33, t-last)/1000; last=t;

        // Petite rotation “muséale”
        if (modelRef.current){
          modelRef.current.rotation.y += dt * 0.2;
        }

        // Projection des trous -> HUD
        updateProjectedHoles();

        // Rendu
        renderer.render(scene, cameraRef.current);
        drawHUD();

        requestAnimationFrame(frame);
      }
      frame();
    }

    function cleanup(){
      cancelled=true;
      renderer.dispose();
      const s = sceneRef.current;
      if (s) s.traverse((o)=>{
        if (o.isMesh){
          o.geometry?.dispose?.();
          if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.());
          else o.material?.dispose?.();
        }
      });
    }
    return cleanup;
  }, []);

  /* -------------------- Projection des trous -------------------- */
  function updateProjectedHoles(){
    const THREE = window.THREE;
    const cam = cameraRef.current, root = modelRef.current;
    const anchors = anchorsRef.current || [];
    const ctx = ctxRef.current;
    if (!THREE || !cam || !ctx) return;

    const v = new THREE.Vector3();
    if (anchors.length === 24) {
      const { w, h } = sizeRef.current;
      const sx = L2_W / w, sy = L2_H / h;
      holes.current = anchors.map((n, i) => {
        n.getWorldPosition(v);
        v.project(cam);
        const px = (v.x * 0.5 + 0.5) * w;
        const py = (-v.y * 0.5 + 0.5) * h;
        return { x: px * sx, y: py * sy, label: GREEK[i], index: i }; // <-- CORRIGÉ: index: i (pas "index=i")
      });
    } else if (holes.current.length !== 24){
      // Fallback : cercle 24 points
      const cx = L2_W/2, cy = L2_H/2, R = Math.min(L2_W,L2_H)*0.38;
      holes.current = Array.from({length:24}, (_,i)=>{
        const a = (i/24) * Math.PI*2 - Math.PI/2;
        return { x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R, label: GREEK[i], index: i };
      });
    }
  }

  /* -------------------- HUD 2D -------------------- */
  function drawHUD(){
    const ctx = ctxRef.current;
    if (!ctx) return;

    // fond
    ctx.clearRect(0,0,L2_W,L2_H);
    const grad = ctx.createLinearGradient(0,0,0,L2_H);
    grad.addColorStop(0,"#071425");
    grad.addColorStop(1,"#05111f");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,L2_W,L2_H);

    // panneau titre
    ctx.fillStyle="#ffffff"; ctx.globalAlpha=0.06;
    ctx.fillRect(12, 58, L2_W-24, L2_H-70);
    ctx.globalAlpha=1;

    // lignes courantes
    ctx.strokeStyle="#5eead4"; ctx.lineWidth=2;
    if (currentLine.current.length>1){
      ctx.beginPath();
      const p0 = holes.current[currentLine.current[0]];
      ctx.moveTo(p0.x, p0.y);
      for (let k=1;k<currentLine.current.length;k++){
        const p = holes.current[currentLine.current[k]];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // points + lettres
    for (let i=0;i<holes.current.length;i++){
      const p = holes.current[i];
      // point
      ctx.beginPath();
      ctx.fillStyle="#0ea5e9";
      ctx.arc(p.x, p.y, 10, 0, Math.PI*2);
      ctx.fill();
      // lettre
      ctx.fillStyle="#e6f1ff";
      ctx.font="12px ui-sans-serif, system-ui";
      ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(p.label, p.x, p.y);
    }

    // footer mot & indice
    const w = WORDS.current[wordIdx] || WORDS.current[0];
    ctx.fillStyle="#e6f1ff";
    ctx.font="16px ui-sans-serif, system-ui";
    ctx.fillText(`Mot : ${w.gr}  (${w.en})`, 16, L2_H-40);
    ctx.font="12px ui-sans-serif, system-ui";
    ctx.fillStyle="#9cc0ff";
    ctx.fillText(`Indice : ${w.hint}`, 16, L2_H-18);
  }

  /* -------------------- Interactions -------------------- */
  useEffect(()=>{
    function onClick(e){
      const hud = canvasRef.current; if (!hud) return;
      const rect = hud.getBoundingClientRect();
      const { w, h, dpr } = sizeRef.current;
      const cx = (e.clientX - rect.left) * (w/rect.width);
      const cy = (e.clientY - rect.top ) * (h/rect.height);
      // convertir en coords logiques (L2_W/L2_H)
      const x = (cx * (L2_W/w)), y = (cy * (L2_H/h));

      // trouve le point le plus proche
      let best=-1, bd=24;
      for (let i=0;i<holes.current.length;i++){
        const p=holes.current[i];
        const d = Math.hypot(p.x-x, p.y-y);
        if (d < bd){ bd=d; best=i; }
      }
      if (best>=0 && bd<24){
        currentLine.current.push(best);
      }
    }
    const hud = canvasRef.current;
    hud?.addEventListener("click", onClick);
    return ()=> hud?.removeEventListener("click", onClick);
  }, []);

  function reset(){
    currentLine.current.length=0;
    setMsg("Réinitialisé. Clique sur les points pour suivre le mot.");
  }
  function nextWord(){
    currentLine.current.length=0;
    setWordIdx(i => (i+1) % WORDS.current.length);
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#061426,#0b1f33)", color:"#e6f1ff"}}>
      <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
        <h1 className="text-xl sm:text-2xl" style={{fontWeight:700, marginBottom:6}}>Écrire avec les os — Fil & alphabet</h1>
        <p className="muted" style={{color:"#cfe2ff", margin:"0 0 10px"}}>{msg}</p>

        <div ref={wrapRef} className="w-full" style={{position:"relative", border:"1px solid #ffffff22", borderRadius:12, overflow:"hidden", background:"#04121f"}}>
          <canvas ref={glCanvasRef} />
          <canvas ref={canvasRef} style={{position:"absolute", inset:0}} />

          {!ready && (
            <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", background:"rgba(0,0,0,.35)"}}>
              <div style={{background:"#0b2237", border:"1px solid #ffffff22", borderRadius:10, padding:"10px 12px"}}>
                Chargement du modèle 3D (trous)…
              </div>
            </div>
          )}
        </div>

        <div style={{display:"flex", gap:8, marginTop:10}}>
          <button className="btn" onClick={reset} style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Réinitialiser</button>
          <button className="btn" onClick={nextWord} style={{border:"1px solid #ffffff33", background:"#0b1f33", color:"#e6f1ff", padding:"8px 12px", borderRadius:10}}>Mot suivant</button>
        </div>

        <div style={{fontSize:12, color:"#9cc0ff", marginTop:8}}>
          Modèle : <code>level2/3d/astragalus.glb</code> (nœuds <code>Hole_ventre_01..06</code>, <code>Hole_dos_01..06</code>, <code>Hole_bassin_01..06</code>, <code>Hole_membres_01..06</code>). Fallback cercle si absent.
        </div>
      </div>
    </div>
  );
}

// @ts-ignore
window.AstragalusLevel2 = AstragalusLevel2;
