// public/osselets-level3.tsx
// LEVEL 3 — Astragalus 3D (dés antiques 1/3/4/6)
// - Charge le modèle GLB: /assets/games/osselets/level3/3d/astragalus_faces.glb
// - Duplique 4 astragales, lance, fait rebondir, s'arrête, lit la face "en haut"
// - Affiche les valeurs et un petit résumé pédagogique
//
// ⚠️ Nécessite Three.js UMD global (window.THREE) et, si possible, GLTFLoader UMD (THREE.GLTFLoader).
//   N'importe pas des modules "jsm/*" pour éviter le message "Multiple instances of Three.js".
//   Exemple d’inclusion dans la page :
//   <script src="https://unpkg.com/three@0.158.0/build/three.min.js"></script>
//   <script src="https://unpkg.com/three@0.158.0/examples/js/loaders/GLTFLoader.js"></script>

const { useEffect, useRef, useState } = React;

/* -------------------- Constantes & chemins -------------------- */
const L3_BASE = "/assets/games/osselets/level3/";
const MODEL_URL = L3_BASE + "3d/astragalus_faces.glb";
const VALUES_URL = L3_BASE + "3d/values.json";

const VIEW_W = 960;
const VIEW_H = 540;
const DPR_MAX = 2.5;

const DICE_COUNT = 4;        // 4 astragales (classique 1/3/4/6) ; passe à 5 si souhaité
const FLOOR_Y = 0;
const GRAVITY = -14.5;       // m/s² "fake"
const BOUNCE = 0.45;         // restitution
const FRIC_LIN = 0.92;       // friction linéaire au sol
const FRIC_ANG = 0.94;       // friction angulaire
const STOP_EPS = 0.18;       // seuil d’arrêt
const STOP_STABLE_MS = 800;  // doit rester sous seuil pendant X ms

/* -------------------- Helpers -------------------- */
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function now(){ return (typeof performance!=="undefined"?performance:Date).now(); }
async function fetchJSONsafe(url){
  try{ const r=await fetch(url, {cache:"no-store"}); if(r.ok) return await r.json(); }catch(e){}
  return null;
}

/* ----- Déduction de valeur: par noms d’ancres ou fallback ----- */
// On cherche dans la scène des "empties" nommées face_1, face_3, face_4, face_6 (ou variantes).
function extractFaceAnchors(root, THREE){
  const list=[];
  root.traverse(function(n){
    const nm=(n.name||"").toLowerCase();
    // autorise: face1, face_1, f1, one, venus, canis, senio, quaterna, bina, etc.
    let tag=null;
    if (/face[_\- ]?1$|^f1$|venus/.test(nm)) tag="1";
    else if (/face[_\- ]?3$|^f3$|trina/.test(nm)) tag="3";
    else if (/face[_\- ]?4$|^f4$|quater/.test(nm)) tag="4";
    else if (/face[_\- ]?6$|^f6$|senio|bina/.test(nm)) tag="6";
    else if (/face|anchor/.test(nm)) tag=nm; // au cas où
    if (tag) list.push({ node:n, tag });
  });
  // Si rien trouvé, on fabrique 6 directions canoniques autour de la bbox
  if (!list.length){
    const box=new THREE.Box3().setFromObject(root);
    const c=box.getCenter(new THREE.Vector3()), e=box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const mk=(x,y,z,tag)=>{ const o=new THREE.Object3D(); o.position.set(c.x+x*e.x,c.y+y*e.y,c.z+z*e.z); root.add(o); return {node:o, tag}; };
    list.push(mk(0, 1,0,"up"));
    list.push(mk(0,-1,0,"down"));
    list.push(mk(1, 0,0,"right"));
    list.push(mk(-1,0,0,"left"));
    list.push(mk(0,0, 1,"front"));
    list.push(mk(0,0,-1,"back"));
  }
  return list;
}

// Déduit la "face vers le haut" : on prend l’ancre de plus grand Y en monde.
function pickTopFace(anchors, THREE){
  let best=null, bestY=-1e9;
  const v=new THREE.Vector3();
  for (let i=0;i<anchors.length;i++){
    anchors[i].node.getWorldPosition(v);
    if (v.y>bestY){ bestY=v.y; best=anchors[i]; }
  }
  return best ? best.tag : null;
}

/* -------------------- React Component -------------------- */
function OsseletsLevel3(){
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  // UI
  const [ready, setReady] = useState(false);
  const [values, setValues] = useState([]);      // résultats de lancer: ["1","4","6","3"]
  const [throwing, setThrowing] = useState(false);
  const [msg, setMsg] = useState("Lance 4 astragales et lis la face supérieure → valeurs 1,3,4,6.");

  // internal refs
  const threeRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const modelRef = useRef(null); // gltf scene original
  const diceRef = useRef([]);    // [{root, anchors, vel, angVel, stableSince}]
  const lastTRef = useRef(0);
  const rafRef = useRef(0);
  const valueMapRef = useRef({}); // mapping via values.json optionnel

  // Resize & DPR
  useEffect(()=>{
    function onResize(){
      const THREE = window.THREE;
      const wrap=wrapRef.current, canvas=canvasRef.current, renderer=rendererRef.current, cam=cameraRef.current;
      if(!THREE||!wrap||!canvas||!renderer||!cam) return;
      const w = wrap.clientWidth || VIEW_W;
      const h = Math.round(w * (VIEW_H / VIEW_W));
      const dpr = clamp(window.devicePixelRatio||1, 1, DPR_MAX);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      canvas.style.width = w+"px"; canvas.style.height = h+"px";
      cam.aspect = w/h; cam.updateProjectionMatrix();
    }
    onResize();
    const ro = typeof ResizeObserver!=="undefined" ? new ResizeObserver(onResize) : null;
    if (ro && wrapRef.current) ro.observe(wrapRef.current);
    window.addEventListener("resize", onResize);
    return ()=>{ if(ro) ro.disconnect(); window.removeEventListener("resize", onResize); };
  }, []);

  // Init Three scene
  useEffect(()=>{
    const THREE = window.THREE;
    if(!THREE){
      console.warn("[L3] Pas de Three → impossible d’afficher le 3D.");
      setMsg("Three.js manquant : ajoute three.min.js + GLTFLoader.js.");
      return;
    }
    threeRef.current = THREE;

    // Renderer
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    rendererRef.current = renderer;

    // Scene & camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f7fb);
    sceneRef.current = scene;

    const cam = new THREE.PerspectiveCamera(45, 16/9, 0.1, 100);
    cam.position.set(6.5, 4.8, 7.5);
    cam.lookAt(0, 0.7, 0);
    cameraRef.current = cam;

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x334466, .7); scene.add(hemi);
    const dir  = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(4,7,6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024,1024);
    dir.shadow.camera.near=0.5; dir.shadow.camera.far=30;
    scene.add(dir);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(40, 22);
    const groundMat = new THREE.MeshStandardMaterial({ color:0xeae7ff, roughness:.95, metalness:0 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = FLOOR_Y;
    ground.receiveShadow = true;
    scene.add(ground);

    // Soft ring under dice (aesthetic)
    const ringGeo = new THREE.RingGeometry(0.01, 8.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color:0xdee3ff, transparent:true, opacity:0.25, side:THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x=-Math.PI/2; ring.position.y=FLOOR_Y+0.005;
    scene.add(ring);

    let cancelled=false;

    (async ()=>{
      // values.json (facultatif): {"1":1,"3":3,"4":4,"6":6,"names":{"1":"Vénus","3":"Trina","4":"Quaterna","6":"Senio"}}
      const map = await fetchJSONsafe(VALUES_URL);
      if (map) valueMapRef.current = map;

      // Loader (UMD)
      const GLTFLoader = THREE.GLTFLoader || (window.GLTFLoader ? window.GLTFLoader : null);
      if (!GLTFLoader){
        setMsg("GLTFLoader non trouvé. Ajoute examples/js/loaders/GLTFLoader.js (UMD).");
        return;
      }
      const loader = new GLTFLoader();

      // Charge modèle
      loader.load(MODEL_URL, (gltf)=>{
        if (cancelled) return;
        const root = gltf.scene || gltf.scenes[0];
        // Normalise l’échelle et origine au centre
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const scale = 1.6 / Math.max(size.x, size.y, size.z); // ~taille visuelle
        root.scale.setScalar(scale);
        box.setFromObject(root);
        const c = box.getCenter(new THREE.Vector3());
        root.position.sub(c); // centre à l'origine

        // Matériaux doux et ombres
        const tone = new THREE.Color(0xf8f5f2);
        root.traverse(function(m){
          if (m.isMesh){
            m.castShadow = true; m.receiveShadow = false;
            if (!m.material || m.material.isMeshStandardMaterial!==true){
              m.material = new THREE.MeshStandardMaterial({ color: tone, metalness:0.05, roughness:0.6 });
            }else{
              m.material.metalness = clamp(m.material.metalness||0,0,0.15);
              m.material.roughness = clamp(m.material.roughness||0.6,0.35,1.0);
            }
          }
        });

        modelRef.current = root;

        // Crée N dés
        const dice=[];
        for (let i=0;i<DICE_COUNT;i++){
          const g = root.clone(true);
          scene.add(g);
          const anchors = extractFaceAnchors(g, THREE);
          dice.push({
            root:g,
            anchors:anchors,
            vel:new THREE.Vector3(),
            angVel:new THREE.Vector3(),
            stableSince:0
          });
        }
        diceRef.current = dice;
        layoutDiceAtRest(); // position initiale lisible
        setReady(true);
        animate();
      },
      undefined,
      (err)=>{
        console.error("GLB load error:", err);
        setMsg("Échec chargement du modèle 3D. Vérifie le chemin : " + MODEL_URL);
      });
    })();

    function animate(){
      lastTRef.current = now();
      function frame(){
        const t=now();
        const dt = Math.min(32, t - lastTRef.current) / 1000; // s
        lastTRef.current = t;
        step(dt);
        renderer.render(scene, cam);
        rafRef.current = requestAnimationFrame(frame);
      }
      frame();
    }

    function cleanup(){
      cancelled=true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      scene.traverse(function(o){
        if (o.isMesh && o.geometry) o.geometry.dispose?.();
        if (o.isMesh && o.material){
          if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose?.());
          else o.material.dispose?.();
        }
      });
    }

    return cleanup;
  }, []);

  /* -------------------- Simulation "physique" simplifiée -------------------- */
  function layoutDiceAtRest(){
    const THREE = threeRef.current;
    const dice = diceRef.current;
    if (!THREE || !dice || !dice.length) return;
    for (let i=0;i<dice.length;i++){
      const d = dice[i];
      // grille simple
      d.root.position.set(-2.2 + i*1.5, 0.82, (i%2===0)? -0.6 : 0.7);
      d.root.rotation.set(0, (i*0.6), 0);
      d.vel.set(0,0,0);
      d.angVel.set(0,0,0);
      d.stableSince = now();
      d.root.updateMatrixWorld(true);
    }
  }

  function randomThrow(){
    const THREE = threeRef.current;
    const dice = diceRef.current;
    if (!THREE || !dice || !dice.length) return;

    // positions & vitesses initiales
    for (let i=0;i<dice.length;i++){
      const d = dice[i];
      d.root.position.set(-3.5 + i*0.6, 2.2 + Math.random()*0.8, -1.8 + Math.random()*3.4);
      d.root.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
      d.vel.set(5.2 + Math.random()*2.0, 2.5 + Math.random()*1.2, 1.5 - Math.random()*3.0);
      d.angVel.set(
        (-1+Math.random()*2)*6.0,
        (-1+Math.random()*2)*6.0,
        (-1+Math.random()*2)*6.0
      );
      d.stableSince = 0;
      d.root.updateMatrixWorld(true);
    }
    setValues([]);
    setThrowing(true);
    setMsg("Lancer ! Laisse les os se stabiliser…");
  }

  function step(dt){
    const THREE = threeRef.current;
    const dice = diceRef.current;
    const scene = sceneRef.current;
    if (!THREE || !dice || !scene) return;

    let allStable = true;
    for (let i=0;i<dice.length;i++){
      const d = dice[i];
      // gravité
      d.vel.y += GRAVITY * dt;

      // intégration position
      d.root.position.addScaledVector(d.vel, dt);

      // collisions sol
      const rApprox = 0.75; // rayon approximatif
      if (d.root.position.y - rApprox <= FLOOR_Y){
        d.root.position.y = FLOOR_Y + rApprox;
        if (d.vel.y < 0) d.vel.y = -d.vel.y * BOUNCE;
        d.vel.x *= FRIC_LIN; d.vel.z *= FRIC_LIN;
        d.angVel.multiplyScalar(FRIC_ANG);
      }

      // Réduction très légère des vitesses (air)
      d.vel.multiplyScalar(0.999);
      d.angVel.multiplyScalar(0.999);

      // rotation
      const av = d.angVel;
      d.root.rotation.x += av.x * dt;
      d.root.rotation.y += av.y * dt;
      d.root.rotation.z += av.z * dt;

      // bordures (boite)
      const X=6.8, Z=4.4;
      if (d.root.position.x<-X){ d.root.position.x=-X; d.vel.x= Math.abs(d.vel.x)*0.6; }
      if (d.root.position.x> X){ d.root.position.x= X; d.vel.x=-Math.abs(d.vel.x)*0.6; }
      if (d.root.position.z<-Z){ d.root.position.z=-Z; d.vel.z= Math.abs(d.vel.z)*0.6; }
      if (d.root.position.z> Z){ d.root.position.z= Z; d.vel.z=-Math.abs(d.vel.z)*0.6; }

      d.root.updateMatrixWorld(true);

      // stabilité
      const speed = d.vel.length() + d.angVel.length();
      if (speed < STOP_EPS){
        if (!d.stableSince) d.stableSince = now();
      }else{
        d.stableSince = 0;
      }
      const stable = d.stableSince && (now() - d.stableSince > STOP_STABLE_MS);
      if (!stable) allStable = false;
    }

    if (throwing && allStable){
      setThrowing(false);
      // lit les faces
      const out=[];
      for (let i=0;i<dice.length;i++){
        const d=dice[i];
        const face = pickTopFace(d.anchors, THREE) || "?";
        out.push(face);
      }
      const human = translateFaces(out, valueMapRef.current);
      setValues(human);
      setMsg("Résultat : " + human.join("  "));
    }
  }

  function translateFaces(tags, map){
    // map peut contenir : {"map":{"up":"1", "down":"6", ...}} ou direct {"1":1,"3":3...}
    const norm=[];
    const nameMap = (map && map.map) ? map.map : null;
    const fromTag = function(t){
      if (!t) return "?";
      const t0 = String(t).toLowerCase();
      if (nameMap && nameMap[t0]!=null) return String(nameMap[t0]);

      // heuristiques
      if (t0==="1" || /venus|one|f1$|face[_\- ]?1$/.test(t0)) return "1";
      if (t0==="3" || /trina|three|f3$|face[_\- ]?3$/.test(t0)) return "3";
      if (t0==="4" || /quater|four|f4$|face[_\- ]?4$/.test(t0)) return "4";
      if (t0==="6" || /senio|six|bina|f6$|face[_\- ]?6$/.test(t0)) return "6";
      // directions…
      if (/up|top/.test(t0)) return "1";
      if (/down|bottom/.test(t0)) return "6";
      if (/left|right|front|back/.test(t0)) return "3"; // arbitraire
      return "?";
    };
    for (let i=0;i<tags.length;i++) norm.push(fromTag(tags[i]));
    return norm;
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#f8fafc,#eef2ff)", color:"#0f172a"}}>
      <div className="max-w-5xl mx-auto" style={{padding:"16px"}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:8}}>
          <h1 className="text-xl sm:text-2xl" style={{fontWeight:700}}>Écrire avec les os — Lancer d’astragales (3D)</h1>
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <button
              onClick={()=>{ ready ? randomThrow() : null; }}
              disabled={!ready}
              style={{padding:"10px 14px", border:"1px solid #2563eb", background:"#2563eb", color:"#fff", borderRadius:12, cursor:ready?"pointer":"default", boxShadow:"0 6px 16px rgba(37,99,235,.25)"}}
            >
              Lancer
            </button>
            <button
              onClick={()=>{ layoutDiceAtRest(); setValues([]); setThrowing(false); setMsg("Réinitialisé. Clique ‘Lancer’."); }}
              disabled={!ready}
              style={{padding:"8px 12px", border:"1px solid #e5e7eb", background:"#fff", borderRadius:12, cursor:ready?"pointer":"default"}}
            >
              Réinitialiser
            </button>
          </div>
        </div>

        <p className="text-sm" style={{color:"#475569", marginBottom:12}}>
          {msg}
        </p>

        <div ref={wrapRef} className="w-full" style={{position:"relative", border:"1px solid #e5e7eb", borderRadius:12, overflow:"hidden", background:"#fff"}}>
          <canvas ref={canvasRef} />
          {!ready && (
            <div style={{position:"absolute", inset:0, display:"grid", placeItems:"center", background:"linear-gradient(180deg,rgba(255,255,255,.96),rgba(255,255,255,.92))"}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontWeight:700, marginBottom:6}}>Chargement du modèle 3D…</div>
                <div style={{fontSize:12, color:"#64748b"}}>Modèle : <code>level3/3d/astragalus_faces.glb</code></div>
              </div>
            </div>
          )}

          {values && values.length>0 && (
            <div style={{position:"absolute", left:12, bottom:12, background:"rgba(255,255,255,.96)", border:"1px solid #e5e7eb", borderRadius:12, padding:"10px 12px"}}>
              <div style={{fontWeight:600, marginBottom:4}}>Tirage</div>
              <div style={{fontSize:14}}>
                {values.join("  ")}
                <span style={{marginLeft:10, color:"#64748b"}}>Somme: {values.filter(v=>/^\d+$/.test(v)).map(Number).reduce((a,b)=>a+b,0)}</span>
              </div>
              <div style={{fontSize:12, color:"#64748b", marginTop:4}}>
                Catégories antiques : Vénus (1), Trina (3), Quaterna (4), Senio/Bina (6).
              </div>
            </div>
          )}
        </div>

        <div style={{fontSize:12, color:"#6b7280", marginTop:8}}>
          Ce niveau utilise ton modèle 3D (<code>astragalus_faces.glb</code>) et lit la face supérieure via les ancres <em>face_1</em>, <em>face_3</em>, <em>face_4</em>, <em>face_6</em> si présentes (ou un fallback géométrique).
        </div>
      </div>
    </div>
  );
}

// @ts-ignore
window.OsseletsLevel3 = OsseletsLevel3;
